'use strict';

/**
 * The guards that make the chat safe. None of them is
 * polish : each one closes a way the model could act on something the operator did not say.
 */

// keys whose values never reach the model, the transcript or the page
export const SECRET_KEY = /pass(word)?|secret|token|api[_-]?key|private[_-]?key/i;
export const MASK = '********';

/** a copy with every value under a secret-looking key masked */
export function mask(value) {
  if (Array.isArray(value)) return value.map(mask);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = SECRET_KEY.test(k) && v !== null && v !== '' ? MASK : mask(v);
    return out;
  }
  return value;
}

/** everything the operator typed, casefolded, to check that a target came from them */
export function operatorText(messages) {
  return (messages || []).join('\n').toLowerCase();
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** whether `value` appears as a whole word in what the operator typed */
export function typedByOperator(value, text) {
  const v = String(value ?? '').toLowerCase().trim();
  if (!v) return false;
  // punctuation that ends a sentence ends the value too ("vol_mirko." is vol_mirko), but a
  // dot, @ or - inside a name keeps it going ("vol.1", "a@b", "vol-2" are not "vol")
  return new RegExp(`(^|[^\\w.@-])${escapeRegex(v)}($|[^\\w.@-]|[.@-](?![\\w.@-]))`).test(text);
}

/**
 * A target - a cluster, an svm, a name to create - must come from the operator : a value
 * they typed, or a choice button the page offered and they clicked. The model may not pick
 * one, and may never send `__auto__` (the browser's "pick the first option").
 *
 * @param {string[]} operatorSlots  the fields that name a target
 * @param {object} answers          slot -> value, as the model sent them
 * @param {string} text             operatorText(...)
 * @param {Set<string>} selections  `${slot}\u0000${value lowercased}` of clicked choices
 * @returns {null | { code, message, slot }}
 */
export function checkOperatorSlots(operatorSlots, answers, text, selections) {
  for (const slot of operatorSlots || []) {
    const value = answers?.[slot];
    if (value === undefined || value === null || value === '') continue;
    for (const item of [].concat(value)) {
      const s = typeof item === 'object' && item !== null ? (item.name ?? item.value ?? JSON.stringify(item)) : String(item);
      if (s === '__auto__') return { code: 'auto_rejected', message: `'${slot}' cannot be __auto__ : offer the choices`, slot };
      if (s === '__all__' && /\ball\b/.test(text)) continue;
      if (selections?.has(`${slot}\u0000${s.toLowerCase()}`) || typedByOperator(s, text)) continue;
      return { code: 'operator_choice_required', message: `Choose ${slot} from the options, or type the value yourself`, slot };
    }
  }
  return null;
}

// a reply that says a job is approved or launched while no plan was stored this turn
export const UNFOUNDED_LAUNCH = /(plan is (already )?(stored|set|ready|scheduled)|ready to be executed|has been (launched|initiated|approved|scheduled|started)|you have now approved|job (is|has been) (scheduled|initiated|launched|started)|i (have )?(launched|started|submitted) (the|a|your) job)/i;

export const NUDGE = 'Nothing was launched. The chat does not launch jobs. Call resolve now with every answer from this conversation. Do not say a job is launched, approved or scheduled.';
export const HONEST = 'Nothing was launched. A job starts only when you click the Launch button on the summary - and there is no summary yet.';

export default { mask, operatorText, typedByOperator, checkOperatorSlots, UNFOUNDED_LAUNCH, NUDGE, HONEST, SECRET_KEY, MASK };
