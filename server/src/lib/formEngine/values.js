'use strict';

/**
 * Value predicates shared by the form engine and the browser.
 *
 * `req` and `requiredReq` are ports of @vuelidate/validators' `req` and of what its
 * `required` validator does before calling it. They differ on purpose : `required` trims a
 * string first, `req` does not - so "   " fails `required` but still counts as "a value is
 * present" for every other rule (minLength, regex, ...), which then runs on it.
 */

/** The enum/expression placeholders for "no choice made yet". */
export const SENTINELS = ['__auto__', '__none__', '__all__'];

/** @vuelidate/validators `req` : is there a value at all (strings are NOT trimmed). */
export function req(value) {
  if (Array.isArray(value)) return !!value.length;
  if (value === undefined || value === null) return false;
  if (value === false) return true;
  if (value instanceof Date) return !isNaN(value.getTime());
  if (typeof value === 'object') {
    for (const _ in value) return true;
    return false;
  }
  return !!String(value).length;
}

/** @vuelidate/validators `required` : `req` on a trimmed string. */
export function requiredReq(value) {
  if (typeof value === 'string') value = value.trim();
  return req(value);
}

/** Whether a field still needs a value from whoever fills in the form (the MCP caller). */
export function isEmptyValue(value, type) {
  if (type === 'checkbox') return value !== true;
  if (value === undefined || value === null || value === '') return true;
  if (SENTINELS.includes(value)) return true;
  if (Array.isArray(value) && value.length === 0 && type !== 'enum' && type !== 'expression') return true;
  return false;
}

/** MIRROR of client/src/lib/Helpers.js humanFileSize. */
export function humanFileSize(size) {
  if (size == undefined) return "Not a number";
  const i = size == 0 ? 0 : Math.floor(Math.log(size) / Math.log(1024));
  return (size / Math.pow(1024, i)).toFixed(2) * 1 + ' ' + ['B', 'kB', 'MB', 'GB', 'TB'][i];
}

export default { SENTINELS, req, requiredReq, isEmptyValue, humanFileSize };
