/******************************************************************/
/*                                                                */
/*  An api token's lifetime, by the user's role options :         */
/*    allowApiTokens          tokens up to API_TOKEN_MAX_DAYS     */
/*    extendedTokenExpiration with it, one that never expires     */
/*  A role from before allowApiTokens, with only the extended one,*/
/*  is given allowApiTokens (user.model.js), so it keeps them.    */
/*  A token that never expires lives NEVER_DAYS : far enough to   */
/*  be never, near enough for every date column and FROM_UNIXTIME */
/*  (MariaDB's ends in 2106). It still ends when it is revoked,   */
/*  with a password change or a block, so the revocations are     */
/*  kept as long (revocationHorizonSeconds).                      */
/*                                                                */
/******************************************************************/
import authConfig from '../../config/auth.config.js';

// a token that never expires : 50 years
export const NEVER_DAYS = 50 * 365;

/**
 * Whether a user may make api tokens : allowApiTokens ; unset, as a role from before it, the
 * extended option (user.model.js gives it that value too).
 *
 * Args:
 *   user (object): the user, with its resolved options.
 *
 * Returns:
 *   boolean: true when it may.
 */
export function mayMakeApiTokens(user) {
  const options = user?.options || {};
  if (options.allowApiTokens === undefined) return !!options.extendedTokenExpiration;
  return !!options.allowApiTokens;
}

/**
 * Whether a user may make an api token that never expires : extendedTokenExpiration, with api
 * tokens (allowApiTokens) - the extended option adds to the tokens, it does not give them.
 *
 * Args:
 *   user (object): the user, with its resolved options.
 *
 * Returns:
 *   boolean: true when it may.
 */
export function mayMakeNeverExpiringTokens(user) {
  return mayMakeApiTokens(user) && !!user?.options?.extendedTokenExpiration;
}

/**
 * The lifetime of the api token a user asks for, in days.
 *
 * Args:
 *   user (object): the user, with its resolved options.
 *   expiryDays (number|string): the days asked, or 'never'.
 *
 * Returns:
 *   number|null: the days (capped at API_TOKEN_MAX_DAYS ; NEVER_DAYS for 'never'), or null when
 *     the user may not have that token (no option, never without the extended one, no lifetime).
 */
export function apiTokenDays(user, expiryDays) {
  if (expiryDays === undefined || expiryDays === null || expiryDays === '') return null;
  if (!mayMakeApiTokens(user)) return null;
  if (String(expiryDays).trim().toLowerCase() === 'never') {
    return mayMakeNeverExpiringTokens(user) ? NEVER_DAYS : null;
  }
  const days = Number(expiryDays);
  if (!Number.isFinite(days) || days < 1) return null;
  return Math.min(Math.floor(days), authConfig.apiTokenMaxDays);
}

/**
 * How long a revocation of every token of a user must be kept : as long as its longest token
 * may live, one that never expires included.
 *
 * Returns:
 *   number: seconds.
 */
export function revocationHorizonSeconds() {
  return Math.max(authConfig.apiTokenMaxDays, NEVER_DAYS) * 86400;
}

export default { NEVER_DAYS, mayMakeApiTokens, mayMakeNeverExpiringTokens, apiTokenDays, revocationHorizonSeconds };
