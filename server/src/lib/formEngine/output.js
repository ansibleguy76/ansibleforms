'use strict';
import crypto from 'crypto';
import { getFieldValue } from './placeholders.js';

/**
 * Turn raw field values into the extravars a browser submission sends.
 *
 * MIRROR of client/src/lib/Helpers.js buildFormOutput / deepClone and of
 * client/src/pages/form.vue submitForm + getFilteredRawFormData. Keep in sync.
 */

export function deepClone(o) {
  if (o === undefined) return o;
  try {
    return JSON.parse(JSON.stringify(o));
  } catch {
    return undefined;
  }
}

/**
 * @param {object[]} fields
 * @param {object} raw                 name -> raw value
 * @param {object} [opts]
 * @param {function} [opts.isVisible]  (field) => boolean
 * @param {object} [opts.overrides]    name -> value used instead of raw[name]
 * @param {object[]} [opts.subforms]   subform definitions, for list rows
 */
export function buildFormOutput(fields, raw, opts = {}) {
  const isVisible = opts.isVisible || (() => true);
  const overrides = opts.overrides || {};
  const subforms = opts.subforms || [];
  const subformByName = Object.fromEntries((subforms || []).map((s) => [s.name, s]));
  const fd = {};
  (fields || []).forEach((item) => {
    if (!item || !item.name) return;
    if (item.name === '__user__') return;
    if (item.name === '__parent__') return;
    if (item.noOutput || item.output === false) return;
    if (!isVisible(item)) return;

    const outputObject =
      item.outputObject ||
      item.type === 'expression' ||
      item.type === 'file' ||
      item.type === 'table' ||
      item.type === 'list' ||
      item.type === 'yaml' ||
      item.type === 'datetime' ||
      false;

    let outputValue = (item.name in overrides) ? overrides[item.name] : deepClone(raw?.[item.name]);

    if (item.type === 'datetime' && item.dateType === 'month' && outputValue && typeof outputValue === 'object') {
      outputValue = {
        ...outputValue,
        month: typeof outputValue.month === 'number' ? outputValue.month + 1 : outputValue.month,
      };
    }

    if (!outputObject) {
      outputValue = getFieldValue(outputValue, item.valueColumn || '', true);
    }

    if (outputValue && typeof outputValue === 'object' && !Array.isArray(outputValue) && '__output__' in outputValue) {
      outputValue = outputValue.__output__;
    }

    if (item.type === 'list' && Array.isArray(outputValue)) {
      const sub = (typeof item.subform === 'string') ? subformByName[item.subform] : item.subform;
      if (sub && Array.isArray(sub.fields)) {
        outputValue = outputValue.map((row) => buildFormOutput(sub.fields, row || {}, { subforms }));
      }
    }

    const fieldmodel = [].concat(item.model || []);
    if (fieldmodel.length === 0) {
      fd[item.name] = deepClone(outputValue);
      return;
    }

    fieldmodel.forEach((f) => {
      f.split(/\s*\.\s*/).reduce((master, obj, level, arr) => {
        let arrsplit;
        if (level === arr.length - 1) {
          if (obj.match(/.*\[[0-9]+\]$/)) {
            arrsplit = obj.split(/\[([0-9]+)\]$/);
            if (master[arrsplit[0]] === undefined) master[arrsplit[0]] = [];
            if (master[arrsplit[0]][arrsplit[1]] === undefined) master[arrsplit[0]][arrsplit[1]] = {};
            master[arrsplit[0]][arrsplit[1]] = outputValue;
            return master[arrsplit[0]][arrsplit[1]];
          }
          if (master[obj] === undefined) {
            master[obj] = outputValue;
          } else if (typeof master[obj] !== 'object' || master[obj] === null || typeof outputValue !== 'object' || outputValue === null) {
            master[obj] = outputValue;
          } else {
            master[obj] = { ...master[obj], ...outputValue };
          }
          return master[obj];
        }
        if (obj.match(/.*\[[0-9]+\]$/)) {
          arrsplit = obj.split(/\[([0-9]+)\]$/);
          if (master[arrsplit[0]] === undefined) master[arrsplit[0]] = [];
          if (master[arrsplit[0]][arrsplit[1]] === undefined) master[arrsplit[0]][arrsplit[1]] = {};
          return master[arrsplit[0]][arrsplit[1]];
        }
        if (typeof master !== 'object' || master === null) return {};
        if (master[obj] === undefined) master[obj] = {};
        return master[obj];
      }, fd);
    });
  });
  return fd;
}

/** form.vue submitForm : credentials come from the MODELLED output of asCredential fields. */
export function collectCredentials(fields, extravars) {
  const credentials = {};
  (fields || []).filter((f) => f?.asCredential === true).forEach((f) => {
    credentials[f.name] = extravars?.[f.name];
  });
  return credentials;
}

/** form.vue getFilteredRawFormData : the values kept for a relaunch. */
export function filterRawFormData(fields, values) {
  const out = {};
  (fields || []).forEach((field) => {
    const name = field?.name;
    if (!name || !(name in (values || {}))) return;
    if (field.type === 'constant' || field.type === 'password') return;
    if (name === 'server' || name === 'database' || name === 'metadata') return;
    out[name] = values[name];
  });
  return out;
}

/**
 * A copy of `data` with the values of password-typed fields replaced by a mask, for display
 * only. MIRROR of client/src/lib/Helpers.js maskPasswordsForDisplay.
 */
export function maskPasswords(data, fields, subforms = []) {
  if (data == null || !Array.isArray(fields)) return data;
  const cloned = deepClone(data);
  if (cloned == null) return data;
  const subformByName = Object.fromEntries((subforms || []).map((s) => [s.name, s]));
  const MASK = '********';
  const setAtPath = (target, p, value) => {
    const parts = String(p).split('.');
    let cur = target;
    for (let i = 0; i < parts.length - 1; i++) {
      if (cur == null || typeof cur !== 'object') return;
      cur = cur[parts[i]];
    }
    if (cur && typeof cur === 'object') {
      const last = parts[parts.length - 1];
      if (last in cur && cur[last] != null && cur[last] !== '') cur[last] = value;
    }
  };
  const getAtPath = (target, p) => {
    let cur = target;
    for (const part of String(p).split('.')) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = cur[part];
    }
    return cur;
  };
  const walk = (target, fieldDefs) => {
    if (!target || typeof target !== 'object' || !Array.isArray(fieldDefs)) return;
    for (const f of fieldDefs) {
      if (!f || !f.name || f.noOutput || f.output === false) continue;
      const paths = [].concat(f.model || f.name);
      const sub = (typeof f.subform === 'string') ? subformByName[f.subform] : f.subform;
      if (f.type === 'password') {
        for (const p of paths) setAtPath(target, p, MASK);
      } else if (f.type === 'list' && sub && Array.isArray(sub.fields)) {
        for (const p of paths) {
          const arr = getAtPath(target, p);
          if (Array.isArray(arr)) arr.forEach((row) => walk(row, sub.fields));
        }
      } else if (f.type === 'yaml' && sub && Array.isArray(sub.fields)) {
        for (const p of paths) {
          const obj = getAtPath(target, p);
          if (obj && typeof obj === 'object' && !Array.isArray(obj)) walk(obj, sub.fields);
        }
      }
    }
  };
  walk(cloned, fields);
  return cloned;
}

/** JSON with object keys sorted at every level, so equal data always hashes the same. */
export function canonicalJson(value) {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map((v) => (v === undefined ? 'null' : canonicalJson(v))).join(',') + ']';
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
}

export function sha256(value) {
  return 'sha256:' + crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export default { deepClone, buildFormOutput, collectCredentials, filterRawFormData, maskPasswords, canonicalJson, sha256 };
