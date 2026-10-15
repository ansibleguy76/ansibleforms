/******************************************************************/
/*                                                                */
/*  An api token's expiry, as shown : a token that never expires  */
/*  lives 50 years on the server (lib/tokenLifetime.js, its       */
/*  NEVER_DAYS), so any expiry further than 40 years away reads   */
/*  as "Never expires".                                           */
/*                                                                */
/******************************************************************/

// further than this away, an expiry is "never" (ms)
const NEVER_AFTER_MS = 40 * 365 * 86400 * 1000;

/**
 * Whether an api token's expiry is the one of a token that never expires.
 *
 * Args:
 *   expires (Date|string|number): its expiry (a date, its text, or ms).
 *
 * Returns:
 *   boolean: true when it is further than 40 years away.
 */
export function neverExpires(expires) {
  const ms = expires instanceof Date ? expires.getTime() : typeof expires === 'number' ? expires : Date.parse(expires);
  return Number.isFinite(ms) && ms - Date.now() > NEVER_AFTER_MS;
}

export default { neverExpires };
