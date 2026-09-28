'use strict';
import { z } from 'zod';
import { resolveForm, normalizeFields, isDynamicField } from '../lib/formEngine/resolve.js';
import { scanDependencies } from '../lib/formEngine/placeholders.js';
import { buildFormOutput, collectCredentials, filterRawFormData } from '../lib/formEngine/output.js';

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

export class ToolError extends Error {}

const KNOWN_ERRORS = ['AccessDeniedError', 'NotFoundError', 'ConflictError', 'BadRequestError', 'ForbiddenError'];

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
 * @param {object} args.deps  { Form, Job, Expression, Query, resolveFormQuery }
 */
export function createHandlers({ user, deps }) {
  const { Form, Job, Expression, Query, resolveFormQuery } = deps;
  const roles = user?.roles || [];

  async function loadForm(name) {
    const formConfig = await Form.load(roles, name);
    const formObj = formConfig?.forms?.[0];
    if (!formObj) throw new ToolError(`Form '${name}' not found or you do not have access to it`);
    return { formConfig, formObj };
  }

  function servicesFor(formConfig, formObj, subformName) {
    return {
      serverExpression: (expression, field) => Expression.execute(expression, !!field.noLog),
      query: async (field, resolved) => {
        const q = await resolveFormQuery({
          user,
          formName: formObj.name,
          subformName,
          fieldName: field.name,
          values: resolved,
          formConfig,
        });
        return Query.findAll(q.query, q.jq, q.config, !!field.noLog, q.values);
      },
    };
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
        + 'Wizard forms cannot be launched through MCP yet.');
    }
    if (subform) {
      target = (formObj.subforms || []).find((s) => s?.name === subform);
      if (!target) throw new ToolError(`Subform '${subform}' is not part of form '${formObj.name}'`);
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
    });
    return { res, formConfig, formObj };
  }

  return {
    async listForms() {
      const cfg = await Form.load(roles);
      return {
        forms: (cfg?.forms || []).map((f) => ({
          name: f.name,
          description: f.description || '',
          categories: f.categories || [],
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
      const { res } = await resolveFor(args);
      return publicResolution(res);
    },

    async launchJob({ form, values, verbose }) {
      const { formConfig, formObj } = await loadForm(form);
      if (formObj.type === 'subform') {
        throw new ToolError(`'${formObj.name}' is a subform and cannot be launched on its own`);
      }
      if (Array.isArray(formObj.wizard) && formObj.wizard.length > 0) {
        throw new ToolError(`'${formObj.name}' is a wizard form ; wizard forms cannot be launched through MCP yet`);
      }
      if (verbose && !user?.options?.allowVerboseMode) {
        throw new ToolError('You do not have permission to run jobs in verbose mode');
      }
      const res = await resolveForm({
        form: formObj,
        constants: formConfig.constants || {},
        vars: formObj.vars || {},
        user,
        values: values || {},
        services: servicesFor(formConfig, formObj),
      });
      if (!res.complete) {
        const parts = [];
        if (res.missing.length) parts.push(`missing input for : ${res.missing.join(', ')}`);
        if (res.waiting.length) parts.push(`not resolvable yet : ${res.waiting.join(', ')}`);
        throw new ToolError(`The form is not complete - ${parts.join(' ; ')}. Call resolve_field to see what is needed.`);
      }
      const files = res._fields.filter((f) => f.type === 'file' && res._visibility[f.name]
        && res._values[f.name] !== undefined && res._values[f.name] !== null && res._values[f.name] !== '');
      if (files.length) {
        throw new ToolError(`File fields cannot be filled through MCP (${files.map((f) => f.name).join(', ')})`);
      }
      const extravars = buildFormOutput(res._fields, res._values, {
        isVisible: (f) => !!res._visibility[f.name],
        subforms: formObj.subforms || [],
      });
      if (verbose) extravars.__verbose__ = true;
      const credentials = collectCredentials(res._fields, extravars);
      const rawFormData = filterRawFormData(res._fields, res._values);
      const job = await Job.launch({
        form: formObj.name,
        user,
        credentials,
        extravars,
        rawFormData,
        fromClient: true,
      });
      return { id: job?.id, form: formObj.name, warnings: res.warnings };
    },

    async getJob({ id, tail }) {
      const job = await Job.findById(user, id, true, true);
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
        output: lastLines(job.output || '', tail),
      };
    },
  };
}

const valuesSchema = z.record(z.string(), z.any())
  .describe('Raw field values keyed by field name, as the browser holds them (an enum takes the selected option or its valueColumn value).');

/** Wrap a handler : JSON text out, model errors as tool errors, no stack traces. */
function wrap(fn) {
  return async (args) => {
    try {
      const result = await fn(args || {});
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      const known = err instanceof ToolError || KNOWN_ERRORS.includes(err?.name) || err?.statusCode;
      const message = known ? err.message : `Internal error : ${err?.message || err}`;
      return { isError: true, content: [{ type: 'text', text: message }] };
    }
  };
}

/** Register every tool on an McpServer, bound to one user's handlers. */
export function registerTools(server, handlers) {
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
      + '`missing` lists fields that need a value from you ; `complete` is true when the form can be '
      + 'launched. Pass `field` to resolve only that field and what it depends on. Call it again after '
      + 'every answer.',
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

  server.registerTool('launch_job', {
    title: 'Launch job',
    description: 'Launch the form with the given values, exactly as a browser submission would : the form '
      + 'is resolved first and the launch is refused while fields are missing or unresolved. Returns the '
      + 'job id. Runs the automation behind the form - confirm with the user before calling it.',
    inputSchema: {
      form: z.string().describe('Form name'),
      values: valuesSchema,
      verbose: z.boolean().optional().describe('Verbose ansible output (needs the allowVerboseMode role option)'),
    },
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, wrap((a) => handlers.launchJob(a)));

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

export default { createHandlers, registerTools, ToolError };
