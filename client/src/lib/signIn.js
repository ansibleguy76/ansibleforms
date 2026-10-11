/******************************************************************/
/*                                                                */
/*  Blocking or allowing a user's sign-in, local or from a        */
/*  directory (LDAP, Entra ID, OIDC) : each at its own api        */
/*  (POST /api/v2/user/<id>/block, POST /api/v2/directory/users/  */
/*  <source>/<name>/block), the same body { blocked }.            */
/*                                                                */
/******************************************************************/
import axios from 'axios';

/**
 * The address that blocks or allows a user's sign-in.
 *
 * Args:
 *   user (object): a row of the users list, or a user's page record : { id, username,
 *     source } (source local when none).
 *
 * Returns:
 *   string: the api address.
 */
export function blockPath(user) {
  const source = user.source || 'local';
  return source === 'local'
    ? `/api/v2/user/${encodeURIComponent(user.id)}/block`
    : `/api/v2/directory/users/${encodeURIComponent(source)}/${encodeURIComponent(user.username)}/block`;
}

/**
 * Blocks or allows a user's sign-in : blocked, its sessions end at once.
 *
 * Args:
 *   user (object): { id, username, source }.
 *   blocked (boolean): true to block.
 *
 * Returns:
 *   Promise<void>: settles once saved ; rejects with the api's refusal (its own sign-in, the
 *     admin user).
 */
export async function setSignInBlocked(user, blocked) {
  await axios.post(blockPath(user), { blocked });
}
