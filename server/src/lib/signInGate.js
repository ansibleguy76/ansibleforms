// The last check of a sign-in (controllers/v2/login.controller.js), local, LDAP, Entra ID or
// OIDC : refused when an admin blocked the user (Settings > Users : its Sign-in switch, or the
// list's row menu). A local user's block is on its row of the users table ; an LDAP or SSO user's
// on its record, which a sign-in that goes on brings up to date - who it is, its groups and roles
// now - for its page (models/directoryUser.model.js).
//
// A block that cannot be read lets the sign-in go on, logged : a database that cannot answer fails
// the sign-in anyway (its tokens are stored there), and an upgrade whose table or column is missing
// must not lock every user out.
import DirectoryUser, { DIRECTORY_TYPES } from '../models/directoryUser.model.js';
import User from '../models/user.model.js';
import logger from './logger.js';
import helpers from './common.js';

/**
 * Decides a sign-in, and records an LDAP or SSO user's when it goes on.
 *
 * Args:
 *   user (object): the signed-in user, { type, username, groups, roles, ... }.
 *   extra (object): what an LDAP or SSO user's record keeps that the token does not carry (an
 *     email, the provider's stable id).
 *
 * Returns:
 *   Promise<boolean>: true when the sign-in may go on ; false when an admin blocked it.
 */
export async function admitSignIn(user, extra = {}) {
  const directory = DIRECTORY_TYPES.includes(user?.type);
  if (!directory && user?.type !== 'local') return true;
  let blocked = false;
  try {
    blocked = directory
      ? await DirectoryUser.isBlocked(user.type, user.username)
      : await User.isBlocked(user.username);
  } catch (err) {
    logger.error(`The sign-in block of ${user.type}/${user.username} could not be read : ${helpers.getError(err)}`);
  }
  if (blocked) return false;
  if (directory) await DirectoryUser.recordSignIn({ ...user, ...extra });
  return true;
}
