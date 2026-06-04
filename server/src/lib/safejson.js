import logger from './logger.js';

/**
 * Safely parse a JSON value coming from a DB column or other untrusted source.
 *
 * - If the value is null/undefined/empty string, returns `fallback`.
 * - If mysql2 already parsed it (JSON column → object), returns it as-is.
 * - On parse error, logs a warning with optional `context` and returns `fallback`
 *   instead of throwing. Most call sites cannot meaningfully recover from a
 *   corrupted JSON blob mid-flow; surfacing a fallback keeps the request alive.
 *
 * @param {*} value
 * @param {*} [fallback=null]
 * @param {string} [context='']
 * @returns {*}
 */
export function safeParse(value, fallback = null, context = '') {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    logger.warning(`safeParse failed${context ? ' (' + context + ')' : ''}: ${e.message}`);
    return fallback;
  }
}

export default { safeParse };
