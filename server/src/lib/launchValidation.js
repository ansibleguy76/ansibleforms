'use strict';
import fs from 'fs';
import path from 'path';
import { resolveForm } from './formEngine/resolve.js';
import { readModelPath, buildLaunchPayload, canonicalJson } from './formEngine/output.js';

/**
 * Validate a launch that came in over the REST API against the form definition, with the
 * same engine and rules as the browser and the MCP server (LAUNCH_VALIDATION), and build the
 * extravars and credentials the server would submit for it.
 *
 * The browser sends `rawFormData` - the raw field values - next to the modelled extravars ;
 * those raw values are what the rules apply to. Three gaps are filled in :
 *   - password fields are never in rawFormData (form.vue getFilteredRawFormData) ; their
 *     value is read back from the extravars, at the field's model path ;
 *   - constant fields are not in it either ; the engine fills them from the form ;
 *   - a file is a serialised File there ({}) ; the upload itself arrives in `files` (the
 *     result of POST /api/v2/job/upload) and is verified against the upload folder.
 * A wizard sends its merged output as rawFormData, not raw values, so it cannot be checked
 * here yet and is reported as skipped.
 *
 * Nothing here decides what happens with the result - Job.launch logs, refuses, or runs the
 * server-built payload.
 *
 * @returns {Promise<{ skipped?: string, ok?: boolean, errors?: object, warnings?: string[],
 *   payload?: { extravars: object, credentials: object } }>}
 */
export async function validateLaunch({ formConfig, formObj, user, rawFormData, extravars, files, uploadPath, services }) {
  if (Array.isArray(formObj?.wizard) && formObj.wizard.length > 0) {
    return { skipped: 'wizard forms send merged step output, not raw field values' };
  }
  const values = { ...(rawFormData || {}) };
  for (const f of formObj?.fields || []) {
    if (f?.type !== 'password' || !f.name || f.name in values) continue;
    const at = [].concat(f.model || f.name)[0];
    const v = readModelPath(extravars || {}, at);
    if (v !== undefined) values[f.name] = v;
  }
  const uploads = verifyUploads(formObj, files, uploadPath);
  for (const [name, upload] of Object.entries(uploads.verified)) {
    // what the browser's rules saw : a File, with a name and a size
    values[name] = { ...upload, name: upload.originalname, size: upload.size };
  }
  const res = await resolveForm({
    form: formObj,
    constants: formConfig?.constants || {},
    vars: formObj?.vars || {},
    user,
    values,
    services,
  });
  // an upload that did not check out is refused only when its field is shown
  const uploadErrors = uploads.errors.filter((e) => res._visibility[e.field]);
  const errors = {
    missing: res.missing,
    invalid: res.invalid,
    waiting: res.waiting,
    validationErrors: res.validationErrors,
    ...(Object.keys(res.rowErrors || {}).length ? { rowErrors: res.rowErrors } : {}),
    ...(uploadErrors.length ? { uploads: uploadErrors } : {}),
  };
  if (!res.complete || uploadErrors.length) return { ok: false, errors, warnings: res.warnings };

  // through JSON, as the browser's payload travels : an empty field leaves no `undefined`
  // behind, so the job - and the comparison with the client's extravars - sees the same
  const built = buildLaunchPayload(res, formObj.subforms || [], { overrides: uploads.verified });
  const payload = JSON.parse(JSON.stringify(built));
  // the verbose flag is the one thing a browser adds to the output ; the controller has
  // already checked the user may use it
  if (extravars?.__verbose__) payload.extravars.__verbose__ = true;
  return { ok: true, errors, warnings: res.warnings, payload };
}

/**
 * The uploads a launch refers to, checked against the upload folder : the path must be a
 * file inside it. Path, name and size come from the disk, never from the request ; only the
 * descriptive original name, mime type and encoding are the client's.
 *
 * @returns {{ verified: object, errors: {field, reason}[] }}
 */
export function verifyUploads(formObj, files, uploadPath) {
  const verified = {};
  const errors = [];
  const root = path.resolve(uploadPath || '');
  for (const f of formObj?.fields || []) {
    if (f?.type !== 'file' || !f.name) continue;
    const upload = files?.[f.name];
    if (!upload || typeof upload !== 'object') continue;
    if (!uploadPath || typeof upload.path !== 'string' || !upload.path) {
      errors.push({ field: f.name, reason: 'the upload has no path' });
      continue;
    }
    const resolved = path.resolve(upload.path);
    if (!resolved.startsWith(root + path.sep)) {
      errors.push({ field: f.name, reason: 'the upload is not in the upload folder' });
      continue;
    }
    let stat;
    try {
      stat = fs.statSync(resolved);
    } catch {
      stat = null;
    }
    if (!stat?.isFile()) {
      errors.push({ field: f.name, reason: 'the uploaded file does not exist' });
      continue;
    }
    verified[f.name] = {
      fieldname: 'file',
      originalname: String(upload.originalname ?? path.basename(resolved)),
      encoding: String(upload.encoding ?? ''),
      mimetype: String(upload.mimetype ?? ''),
      destination: path.dirname(resolved),
      filename: path.basename(resolved),
      path: resolved,
      size: stat.size,
    };
  }
  return { verified, errors };
}

/**
 * The top-level keys whose value differs between the client's extravars and the server's.
 * `__verbose__` and reserved `__x__` keys are not form output, so they are left out.
 */
export function compareExtravars(client, server) {
  const isOutputKey = (k) => !/^__.*__$/.test(k);
  const keys = new Set([...Object.keys(client || {}), ...Object.keys(server || {})].filter(isOutputKey));
  return [...keys].filter((k) => canonicalJson(client?.[k]) !== canonicalJson(server?.[k])).sort();
}

/**
 * A log line about a refused (or would-be refused) launch : field names and rule types
 * only - never a value, a description could hold one through a placeholder.
 */
export function describeLaunchErrors(errors) {
  const parts = [];
  if (errors?.missing?.length) parts.push(`missing : ${errors.missing.join(', ')}`);
  const rules = Object.entries(errors?.validationErrors || {}).map(([n, errs]) => `${n} (${errs.map((e) => e.type).join(', ')})`);
  if (rules.length) parts.push(`failing rules : ${rules.join(', ')}`);
  const rows = describeRowErrors(errors?.rowErrors);
  if (rows.length) parts.push(`failing rows : ${rows.join(', ')}`);
  const other = (errors?.invalid || [])
    .filter((n) => !(n in (errors?.validationErrors || {})) && !(n in (errors?.rowErrors || {})));
  if (other.length) parts.push(`invalid : ${other.join(', ')}`);
  if (errors?.waiting?.length) parts.push(`not resolvable : ${errors.waiting.join(', ')}`);
  if (errors?.uploads?.length) parts.push(`uploads : ${errors.uploads.map((u) => `${u.field} (${u.reason})`).join(', ')}`);
  return parts.join(' ; ');
}

/** `list[2].field (rule)` for every failing row, nested lists included - names and rule types only. */
export function describeRowErrors(rowErrors, prefix = '') {
  const out = [];
  for (const [list, rows] of Object.entries(rowErrors || {})) {
    for (const row of rows) {
      const at = `${prefix}${list}[${row.index}]`;
      for (const n of row.missing || []) out.push(`${at}.${n} (missing)`);
      for (const [n, errs] of Object.entries(row.validationErrors || {})) out.push(`${at}.${n} (${errs.map((e) => e.type).join(', ')})`);
      for (const n of (row.invalid || []).filter((x) => !(x in (row.validationErrors || {})) && !(x in (row.rowErrors || {})))) out.push(`${at}.${n} (invalid)`);
      for (const n of row.waiting || []) out.push(`${at}.${n} (not resolvable)`);
      out.push(...describeRowErrors(row.rowErrors, `${at}.`));
    }
  }
  return out;
}

export default { validateLaunch, describeRowErrors, verifyUploads, compareExtravars, describeLaunchErrors };
