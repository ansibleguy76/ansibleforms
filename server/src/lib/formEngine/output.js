'use strict';
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

export default { deepClone, buildFormOutput, collectCredentials, filterRawFormData };
