'use strict';
import {
  replacePlaceholderInString,
  scanDependencies,
  checkDependencies,
  rootFieldName,
} from './placeholders.js';
import { evalSandbox } from './sandbox.js';

/**
 * Stateless resolution of a form for a non-browser client (the MCP server).
 *
 * The caller hands in the values it has filled in so far ; this works out, in dependency
 * order, everything that follows from them : which fields are shown, the defaults, the
 * computed expression/query values and the options of every enum. It is the way a person
 * fills in a form - first what depends on nothing, then whatever became available - done
 * in one pass per call instead of the browser's reactive interval loop
 * (client/src/components/AppForm.vue startDynamicFieldsLoop), whose per-field semantics it
 * mirrors : the same readiness gate, the same "default on failure", the same result
 * handling per field type.
 *
 * Nothing here talks to a database or the expression endpoint directly : the caller passes
 * `services`, which keeps the RBAC-bound lookups in one place (mcp/tools.js) and makes this
 * testable without them.
 *
 * Deliberate differences with the browser, both toward safety :
 *   - an `evalDefault` default is substituted in 'expression' mode (values become JS
 *     literals). The browser pastes them raw, which on a server would let a caller's value
 *     become code.
 *   - an enum's `__auto__` default is never turned into the first option : the caller has
 *     to choose, and the field is reported as needing input.
 */

const DYNAMIC_TYPES = ["expression", "enum", "table", "html", "yaml", "list", "query"];
const VALUE_TYPES = ["expression", "html", "yaml", "table", "list"];   // the expression yields the VALUE
const OPTION_TYPES = ["enum", "query"];                                // the expression yields the OPTIONS
const SENTINELS = ['__auto__', '__none__', '__all__'];
export const DEFAULT_MAX_OPTIONS = 200;

/** The browser's type aliases (AppForm.vue initForm), on a copy - never on the loaded definition. */
export function normalizeFields(fields) {
  return (fields || []).filter((f) => f && f.name).map((f) => {
    const item = { ...f };
    if (item.type == "local") {
      item.hide = item.hide ?? true;
      item.output = item.output ?? (item.noOutput !== undefined ? !item.noOutput : false);
      item.type = "expression";
      item.runLocal = true;
    }
    if (item.type == "local_out") {
      item.hide = item.hide ?? true;
      item.type = "expression";
      item.runLocal = true;
    }
    if (item.type == "credential") {
      item.hide = item.hide ?? true;
      item.asCredential = true;
      item.type = "expression";
      item.runLocal = true;
    }
    if (item.type == "html") {
      item.runLocal = true;
    }
    return item;
  });
}

export function isDynamicField(f) {
  return DYNAMIC_TYPES.includes(f.type) && !!(f.expression ?? f.query ?? f.value ?? false);
}

function isEmptyValue(value, type) {
  if (type === 'checkbox') return value !== true;
  if (value === undefined || value === null || value === '') return true;
  if (SENTINELS.includes(value)) return true;
  if (Array.isArray(value) && value.length === 0 && type !== 'enum' && type !== 'expression') return true;
  return false;
}

function optionMatches(option, value, valueColumn) {
  if (option && value && typeof option === "object" && typeof value === "object") {
    if (valueColumn && valueColumn in option && valueColumn in value) return option[valueColumn] === value[valueColumn];
    return JSON.stringify(option) === JSON.stringify(value);
  }
  if (option && typeof option === "object") {
    const key = (valueColumn && valueColumn in option) ? valueColumn : Object.keys(option)[0];
    return option[key] === value;
  }
  return option === value;
}

/**
 * @param {object} args
 * @param {object} args.form           the form (or subform) definition, as Form.load returns it
 * @param {object} [args.constants]    config constants
 * @param {object} [args.vars]         varsFiles data (form.vars)
 * @param {object} [args.user]         the authenticated user, injected as __user__
 * @param {object} [args.parent]       parent form values, injected as __parent__ (subforms)
 * @param {object} [args.values]       the caller's raw field values
 * @param {string} [args.only]         resolve just this field and what it depends on
 * @param {number} [args.maxOptions]   cap on the options returned per field
 * @param {object} args.services
 * @param {function} args.services.serverExpression  (expression, field) => Promise<result>
 * @param {function} args.services.query             (field, resolvedPlaceholders) => Promise<result>
 */
export async function resolveForm({
  form,
  constants = {},
  vars = {},
  user = undefined,
  parent = undefined,
  values = {},
  only = undefined,
  maxOptions = DEFAULT_MAX_OPTIONS,
  services,
}) {
  const fields = normalizeFields(form?.fields);
  const byName = Object.fromEntries(fields.map((f) => [f.name, f]));
  const input = (values && typeof values === 'object' && !Array.isArray(values)) ? values : {};
  const warnings = [];

  if (only && !byName[only]) {
    throw new Error(`Field '${only}' does not exist on form '${form?.name}'`);
  }

  // everything a placeholder can read that is not a field
  const vals = {};
  const fieldOptions = {};
  for (const [k, v] of Object.entries(constants || {})) { vals[k] = v; fieldOptions[k] = { type: "constant" }; }
  for (const [k, v] of Object.entries(vars || {})) { vals[k] = v; fieldOptions[k] = { type: "constant" }; }
  if (user !== undefined) { vals.__user__ = user; fieldOptions.__user__ = { type: "expression" }; }
  if (parent && typeof parent === 'object' && Object.keys(parent).length > 0) {
    vals.__parent__ = parent;
    fieldOptions.__parent__ = { type: "constant" };
  }
  const knownNames = Object.keys(vals);
  for (const f of fields) {
    fieldOptions[f.name] = {
      type: f.type,
      valueColumn: f.valueColumn || "",
      placeholderColumn: f.placeholderColumn || "",
      evalDefault: f.evalDefault ?? false,
    };
    // a field shadows a same-named constant, as in the browser
    delete vals[f.name];
  }

  const graph = scanDependencies(fields, knownNames);
  warnings.push(...graph.warnings);
  const cycle = new Set(graph.cycles);

  // which fields to evaluate : all, or the upstream closure of `only`
  let scope = new Set(fields.map((f) => f.name));
  if (only) {
    scope = new Set([only]);
    const stack = [only];
    while (stack.length) {
      for (const d of graph.dependsOn[stack.pop()] || []) {
        if (!scope.has(d)) { scope.add(d); stack.push(d); }
      }
    }
  }

  const st = {};
  for (const f of fields) st[f.name] = { status: scope.has(f.name) ? 'pending' : 'skipped' };

  const has = (name) => Object.prototype.hasOwnProperty.call(input, name);
  const valueComputed = (f) => isDynamicField(f) && VALUE_TYPES.includes(f.type)
    && !(has(f.name) && (f.editable || f.type === 'list' || f.type === 'table'));
  // `__auto__` on a choice field means "the browser picks" : here the caller picks, always
  const needsInput = (f, value) => !valueComputed(f)
    && ((OPTION_TYPES.includes(f.type) && value === '__auto__') || (!!f.required && isEmptyValue(value, f.type)));

  // a field its dependents may read : shown and evaluated, with its value filled in if required
  const settled = (name) => {
    const s = st[name];
    if (!s) return true;
    if (s.status === 'hidden' || s.status === 'error') return true;
    if (s.status === 'resolved') return !s.needsInput;
    return false;
  };
  const ctx = {
    values: vals,
    fieldOptions,
    isReady: (name) => {
      const s = st[name];
      return !s || s.status === 'resolved' || s.status === 'error';
    },
  };
  const isValid = (name) => st[name]?.status === 'resolved' && !isEmptyValue(vals[name], byName[name]?.type);

  function computeDefault(f) {
    if (f.default === undefined) return undefined;
    const evalDefault = fieldOptions[f.name].evalDefault;
    const r = replacePlaceholderInString(f.default, ctx, false, evalDefault ? 'expression' : 'raw');
    if (r.value === undefined) return undefined;
    if (!evalDefault) return r.value;
    try {
      return evalSandbox(r.value);
    } catch (err) {
      warnings.push(`'${f.name}' : evaluating the default failed : ${err.message}`);
      return undefined;
    }
  }

  function finish(f, patch) {
    const s = st[f.name];
    Object.assign(s, patch);
    s.needsInput = s.status === 'resolved' && needsInput(f, s.value);
    vals[f.name] = s.value;
  }

  async function evaluate(f) {
    const dflt = computeDefault(f);
    const s = st[f.name];
    s.default = dflt;
    const inputValue = has(f.name) ? input[f.name] : undefined;

    if (!isDynamicField(f)) {
      let value = has(f.name) ? inputValue : dflt;
      if (value === undefined && f.type === 'checkbox') value = false;
      if (value === undefined && f.type === 'list') value = [];
      if (f.type === 'enum' && Array.isArray(f.values)) s.options = f.values;
      return finish(f, { status: 'resolved', value, source: has(f.name) ? 'input' : 'default' });
    }

    // a static `value:` on an expression/yaml field
    if (!f.expression && !f.query) {
      const value = (f.type === 'expression' || f.type === 'yaml') ? f.value : (has(f.name) ? inputValue : dflt);
      return finish(f, { status: 'resolved', value, source: 'computed' });
    }

    const computesValue = valueComputed(f);
    if (VALUE_TYPES.includes(f.type) && !computesValue) {
      // editable expression / edited list : the caller's value stands
      return finish(f, { status: 'resolved', value: inputValue, source: 'input' });
    }
    const optionValue = () => (has(f.name) ? inputValue : dflt);
    const fallback = () => (computesValue ? dflt : optionValue());

    const isExpression = !!f.expression;
    const r = replacePlaceholderInString(
      isExpression ? f.expression : f.query, ctx, !!f.ignoreIncomplete, isExpression ? 'expression' : 'raw');
    if (r.value === undefined) {
      warnings.push(`'${f.name}' could not be evaluated : a field it refers to never produced a value (${r.missing.join(', ')})`);
      return finish(f, { status: 'error', error: `unresolved placeholder(s) : ${r.missing.join(', ')}`, value: fallback(), source: 'default' });
    }

    let result;
    try {
      if (isExpression && f.runLocal) {
        const code = (r.value.at(0) == "{" && r.value.at(-1) == "}") ? `Object.assign(${r.value})` : r.value;
        result = evalSandbox(code);
      } else if (isExpression) {
        result = await services.serverExpression(r.value, f);
      } else {
        result = await services.query(f, r.resolved);
      }
    } catch (err) {
      return finish(f, { status: 'error', error: err?.message || String(err), value: fallback(), source: 'default' });
    }

    const patch = { status: 'resolved', source: 'computed' };
    if (isExpression) {
      if (['html', 'expression', 'yaml'].includes(f.type)) patch.value = result;
      if (f.type === 'enum') s.options = [].concat(result ?? []);
      if (f.type === 'table' || f.type === 'list') patch.value = (dflt ? [].concat(dflt) : [].concat(result ?? []));
      if (result == undefined && dflt != undefined && f.type === 'expression') {
        patch.value = dflt;
        patch.source = 'default';
      }
    } else {
      if (f.type === 'query' || f.type === 'enum') s.options = [].concat(result ?? []);
      else if (f.type === 'list') patch.value = [].concat(result ?? []);
      else patch.value = result;
    }
    if (OPTION_TYPES.includes(f.type)) {
      patch.value = optionValue();
      patch.source = has(f.name) ? 'input' : 'default';
      // `__all__` on a multiple select picks every option (BsInputSelectAdvancedTable)
      if (patch.value === '__all__' && f.multiple) {
        patch.value = [...(s.options || [])];
      }
      if (has(f.name) && !isEmptyValue(inputValue, f.type)) {
        const wanted = [].concat(inputValue);
        const vc = f.valueColumn || "";
        if (!wanted.every((v) => SENTINELS.includes(v) || (s.options || []).some((o) => optionMatches(o, v, vc)))) {
          warnings.push(`'${f.name}' : the given value is not one of the available options`);
          patch.notInOptions = true;
        }
      }
    }
    return finish(f, patch);
  }

  // dependency-ordered fill : whatever can be evaluated now, then whatever that unlocked
  const pending = () => fields.filter((f) => st[f.name].status === 'pending');
  const visibilityDeps = (f) => (f.dependencies || [])
    .map((d) => rootFieldName(d?.name?.startsWith('!') ? d.name.slice(1) : d?.name))
    .filter((n) => byName[n]);
  let released = false;
  for (let guard = 0; guard < fields.length * 3 + 10; guard++) {
    let progress = false;
    for (const f of pending()) {
      const exempt = released && (f.ignoreIncomplete || cycle.has(f.name));
      if (f.dependencies) {
        if (!exempt && !visibilityDeps(f).every(settled)) continue;
        if (!checkDependencies(f, vals, fieldOptions, isValid)) {
          st[f.name] = { status: 'hidden', value: undefined, source: 'hidden' };
          vals[f.name] = undefined;
          progress = true;
          continue;
        }
      }
      if (!exempt && !(graph.dependsOn[f.name] || []).every(settled)) continue;
      await evaluate(f);
      progress = true;
    }
    if (progress) { released = false; continue; }
    // stuck : let ignoreIncomplete and cyclic fields go with what there is, once
    if (!released && pending().some((f) => f.ignoreIncomplete || cycle.has(f.name))) {
      released = true;
      continue;
    }
    break;
  }
  for (const f of pending()) {
    st[f.name] = {
      status: 'waiting',
      waitingFor: [...new Set([...(graph.dependsOn[f.name] || []), ...visibilityDeps(f)])].filter((n) => !settled(n)),
    };
  }

  // report
  const out = [];
  for (const f of fields) {
    const s = st[f.name];
    if (s.status === 'skipped') continue;
    const r = {
      name: f.name,
      label: f.label || f.name,
      type: f.type,
      required: !!f.required,
      visible: s.status !== 'hidden',
      status: s.status,
      source: s.source,
    };
    if (s.status === 'resolved' || s.status === 'error') {
      r.value = (f.type === 'password' && s.value) ? '********' : s.value;
      r.needsInput = !!s.needsInput;
    }
    if (s.default !== undefined) r.default = f.type === 'password' ? '********' : s.default;
    if (s.options) {
      r.optionCount = s.options.length;
      r.options = s.options.slice(0, maxOptions);
      if (s.options.length > maxOptions) r.optionsTruncated = true;
    }
    if (s.notInOptions) r.notInOptions = true;
    if (s.error) r.error = s.error;
    if (s.waitingFor) r.waitingFor = s.waitingFor;
    out.push(r);
  }
  const missing = out.filter((r) => r.needsInput).map((r) => r.name);
  const waiting = out.filter((r) => r.status === 'waiting').map((r) => r.name);
  return {
    form: form?.name,
    complete: missing.length === 0 && waiting.length === 0,
    missing,
    waiting,
    fields: out,
    warnings,
    // internal : the raw values and visibility the launch builds its extravars from
    _values: { ...vals },
    _visibility: Object.fromEntries(fields.map((f) => [f.name, st[f.name].status !== 'hidden'])),
    _fields: fields,
  };
}

export default { resolveForm, normalizeFields, isDynamicField, DEFAULT_MAX_OPTIONS };
