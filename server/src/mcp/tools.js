'use strict';
import { z } from 'zod';
import { resolveForm, normalizeFields, isDynamicField } from '../lib/formEngine/resolve.js';
import { scanDependencies } from '../lib/formEngine/placeholders.js';
import { buildLaunchPayload, filterRawFormData, maskPasswords } from '../lib/formEngine/output.js';
import { sha256 } from '../lib/formEngine/node/hash.js';
import { createFormServices } from '../lib/formServices.js';
import { describeRowErrors } from '../lib/launchValidation.js';
import { cronError } from '../lib/cronValidate.js';
import yaml from 'yaml';

/**
 * The MCP tools. Deliberately technical : they expose the form flow a browser goes through
 * - list, open, fill in, launch, follow - as the authenticated AnsibleForms user, and add no
 * policy of their own. Confirmation, approval UX and which forms an agent may use belong to
 * the MCP client (the chat backend). What stays here is what AnsibleForms already enforces
 * for the browser : RBAC on forms and jobs, expressions and queries only as the form
 * defines them, reserved extravars stripped, credentials never returned.
 *
 * `createHandlers` takes its models as `deps`, so the tests can drive every tool without a
 * database ; mcp/router.js passes the real ones.
 */

/**
 * A refusal the caller can act on. `code` and `details` are returned as structured content
 * next to the text, so a client does not have to parse the message.
 */
export class ToolError extends Error {
  constructor(message, code = 'invalid_request', details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

// model errors, by name, and the code a caller gets for them
const KNOWN_ERRORS = {
  AccessDeniedError: 'access_denied',
  ForbiddenError: 'access_denied',
  NotFoundError: 'not_found',
  ConflictError: 'conflict',
  BadRequestError: 'invalid_request',
  ValidationError: 'form_incomplete',
};

function lastLines(text, n) {
  if (!n || n <= 0) return text;
  const lines = String(text || '').split(/\r?\n/);
  return lines.slice(-n).join('\n');
}

function parseJson(s, fallback) {
  if (s && typeof s === 'object') return s;
  try {
    return JSON.parse(s || '');
  } catch {
    return fallback;
  }
}

// the internal keys resolveForm hands back for the launch - never sent to a caller, they
// hold the raw values including passwords
function publicResolution(res) {
  const { _values, _visibility, _fields, ...rest } = res; // eslint-disable-line no-unused-vars
  return rest;
}

/**
 * @param {object} args
 * @param {object} args.user  req.user.user
 * @param {object} args.deps  { Form, Job, Expression, Query, resolveFormQuery } ; for the
 *   schedules also { Schedule, cron (the cron service : add and remove a schedule's task),
 *   appTimezone (async : the app's display zone, Settings > Appearance) }
 * @param {object} [args.policy]  the MCP settings, from the MCP router only (the chat
 *   assistant has its own rules) : `readOnly` refuses launch_job and relaunch_job,
 *   `chatFormsOnly` offers only the forms offered in the chat (enableForChat)
 */
export function createHandlers({ user, deps, policy = {} }) {
  const { Form, Job, Expression, Query, resolveFormQuery, Schedule, cron, appTimezone } = deps;
  const roles = user?.roles || [];

  // a form MCP may offer : any the user may open, or with chatFormsOnly those offered in the
  // chat as well - a form left out is not found, as one the user may not open
  const offered = (f) => !policy.chatFormsOnly || f?.enableForChat === true;

  async function loadForm(name) {
    const formConfig = await Form.load(roles, name);
    const formObj = formConfig?.forms?.[0];
    if (!formObj || !offered(formObj)) throw new ToolError(`Form '${name}' not found or you do not have access to it`, 'not_found');
    return { formConfig, formObj };
  }

  function refuseWhenReadOnly(what = 'jobs cannot be launched or relaunched through it') {
    if (policy.readOnly) {
      throw new ToolError(`This MCP server is read only : ${what}`, 'access_denied');
    }
  }

  // ─── schedules (#1069) : the role options decide, as on the schedule routes ────────────────
  // allowScheduledJobs : every schedule (an admin-level right) ; allowPlannedJobs : one-time runs
  // of a form, as the user, and those only
  const mayPlan = !!user?.options?.allowPlannedJobs;
  const mayManage = !!user?.options?.allowScheduledJobs;

  /** The user a planned run runs as, from its owner ; null for an admin-level schedule. */
  function ownerOf(row) {
    if (!row?.owner) return null;
    try {
      const owner = typeof row.owner === 'string' ? JSON.parse(row.owner) : row.owner;
      return owner?.username ? { username: owner.username, type: owner.type || 'local' } : null;
    } catch {
      return null;
    }
  }

  /** Whether a schedule is this user's : a run they planned. */
  function isMine(row) {
    const owner = ownerOf(row);
    return !!owner && owner.username === user?.username && owner.type === (user?.type || 'local');
  }

  /** The names of the forms MCP offers this user, when only the chat's are offered. */
  async function offeredFormNames() {
    if (!policy.chatFormsOnly) return null;
    const cfg = await Form.load(roles);
    return new Set((cfg?.forms || []).filter(offered).map((f) => f.name));
  }

  /** A schedule this user may see, else not found (as one that does not exist). */
  async function visibleSchedule(id) {
    if (!mayManage && !mayPlan) throw new ToolError('You do not have permission to see schedules', 'access_denied');
    const notFound = new ToolError(`Schedule ${id} not found or you do not have access to it`, 'not_found');
    let row;
    try {
      row = await Schedule.findById(id);
    } catch (err) {
      if (err?.name === 'NotFoundError') throw notFound;
      throw err;
    }
    if (!row || (!mayManage && !isMine(row))) throw notFound;
    const names = await offeredFormNames();
    if (names && !names.has(row.form)) throw notFound;
    return row;
  }

  /**
   * When a schedule runs next : as the list has it, else as the model works it out for one row
   * (the scheduler's zone for a cron, none for a one-time run already past).
   */
  function nextRunOf(row) {
    if (row && 'next_run' in row) return row.next_run ?? null;
    return Schedule.withNextRun ? Schedule.withNextRun(row).next_run ?? null : null;
  }

  /** A schedule as the list shows it : what, when and how it went ; not its values. */
  function scheduleSummary(row) {
    const owner = ownerOf(row);
    return {
      id: row.id,
      name: row.name,
      form: row.form,
      // a run planned by a user runs as them ; any other schedule as the Schedule Service
      planned: !!owner,
      runsAs: owner ? owner.username : 'Schedule Service',
      oneTimeRun: !!row.one_time_run,
      runAt: row.run_at ?? null,
      cron: row.cron || null,
      nextRun: nextRunOf(row),
      status: row.status || null,
      state: row.state || null,
      lastRun: row.last_run ?? null,
    };
  }

  /**
   * A moment as a planned run takes it : an ISO 8601 time with its offset or Z, so the run never
   * depends on the zone of a server or a browser (#1064) ; not in the past.
   */
  function momentOf(runAt) {
    const text = String(runAt ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
      throw new ToolError(`run_at must be an ISO 8601 time with its offset or Z, such as 2026-10-15T22:00:00+02:00 or `
        + `2026-10-15T20:00:00Z, not '${text}' : a time without a zone is ambiguous`, 'invalid_request');
    }
    const when = new Date(text);
    // a date that does not exist (30 February, 24:00) is moved by the parser without a word :
    // refused instead, the run would happen on another day than the one asked
    const [, y, mo, d, h, mi] = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/).map(Number);
    const day = new Date(Date.UTC(y, mo - 1, d));
    if (Number.isNaN(when.getTime()) || h > 23 || mi > 59
      || day.getUTCFullYear() !== y || day.getUTCMonth() !== mo - 1 || day.getUTCDate() !== d) {
      throw new ToolError(`run_at '${text}' is not a valid time`, 'invalid_request');
    }
    if (when.getTime() < Date.now() - 60 * 1000) {
      throw new ToolError(`run_at '${text}' is in the past`, 'invalid_request', { now: new Date().toISOString() });
    }
    return when;
  }

  /** A moment in UTC and on the app's clock (Settings > Appearance > Defaults, else UTC). */
  async function bothClocks(when) {
    let zone;
    try {
      zone = (await appTimezone?.()) || 'UTC';
    } catch {
      zone = 'UTC';
    }
    let local;
    try {
      local = new Intl.DateTimeFormat('sv-SE', { timeZone: zone, dateStyle: 'short', timeStyle: 'medium' }).format(when);
    } catch {
      zone = 'UTC';
      local = new Intl.DateTimeFormat('sv-SE', { timeZone: 'UTC', dateStyle: 'short', timeStyle: 'medium' }).format(when);
    }
    return { runAt: when.toISOString(), runAtLocal: `${local} ${zone}`, timezone: zone };
  }

  /** A schedule stored ; a name already taken (names are unique, for every user) said so. */
  async function stored(name, store) {
    try {
      return await store();
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY' || /Duplicate entry/i.test(err?.message || '')) {
        throw new ToolError(`A schedule named '${name}' already exists ; choose another name`, 'conflict', { name });
      }
      throw err;
    }
  }

  /** The cron service runs it from now on (the schedule routes do the same). */
  async function registered(id) {
    const row = await Schedule.findById(id);
    cron?.addSchedule?.(row.id, row.name, row.cron, row.one_time_run, row.run_at);
    return row;
  }

  function servicesFor(formConfig, formObj, subformName) {
    return createFormServices({ user, formConfig, formObj, subformName, deps: { Expression, Query, resolveFormQuery } });
  }

  async function resolveFor({ form, values, field, subform, parent, maxOptions }) {
    const { formConfig, formObj } = await loadForm(form);
    let target = formObj;
    let parentData;
    // a wizard keeps its fields in its steps : resolving the empty root would report a
    // "complete" form that is nothing of the sort
    if (!subform && Array.isArray(formObj.wizard) && formObj.wizard.length > 0) {
      throw new ToolError(`'${formObj.name}' is a wizard form ; its fields live in its steps `
        + `(${formObj.wizard.map((s) => s?.subform).filter(Boolean).join(', ')}). Resolve a step with \`subform\`. `
        + 'Wizard forms cannot be launched through MCP yet.', 'unsupported',
        { steps: formObj.wizard.map((s) => s?.subform).filter(Boolean) });
    }
    if (subform) {
      target = (formObj.subforms || []).find((s) => s?.name === subform);
      if (!target) throw new ToolError(`Subform '${subform}' is not part of form '${formObj.name}'`, 'not_found');
      // a subform sees its parent form's values (and through them the constants and
      // varsFiles data) as __parent__, as a list row or wizard step does in the browser
      parentData = { ...(formConfig.constants || {}), ...(formObj.vars || {}), ...(parent || {}) };
    }
    const res = await resolveForm({
      form: target,
      constants: formConfig.constants || {},
      vars: target.vars || {},
      user,
      parent: parentData,
      values: values || {},
      only: field,
      maxOptions,
      services: servicesFor(formConfig, formObj, subform),
      subforms: formObj.subforms || [],
      // an agent's rows never went through the browser's row editor : resolve them all
      allRows: true,
    });
    return { res, formConfig, formObj };
  }

  /**
   * What launch_job submits for a complete resolution, and its hash. The hash covers the
   * form name, the modelled extravars and the credential names, computed over the REAL
   * values (passwords included) ; the preview a caller sees has the passwords masked.
   * Job.launch adds ansibleforms_user and __jobid__ afterwards, and `verbose` adds
   * __verbose__ - none of those are part of the hash.
   */
  function launchPayload(res, formObj) {
    const { extravars, credentials } = buildLaunchPayload(res, formObj.subforms || []);
    return {
      extravars,
      credentials,
      preview: maskPasswords(extravars, res._fields, formObj.subforms || []),
      payloadHash: sha256({ form: formObj.name, extravars, credentials }),
    };
  }

  /**
   * A form resolved, validated and turned into its launch payload, as launch_job submits it and
   * plan_job plans it : refused while incomplete, with a file field, or when the payload differs
   * from the confirmed one.
   *
   * Returns:
   *   Promise<object>: { formObj, extravars, credentials, payloadHash, rawFormData, warnings }.
   */
  async function readyToLaunch({ form, values, verbose, expectedPayloadHash }) {
    const { formConfig, formObj } = await loadForm(form);
    if (formObj.type === 'subform') {
      throw new ToolError(`'${formObj.name}' is a subform and cannot be launched on its own`, 'unsupported');
    }
    if (Array.isArray(formObj.wizard) && formObj.wizard.length > 0) {
      throw new ToolError(`'${formObj.name}' is a wizard form ; wizard forms cannot be launched through MCP yet`, 'unsupported');
    }
    if (verbose && !user?.options?.allowVerboseMode) {
      throw new ToolError('You do not have permission to run jobs in verbose mode', 'access_denied');
    }
    const res = await resolveForm({
      form: formObj,
      constants: formConfig.constants || {},
      vars: formObj.vars || {},
      user,
      values: values || {},
      services: servicesFor(formConfig, formObj),
      allRows: true,
    });
    if (!res.complete) {
      const parts = [];
      const notAnOption = res.fields.filter((f) => f.notInOptions && res.invalid.includes(f.name)).map((f) => f.name);
      const failing = Object.entries(res.validationErrors)
        .map(([name, errs]) => `${name} (${errs.map((e) => e.description ? `${e.type}: ${e.description}` : e.type).join(', ')})`);
      if (res.missing.length) parts.push(`missing input for : ${res.missing.join(', ')}`);
      if (notAnOption.length) parts.push(`not one of the options : ${notAnOption.join(', ')}`);
      if (failing.length) parts.push(`validation failed : ${failing.join(' ; ')}`);
      const rows = describeRowErrors(res.rowErrors);
      if (rows.length) parts.push(`list rows failing : ${rows.join(', ')}`);
      if (res.waiting.length) parts.push(`not resolvable yet : ${res.waiting.join(', ')}`);
      throw new ToolError(`The form is not complete - ${parts.join(' ; ')}. Call resolve_field to see what is needed.`,
        'form_incomplete', {
          missing: res.missing, invalid: res.invalid, waiting: res.waiting, validationErrors: res.validationErrors,
          rowErrors: res.rowErrors,
        });
    }
    const files = res._fields.filter((f) => f.type === 'file' && res._visibility[f.name]
      && res._values[f.name] !== undefined && res._values[f.name] !== null && res._values[f.name] !== '');
    if (files.length) {
      throw new ToolError(`File fields cannot be filled through MCP (${files.map((f) => f.name).join(', ')})`,
        'unsupported', { fields: files.map((f) => f.name) });
    }
    const { extravars, credentials, payloadHash } = launchPayload(res, formObj);
    // the resolution changed since it was approved : a query answered differently, the
    // form was edited, or other values were sent
    if (expectedPayloadHash && expectedPayloadHash !== payloadHash) {
      throw new ToolError('The payload differs from the one that was resolved - resolve the form again and have it confirmed.',
        'payload_mismatch', { expectedPayloadHash, payloadHash });
    }
    if (verbose) extravars.__verbose__ = true;
    return { formObj, extravars, credentials, payloadHash, rawFormData: filterRawFormData(res._fields, res._values), warnings: res.warnings };
  }

  return {
    async listForms() {
      const cfg = await Form.load(roles);
      return {
        forms: (cfg?.forms || []).filter(offered).map((f) => ({
          name: f.name,
          description: f.description || '',
          categories: f.categories || [],
          // the chat assistant's allowlist and its button (Approve for change, Launch for read)
          enableForChat: f.enableForChat === true,
        })),
      };
    },

    async getForm({ name }) {
      const { formConfig, formObj } = await loadForm(name);
      const fields = normalizeFields(formObj.fields);
      const known = [...Object.keys(formConfig.constants || {}), ...Object.keys(formObj.vars || {}), '__user__'];
      const graph = scanDependencies(fields, known);
      const wizard = Array.isArray(formObj.wizard) && formObj.wizard.length > 0;
      return {
        ...formObj,
        fields: fields.map((f) => ({ ...f, dynamic: isDynamicField(f), dependsOn: graph.dependsOn[f.name] || [] })),
        constants: formConfig.constants || {},
        supported: !wizard,
        ...(wizard ? { unsupportedReason: 'wizard forms cannot be launched through MCP yet' } : {}),
        errors: formConfig.errors || [],
        warnings: [...(formConfig.warnings || []), ...graph.warnings],
      };
    },

    async resolveField(args) {
      const { res, formObj } = await resolveFor(args);
      const out = publicResolution(res);
      // the exact launch payload, only where it is one : a whole root form, resolved
      out.formFingerprint = sha256(formObj);
      if (res.complete && !args.subform && !args.field) {
        const payload = launchPayload(res, formObj);
        out.modeledExtravars = payload.preview;
        // the same, the word a Rundeck job uses
        out.modeledPayload = payload.preview;
        out.credentials = payload.credentials;
        out.payloadHash = payload.payloadHash;
      }
      return out;
    },

    async launchJob({ form, values, verbose, expectedPayloadHash }) {
      refuseWhenReadOnly();
      const ready = await readyToLaunch({ form, values, verbose, expectedPayloadHash });
      const job = await Job.launch({
        form: ready.formObj.name,
        user,
        credentials: ready.credentials,
        extravars: ready.extravars,
        rawFormData: ready.rawFormData,
        fromClient: true,
        // resolved and validated above ; the REST launch guard need not do it again
        validated: true,
      });
      return { id: job?.id, form: ready.formObj.name, payloadHash: ready.payloadHash, warnings: ready.warnings };
    },

    async planJob({ form, values, run_at: runAt, name, verbose, expectedPayloadHash }) {
      refuseWhenReadOnly('jobs cannot be planned through it');
      if (!mayPlan) throw new ToolError('You do not have permission to plan jobs (the allowPlannedJobs role option)', 'access_denied');
      const when = momentOf(runAt);
      if (!String(name ?? '').trim()) throw new ToolError('A planned job needs a name', 'invalid_request');
      const ready = await readyToLaunch({ form, values, verbose, expectedPayloadHash });
      // Run later on the form : a one-time run as this user, checked again when it fires
      const id = await stored(String(name).trim(), () => Schedule.plan(user, {
        name: String(name).trim(),
        form: ready.formObj.name,
        one_time_run: true,
        run_at: when.toISOString(),
        extra_vars: yaml.stringify(ready.extravars),
        raw_form_data: ready.rawFormData,
      }));
      const row = await registered(id);
      return { id: row.id, name: row.name, form: ready.formObj.name, ...(await bothClocks(when)), payloadHash: ready.payloadHash, warnings: ready.warnings };
    },

    async createSchedule({ form, name, cron: cronGiven, run_at: runAt, extraVars }) {
      refuseWhenReadOnly('schedules cannot be created through it');
      // a blank cron is none : it would store a schedule that never runs
      const cronExpr = String(cronGiven ?? '').trim();
      if (!mayManage) throw new ToolError('You do not have permission to create schedules (the allowScheduledJobs role option)', 'access_denied');
      if (!String(name ?? '').trim()) throw new ToolError('A schedule needs a name', 'invalid_request');
      if (!!cronExpr === !!runAt) throw new ToolError('Give one of cron (a recurring schedule) or run_at (one run), not both and not neither', 'invalid_request');
      const { formObj } = await loadForm(form);
      if (formObj.type === 'subform') throw new ToolError(`'${formObj.name}' is a subform and cannot be scheduled on its own`, 'unsupported');
      const data = { name: String(name).trim(), form: formObj.name, extra_vars: yaml.stringify(extraVars || {}) };
      let when = null;
      if (cronExpr) {
        const problem = cronError(cronExpr);
        if (problem) throw new ToolError(`Not a cron schedule : ${problem}`, 'invalid_request');
        Object.assign(data, { cron: cronExpr, one_time_run: false });
      } else {
        when = momentOf(runAt);
        Object.assign(data, { one_time_run: true, run_at: when.toISOString() });
      }
      const row = await registered(await stored(data.name, () => Schedule.create(data)));
      return { ...scheduleSummary(row), ...(when ? await bothClocks(when) : {}) };
    },

    async listSchedules({ form } = {}) {
      if (!mayManage && !mayPlan) throw new ToolError('You do not have permission to see schedules', 'access_denied');
      const names = await offeredFormNames();
      const rows = (await Schedule.findAll()) || [];
      const schedules = rows
        .filter((r) => mayManage || isMine(r))
        .filter((r) => !names || names.has(r.form))
        .filter((r) => !form || r.form === form)
        .map(scheduleSummary);
      return { schedules, scope: mayManage ? 'all' : 'mine' };
    },

    async getSchedule({ id }) {
      const row = await visibleSchedule(id);
      // its extra vars as a job's are shown : secret-looking keys and the form's password fields masked
      let stored;
      try {
        stored = yaml.parse(row.extra_vars || '{}') || {};
      } catch {
        stored = {};
      }
      const extravars = parseJson(await Job.maskExtravars(row.form, JSON.stringify(stored)), {});
      return { ...scheduleSummary(row), extravars, output: row.output || '' };
    },

    async deleteSchedule({ id }) {
      refuseWhenReadOnly('schedules cannot be deleted through it');
      const row = await visibleSchedule(id);
      await Schedule.delete(row.id);
      cron?.removeSchedule?.(row.id);
      return { id: row.id, name: row.name, deleted: true };
    },

    async relaunchJob({ id, values, verbose, preview, expectedPayloadHash }) {
      if (!preview) refuseWhenReadOnly();
      // the job's form must be one MCP offers
      if (policy.chatFormsOnly) {
        const job = await Job.findById(user, id, true, true);
        await loadForm(job.form);
      }
      if (verbose && !user?.options?.allowVerboseMode) {
        throw new ToolError('You do not have permission to run jobs in verbose mode', 'access_denied');
      }
      const out = await Job.relaunchWithValues({ user, id, values: values || {}, verbose: !!verbose, preview: !!preview, expectedPayloadHash });
      if (preview) {
        const { extravars, ...rest } = out;
        return { job: id, ...rest, modeledExtravars: extravars, modeledPayload: extravars };
      }
      return { id: out?.id, relaunchOf: id, payloadHash: out?.payloadHash, warnings: out?.warnings || [] };
    },

    async getJob({ id, tail }) {
      const job = await Job.findById(user, id, true, true);
      // a job of a form MCP does not offer is not found either
      if (policy.chatFormsOnly) await loadForm(job.form).catch(() => {
        throw new ToolError(`Job ${id} not found or you do not have access to it`, 'not_found');
      });
      return {
        id: job.id,
        form: job.form,
        status: job.status,
        step: job.step,
        start: job.start,
        end: job.end,
        user: job.user,
        job_type: job.job_type,
        parent_id: job.parent_id,
        subjobs: String(job.subjobs || '').split(',').filter((x) => x !== '').map((x) => parseInt(x, 10)),
        // masked by findById(logSafe) ; credentials are never part of the answer
        extravars: parseJson(job.extravars, {}),
        // the same, the word a Rundeck job uses
        payload: parseJson(job.extravars, {}),
        output: lastLines(job.output || '', tail),
      };
    },
  };
}

const valuesSchema = z.record(z.string(), z.any())
  .describe('Raw field values keyed by field name. A choice field takes the selected option record, a partial record or its valueColumn value (an array of those when multiple).');

/**
 * Wrap a handler : the result as JSON text and as structured content, a refusal as a tool
 * error carrying `{ code, message, ...details }`, no stack traces.
 */
/**
 * A handler's refusal as `{ code, message, ...details }` - the MCP tool error, and what the
 * chat assistant hands its model. One mapping, so both speak the same codes.
 */
export function describeError(err) {
  if (err instanceof ToolError) {
    return { code: err.code, message: err.message, ...err.details };
  }
  if (typeof err?.code === 'string' && /^[a-z_]+$/.test(err.code) && KNOWN_ERRORS[err?.name]) {
    // a model error that names its own tool code (Job.relaunchWithValues)
    return { code: err.code, message: err.message, ...(err.details || {}) };
  }
  if (KNOWN_ERRORS[err?.name]) {
    return { code: KNOWN_ERRORS[err.name], message: err.message };
  }
  if (err?.statusCode) {
    return { code: err.statusCode === 403 ? 'access_denied' : err.statusCode === 404 ? 'not_found' : 'invalid_request', message: err.message };
  }
  return { code: 'internal_error', message: `Internal error : ${err?.message || err}` };
}

function wrap(fn) {
  return async (args) => {
    try {
      const result = await fn(args || {});
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (err) {
      const error = describeError(err);
      return { isError: true, content: [{ type: 'text', text: error.message }], structuredContent: error };
    }
  };
}

/**
 * Register every tool on an McpServer, bound to one user's handlers. Read only (the MCP
 * settings), the tools that launch, plan or change are not offered at all - the handlers refuse
 * them too. The schedule tools are offered as the user's role options allow them.
 */
export function registerTools(server, handlers, policy = {}, user = {}) {
  const options = user?.options || {};
  server.registerTool('list_forms', {
    title: 'List forms',
    description: 'The forms the authenticated user may use, with their description and categories.',
    inputSchema: {},
    annotations: { readOnlyHint: true },
  }, wrap(() => handlers.listForms()));

  server.registerTool('get_form', {
    title: 'Get form',
    description: 'The full definition of one form : its fields (type, label, required, regex, default, '
      + 'dependencies, and per field `dynamic` and `dependsOn`), subforms, constants and varsFiles data. '
      + 'Use it to understand the form ; use resolve_field to evaluate it.',
    inputSchema: { name: z.string().describe('Form name, as returned by list_forms') },
    annotations: { readOnlyHint: true },
  }, wrap((a) => handlers.getForm(a)));

  server.registerTool('resolve_field', {
    title: 'Resolve form fields',
    description: 'Evaluate a form for the values filled in so far, in dependency order : which fields are '
      + 'visible, their defaults, computed expression and query values, and the options of every choice '
      + 'field. Fields whose inputs are not there yet come back as `waiting` with `waitingFor`. '
      + '`missing` lists fields that need a value from you ; `invalid` lists choices that are not among the '
      + 'options and fields that fail a validation rule of the form (regex, minValue/maxValue, '
      + 'minLength/maxLength, sameAs, in/notIn, validIf/validIfNot, ...), each described in `validationErrors` '
      + 'with the message the browser shows ; `complete` is true when the form can be launched. A choice may be sent as the option '
      + 'record, a partial record or its valueColumn value - it is replaced by the full option. When '
      + 'complete, the answer holds `modeledExtravars` (passwords masked) and `credentials` exactly as '
      + 'launch_job will submit them, and a `payloadHash` to pass to launch_job. Pass `field` to resolve '
      + 'only that field and what it depends on. Call it again after every answer.',
    inputSchema: {
      form: z.string().describe('Form name'),
      values: valuesSchema.optional(),
      field: z.string().optional().describe('Resolve only this field (and its dependencies)'),
      subform: z.string().optional().describe('Resolve a subform of the form (a list row or wizard step)'),
      parent: valuesSchema.optional().describe('Parent form values, available to a subform as __parent__'),
      maxOptions: z.number().int().positive().max(5000).optional().describe('Cap on options returned per field (default 200)'),
    },
    annotations: { readOnlyHint: true },
  }, wrap((a) => handlers.resolveField(a)));

  if (!policy.readOnly) server.registerTool('launch_job', {
    title: 'Launch job',
    description: 'Launch the form with the given values, exactly as a browser submission would : the form '
      + 'is resolved and validated first and the launch is refused while fields are missing, invalid, fail '
      + 'validation or are unresolved '
      + '(code `form_incomplete`), or when `expectedPayloadHash` no longer matches (code '
      + '`payload_mismatch`). Returns the job id. Runs the automation behind the form - confirm the '
      + 'modeledExtravars from resolve_field with the user before calling it.',
    inputSchema: {
      form: z.string().describe('Form name'),
      values: valuesSchema,
      verbose: z.boolean().optional().describe('Verbose ansible output (needs the allowVerboseMode role option)'),
      expectedPayloadHash: z.string().optional().describe('The payloadHash resolve_field returned for the approved values ; the launch is refused when the payload differs'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, wrap((a) => handlers.launchJob(a)));

  if (!policy.readOnly) server.registerTool('relaunch_job', {
    title: 'Relaunch job with changes',
    description: 'Launch a job again with some fields changed : the values the job was launched with, '
      + 'with `values` laid over them, are resolved and validated like launch_job and launched as a new '
      + 'job by you. Uploads of the original are reused. Without `values` it replays the job as it ran '
      + '(unless the form is under launch validation enforce). A relaunch through the check is refused '
      + 'for a password field the form shows - passwords are never stored with the values. Call it with `preview: true` '
      + 'first : that returns `modeledExtravars` (passwords masked), `credentials` and a `payloadHash` '
      + 'without launching - confirm them with the user, then call again with `expectedPayloadHash`. '
      + 'Refused while fields are missing, invalid or fail validation (code `form_incomplete`), for a '
      + 'wizard form or a shown password field (`unsupported`), with changes for a job that stored no form values, such as one a schedule launched (`no_form_data`), or when the payload changed (`payload_mismatch`).',
    inputSchema: {
      id: z.number().int().positive().describe('Id of the job to relaunch'),
      values: valuesSchema.optional().describe('Only the fields to change, as raw values ; the rest is taken from the job'),
      verbose: z.boolean().optional().describe('Verbose ansible output (needs the allowVerboseMode role option)'),
      preview: z.boolean().optional().describe('Resolve and build the payload only, do not launch'),
      expectedPayloadHash: z.string().optional().describe('The payloadHash of the confirmed preview ; the relaunch is refused when the payload differs'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, wrap((a) => handlers.relaunchJob(a)));

  // ─── schedules (#1069) ───
  if (!policy.readOnly && options.allowPlannedJobs) server.registerTool('plan_job', {
    title: 'Plan a job (Run later)',
    description: 'Run the form once, later, as you : what Run later does on the form. The values are resolved '
      + 'and validated like launch_job now, and checked again when the run fires. `run_at` is an ISO 8601 '
      + 'time WITH its offset or Z (2026-10-15T22:00:00+02:00) ; a time without a zone is refused. The answer '
      + 'gives the run time in UTC and on the app\'s clock. Refused while the form is incomplete (code '
      + '`form_incomplete`) or when `expectedPayloadHash` no longer matches (`payload_mismatch`). Confirm the '
      + 'modeledExtravars from resolve_field and the time with the user before calling it.',
    inputSchema: {
      form: z.string().describe('Form name'),
      values: valuesSchema,
      run_at: z.string().describe('When to run it : ISO 8601 with its offset or Z'),
      name: z.string().min(1).max(255).describe('A name for the planned run, as listed under Jobs > Scheduled ; names are unique'),
      verbose: z.boolean().optional().describe('Verbose ansible output (needs the allowVerboseMode role option)'),
      expectedPayloadHash: z.string().optional().describe('The payloadHash resolve_field returned for the approved values'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, wrap((a) => handlers.planJob(a)));

  if (!policy.readOnly && options.allowScheduledJobs) server.registerTool('create_schedule', {
    title: 'Create schedule',
    description: 'A schedule of a form, as in Settings > Schedules : recurring with `cron` (five fields, such as '
      + '"0 22 * * 1-5"), or one run with `run_at` (ISO 8601 with its offset or Z). It runs as the Schedule '
      + 'Service with the given extra vars, NOT as you and without the form\'s validation - to run a form '
      + 'once as yourself, use plan_job.',
    inputSchema: {
      form: z.string().describe('Form name'),
      name: z.string().min(1).max(255).describe('A name for the schedule ; names are unique'),
      cron: z.string().optional().describe('A cron expression, for a recurring schedule'),
      run_at: z.string().optional().describe('One run at this time : ISO 8601 with its offset or Z'),
      extraVars: z.record(z.string(), z.any()).optional().describe('The extra vars the job gets'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, wrap((a) => handlers.createSchedule(a)));

  if (options.allowPlannedJobs || options.allowScheduledJobs) {
    server.registerTool('list_schedules', {
      title: 'List schedules',
      description: 'The schedules you may see : with allowScheduledJobs all of them, else the runs you planned. '
        + 'Per schedule its form, when it runs (runAt or cron, nextRun), whether it runs as you (planned) and how '
        + 'its last run went.',
      inputSchema: { form: z.string().optional().describe('Only the schedules of this form') },
      annotations: { readOnlyHint: true },
    }, wrap((a) => handlers.listSchedules(a)));

    server.registerTool('get_schedule', {
      title: 'Get schedule',
      description: 'One schedule, with its extra vars (secret-looking ones masked) and the output of its last run.',
      inputSchema: { id: z.number().int().positive().describe('Schedule id') },
      annotations: { readOnlyHint: true },
    }, wrap((a) => handlers.getSchedule(a)));

    if (!policy.readOnly) server.registerTool('delete_schedule', {
      title: 'Delete schedule',
      description: 'Cancel a planned run or delete a schedule you may see ; it does not run any more.',
      inputSchema: { id: z.number().int().positive().describe('Schedule id') },
      annotations: { readOnlyHint: false, destructiveHint: true },
    }, wrap((a) => handlers.deleteSchedule(a)));
  }

  server.registerTool('get_job', {
    title: 'Get job',
    description: 'Status and output of a job. Secret-looking extravars are masked ; credentials are never returned.',
    inputSchema: {
      id: z.number().int().positive().describe('Job id'),
      tail: z.number().int().positive().optional().describe('Only the last N lines of output'),
    },
    annotations: { readOnlyHint: true },
  }, wrap((a) => handlers.getJob(a)));
}

export default { createHandlers, registerTools, describeError, ToolError };
