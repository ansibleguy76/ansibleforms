// The last check of an LDAP, Entra ID or OIDC sign-in (controllers/v2/login.controller.js) : refused
// when an admin blocked the user (Settings > Users, its page), else recorded - who it is, its groups
// and roles now - for that page (models/directoryUser.model.js). A local user passes untouched.
//
// A block that cannot be read lets the sign-in go on, logged : a database that cannot answer fails
// the sign-in anyway (its tokens are stored there), and an upgrade whose table is missing must not
// lock every directory user out.
import DirectoryUser, { DIRECTORY_TYPES } from '../models/directoryUser.model.js';
import logger from './logger.js';
import helpers from './common.js';

/**
 * Decides a directory user's sign-in, and records it when it goes on.
 *
 * Args:
 *   user (object): the signed-in user, { type, username, groups, roles, ... }.
 *   extra (object): what the record keeps that the token does not carry (an email, the
 *     provider's stable id).
 *
 * Returns:
 *   Promise<boolean>: true when the sign-in may go on ; false when an admin blocked it.
 */
export async function admitDirectorySignIn(user, extra = {}) {
  if (!DIRECTORY_TYPES.includes(user?.type)) return true;
  let blocked = false;
  try {
    blocked = await DirectoryUser.isBlocked(user.type, user.username);
  } catch (err) {
    logger.error(`The sign-in block of ${user.type}/${user.username} could not be read : ${helpers.getError(err)}`);
  }
  if (blocked) return false;
  await DirectoryUser.recordSignIn({ ...user, ...extra });
  return true;
}
