'use strict';
import YAML from 'yaml';
import { replacePlaceholderInString } from './placeholders.js';
import { req, requiredReq, humanFileSize } from './values.js';

/**
 * Field validation rules, shared by the browser (vuelidate, through
 * client/src/lib/validationRules.js), the MCP server and the launch API.
 *
 * Ported rule for rule from the `rules` computed that AppForm.vue held before 6.4, and pinned
 * to it by the golden fixtures (server/tests/golden/formEngine) that were captured by running
 * that code : same rules, same order (the browser shows the FIRST error), same messages,
 * same quirks - e.g. a static limit is not NaN-guarded, `sameAs` compares loosely, and
 * every rule but `required` passes an empty value (vuelidate's untrimmed `req`).
 *
 * Deliberate difference : a required checkbox reports type `checkboxRequired`, where
 * vuelidate's `sameAs(true)` reported `sameAs`.
 *
 * A rule is { type, test(value, ctx), description(value, ctx) } with
 *   ctx = { values, fieldOptions, isReady, resolve?, warn?, secretNames? }
 *   resolve(text) -> { value }   placeholder resolution ; defaults to the engine's
 *   warn(message)                a placeholder limit that resolved to a non-number
 *   secretNames                  fields whose value must never end up in a description
 */

export const PLACEHOLDER_RE = /\$\(([^)]+)\)/;

function resolveText(text, ctx) {
  const r = ctx.resolve ? ctx.resolve(text) : replacePlaceholderInString(text, ctx, false);
  return r?.value;
}

/** a description placeholder must not print a password */
function describeCtx(ctx) {
  const secrets = ctx.secretNames || [];
  if (!secrets.length || ctx.resolve) return ctx;
  const values = { ...ctx.values };
  for (const n of secrets) if (values[n] !== undefined && values[n] !== null && values[n] !== '') values[n] = '********';
  return { ...ctx, values };
}

function describe(text, ctx) {
  const v = resolveText(text, describeCtx(ctx));
  return v !== undefined ? v : text;
}

/**
 * minValue / maxValue / minLength / maxLength / minSize / maxSize : a number, or a string
 * holding a placeholder resolved at validation time (unresolvable or non-numeric : passes).
 */
function limitRule({ type, raw, subject, compare, message, sizeFormat = false }) {
  const hasPlaceholder = typeof raw === 'string' && PLACEHOLDER_RE.test(raw);
  if (!hasPlaceholder) {
    const n = Number(raw);
    return {
      type,
      test: (value) => !req(subject(value)) || compare(value, n),
      description: (value) => message(value, n),
    };
  }
  return {
    type,
    test: (value, ctx) => {
      if (!req(subject(value))) return true;
      const resolved = resolveText(String(raw), ctx);
      if (resolved === undefined) return true;
      const n = Number(resolved);
      if (isNaN(n)) {
        ctx.warn?.(`${type} placeholder resolved to non-numeric value: ${resolved}`);
        return true;
      }
      return compare(value, n);
    },
    description: (value, ctx) => {
      const resolved = resolveText(String(raw), describeCtx(ctx));
      const shown = resolved !== undefined ? (sizeFormat ? Number(resolved) : resolved) : raw;
      return message(value, shown);
    },
  };
}

/**
 * The rules of one field, in the order the browser registered them.
 * @returns {{ rules: object[], warnings: string[] }}  warnings : a regex that cannot be used
 */
export function compileFieldRules(field, allFields = []) {
  const rules = [];
  const warnings = [];
  const ff = field || {};
  const label = ff.label || ff.name;
  const type = ff.type;

  // required - per type ; a yaml field's own required replaces the generic one
  if (ff.required) {
    if (type === 'checkbox') {
      rules.push({ type: 'checkboxRequired', test: (v) => v === true, description: () => `${label} is required` });
    } else if (type === 'expression' || type === 'enum') {
      rules.push({
        type: 'required',
        test: (v) => (v != undefined && v != null && v != '__auto__' && v != '__none__' && v != '__all__'),
        description: () => `${label} is required`,
      });
    } else if (type === 'yaml') {
      rules.push({ type: 'required', test: (v) => v != undefined && v != null, description: () => `${label} is required` });
    } else {
      rules.push({ type: 'required', test: (v) => requiredReq(v), description: () => `${label} is required` });
    }
  }

  if (type === 'yaml') {
    const text = ff.yamlError?.description || `${label} must be valid YAML`;
    rules.push({
      type: 'validYaml',
      test: (v) => {
        if (!v) return true;
        if (typeof v === 'object') return true;
        try {
          YAML.parse(String(v));
          return true;
        } catch {
          return false;
        }
      },
      description: (v, ctx) => describe(text, ctx),
    });
  }

  if (type === 'file') {
    const fileName = (file) => file?.name;
    if ('minSize' in ff) {
      rules.push(limitRule({
        type: 'minSize', raw: ff.minSize, subject: fileName, sizeFormat: true,
        compare: (file, n) => file?.size >= n,
        message: (file, n) => `Size (${humanFileSize(file?.size)}) cannot be lower than ${humanFileSize(n)}`,
      }));
    }
    if ('maxSize' in ff) {
      rules.push(limitRule({
        type: 'maxSize', raw: ff.maxSize, subject: fileName, sizeFormat: true,
        compare: (file, n) => file?.size <= n,
        message: (file, n) => `Size (${humanFileSize(file?.size)}) cannot be higher than ${humanFileSize(n)}`,
      }));
    }
  }

  const self = (v) => v;
  if ('minValue' in ff) {
    rules.push(limitRule({ type: 'minValue', raw: ff.minValue, subject: self,
      compare: (v, n) => v >= n, message: (v, n) => `${label} must be at least ${n}` }));
  }
  if ('maxValue' in ff) {
    rules.push(limitRule({ type: 'maxValue', raw: ff.maxValue, subject: self,
      compare: (v, n) => v <= n, message: (v, n) => `${label} must be at most ${n}` }));
  }
  if ('minLength' in ff) {
    rules.push(limitRule({ type: 'minLength', raw: ff.minLength, subject: self,
      compare: (v, n) => v.length >= n, message: (v, n) => `${label} must be at least ${n} characters long` }));
  }
  if ('maxLength' in ff) {
    rules.push(limitRule({ type: 'maxLength', raw: ff.maxLength, subject: self,
      compare: (v, n) => v.length <= n, message: (v, n) => `${label} must be at most ${n} characters long` }));
  }

  if ('regex' in ff) {
    // `regex: "^prod-"` (a bare string) is used as the pattern, without a description
    const source = (ff.regex && typeof ff.regex === 'object') ? ff.regex.expression : ff.regex;
    let re = null;
    if (typeof source !== 'string' || !source) {
      warnings.push(`Field '${ff.name}': regex must be given as { expression: "...", description: "..." }; the rule is ignored.`);
    } else {
      try {
        re = new RegExp(source);
      } catch (e) {
        warnings.push(`Field '${ff.name}': the regex '${source}' is not valid (${e.message}); the rule is ignored.`);
      }
    }
    if (re) {
      const text = ff.regex?.description;
      rules.push({
        type: 'regex',
        test: type === 'file'
          ? (file) => !req(file?.name) || re.test(file?.name)
          : (v) => !req(v) || re.test(v),
        description: (v, ctx) => describe(text, ctx),
      });
    }
  }

  if ('validIf' in ff) {
    const cfg = ff.validIf || {};
    rules.push({ type: 'validIf', test: (v, ctx) => !req(v) || !!ctx.values?.[cfg.field],
      description: (v, ctx) => describe(cfg.description, ctx) });
  }
  if ('validIfNot' in ff) {
    const cfg = ff.validIfNot || {};
    rules.push({ type: 'validIfNot', test: (v, ctx) => !req(v) || !ctx.values?.[cfg.field],
      description: (v, ctx) => describe(cfg.description, ctx) });
  }
  if ('notIn' in ff) {
    const cfg = ff.notIn || {};
    rules.push({
      type: 'notIn',
      test: (v, ctx) => {
        const t = ctx.values?.[cfg.field];
        return !req(v) || (t != undefined && Array.isArray(t) && !t.includes(v));
      },
      description: (v, ctx) => describe(cfg.description, ctx),
    });
  }
  if ('in' in ff) {
    const cfg = ff.in || {};
    rules.push({
      type: 'in',
      test: (v, ctx) => {
        const t = ctx.values?.[cfg.field];
        return !req(v) || (t != undefined && Array.isArray(t) && t.includes(v));
      },
      description: (v, ctx) => describe(cfg.description, ctx),
    });
  }
  if ('sameAs' in ff) {
    // a sameAs naming a field that is not on the form falls back to the name it was given
    const target = (allFields || []).find((x) => ff.sameAs == x?.name);
    const text = `Must match the field '${target?.label || ff.sameAs}'`;
    rules.push({
      type: 'sameAs',
      test: (v, ctx) => {
        const t = ctx.values?.[ff.sameAs];
        return !req(v) || (t != undefined && v == t);
      },
      description: () => text,
    });
  }

  return { rules, warnings };
}

/**
 * The failing rules of one field, in rule order.
 * @returns {{ errors: {type, description}[], warnings: string[] }}
 */
export function validateField(field, value, ctx = {}, allFields = []) {
  const { rules, warnings } = compileFieldRules(field, allFields);
  const runCtx = { ...ctx, warn: (m) => warnings.push(m) };
  const errors = [];
  for (const rule of rules) {
    if (!rule.test(value, runCtx)) {
      const d = rule.description(value, runCtx);
      errors.push({ type: rule.type, description: d === undefined || d === null ? '' : String(d) });
    }
  }
  return { errors, warnings };
}

export default { PLACEHOLDER_RE, compileFieldRules, validateField };
