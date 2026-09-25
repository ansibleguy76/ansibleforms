'use strict';
import logger from './logger.js';

// How strict the server-side expression sanitizer is (EXPRESSION_SANITIZER).
//
//   off      - /api/v*/expression refuses everything, only runLocal expressions work
//   paranoid - only direct fn./fnc. calls, no methods on their result
//   strict   - the default: fn./fnc. calls, plus methods on their result (fn.fnTime().format())
//   legacy   - the 6.2.1 rules: anything goes once the expression starts with fn. - this
//              is remote code execution for every authenticated user, an upgrade escape hatch
//
// Read at call time, so a change from the settings page applies to the next expression.
export const EXPRESSION_MODES = ['off', 'paranoid', 'strict', 'legacy'];
export const DEFAULT_EXPRESSION_MODE = 'strict';

let warnedInvalid = null;

export function getExpressionMode() {
  const raw = String(process.env.EXPRESSION_SANITIZER ?? '').trim().toLowerCase();
  if (raw === '') return DEFAULT_EXPRESSION_MODE;
  if (EXPRESSION_MODES.includes(raw)) return raw;
  // a typo must not silently loosen anything - fall back to the default, and say so once
  if (warnedInvalid !== raw) {
    warnedInvalid = raw;
    logger.warning(`EXPRESSION_SANITIZER='${raw}' is not one of ${EXPRESSION_MODES.join(', ')}, using '${DEFAULT_EXPRESSION_MODE}'`);
  }
  return DEFAULT_EXPRESSION_MODE;
}

export default { EXPRESSION_MODES, DEFAULT_EXPRESSION_MODE, getExpressionMode };
