'use strict';
import { resolveForm } from './formEngine/resolve.js';
import { readModelPath } from './formEngine/output.js';

/**
 * Validate a launch that came in over the REST API against the form definition, with the
 * same engine and rules as the browser and the MCP server (LAUNCH_VALIDATION).
 *
 * The browser sends `rawFormData` - the raw field values - next to the modelled extravars ;
 * those raw values are what the rules apply to. Two gaps are filled in :
 *   - password fields are never in rawFormData (form.vue getFilteredRawFormData) ; their
 *     value is read back from the extravars, at the field's model path ;
 *   - constant fields are not in it either ; the engine fills them from the form.
 * A wizard sends its merged output as rawFormData, not raw values, so it cannot be checked
 * here yet and is reported as skipped.
 *
 * Nothing here decides what happens with the result - Job.launch logs or refuses.
 *
 * @returns {Promise<{ skipped?: string, ok?: boolean, errors?: object, warnings?: string[] }>}
 */
export async function validateLaunch({ formConfig, formObj, user, rawFormData, extravars, services }) {
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
  const res = await resolveForm({
    form: formObj,
    constants: formConfig?.constants || {},
    vars: formObj?.vars || {},
    user,
    values,
    services,
  });
  const errors = {
    missing: res.missing,
    invalid: res.invalid,
    waiting: res.waiting,
    validationErrors: res.validationErrors,
  };
  return { ok: res.complete, errors, warnings: res.warnings };
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
  const other = (errors?.invalid || []).filter((n) => !(n in (errors?.validationErrors || {})));
  if (other.length) parts.push(`not one of the options : ${other.join(', ')}`);
  if (errors?.waiting?.length) parts.push(`not resolvable : ${errors.waiting.join(', ')}`);
  return parts.join(' ; ');
}

export default { validateLaunch, describeLaunchErrors };
