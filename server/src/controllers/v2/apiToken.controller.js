'use strict';
// The API tokens (#1068) : a signed-in user makes one from their session, whatever they signed in
// with (an SSO account has no password to sign in again with), lists theirs and revokes one ;
// an admin lists and revokes a user's (Settings > Users and Groups).
//
// Made from a session, with the same rules as one made with a password (the login's expiryDays) :
// a role with allowApiTokens or extendedTokenExpiration, at most API_TOKEN_MAX_DAYS (or never, with
// extendedTokenExpiration), a session of its own. And two
// more : the session signed in a few minutes ago at most (the client sends the user through the
// sign-in again otherwise), so a stolen browser session is not made into a token of months ; and
// never from an api token, so a token cannot outlive itself.
import ApiToken from '../../models/apiToken.model.js';
import User from '../../models/user.model.js';
import RestResult from '../../models/restResult.model.v2.js';
import Errors from '../../lib/errors.js';
import i18n from '../../lib/i18n.js';
import logger from '../../lib/logger.js';
import authConfig from '../../../config/auth.config.js';
import { DIRECTORY_TYPES } from '../../models/directoryUser.model.js';
import { assertMayTouchAdmin } from '../../lib/adminGrants.js';
import { assertMayTouchDirectoryAdmin } from './directory.controller.js';
import { userToJwt } from './login.controller.js';
import { NEVER_DAYS, apiTokenDays, mayMakeApiTokens } from '../../lib/tokenLifetime.js';

// how long after a sign-in its session may make a token (seconds)
export const RECENT_SIGN_IN_SECONDS = 10 * 60;

/**
 * Whether the session's sign-in is recent enough to make a token.
 *
 * Args:
 *   authTime (number): when the session signed in (unix seconds) ; none for a session from
 *     before this was kept.
 *   now (number): now, in ms.
 *
 * Returns:
 *   boolean: true within RECENT_SIGN_IN_SECONDS.
 */
export function signedInRecently(authTime, now = Date.now()) {
  const at = Number(authTime);
  if (!at) return false;
  const age = now / 1000 - at;
  return age >= -60 && age <= RECENT_SIGN_IN_SECONDS;
}

/** The request's user : { username, type }. */
function me(req) {
  const user = req.user?.user || {};
  return { username: user.username, type: user.type || 'local' };
}

/** A refusal : 403 with a code the client acts on. */
function forbid(res, req, key, code) {
  return res.status(403).json({ ...RestResult.error(i18n.t(req, key)), code });
}

// POST /api/v2/profile/tokens { expiryDays, name } : a token from this session
const create = async function (req, res) {
  const user = req.user?.user;
  try {
    if (req.user?.api) return forbid(res, req, 'errors.apiTokenFromApiToken', 'api_token_session');
    if (!mayMakeApiTokens(user)) return forbid(res, req, 'errors.apiTokenNotAllowed', 'not_allowed');
    if (!signedInRecently(req.user?.auth_time)) return forbid(res, req, 'errors.apiTokenSignInAgain', 'sign_in_again');
    // a number of days, or 'never' (extendedTokenExpiration only)
    const asked = req.body?.expiryDays;
    const days = apiTokenDays(user, asked);
    if (!days) return res.status(400).json(RestResult.error(i18n.t(req, 'errors.apiTokenLifetime', { max: authConfig.apiTokenMaxDays })));
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 100) : '';
    // the session's sign-in time : the token says when its user last proved who they are
    const issued = await userToJwt(user, days === NEVER_DAYS ? 'never' : days, { name, authTime: req.user.auth_time, strict: true });
    logger.notice(`Api token made from a session by ${user.username} (${user.type}), ${days === NEVER_DAYS ? 'never expires' : `${days} days at most`}`);
    res.json(RestResult.single({ token: issued.token, expires_at: issued.expires_at }));
  } catch (err) {
    logger.error(`Could not make an api token for ${user?.username}: ${err}`);
    res.status(500).json(RestResult.error(i18n.t(req, 'errors.apiTokenFailed'), err.toString()));
  }
};

// GET /api/v2/profile/tokens : mine
const findMine = async function (req, res) {
  try {
    const { username, type } = me(req);
    res.json(RestResult.list(await ApiToken.findForUser(username, type)));
  } catch (err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'errors.apiTokensFailed'), err.toString()));
  }
};

// DELETE /api/v2/profile/tokens/:sid : one of mine
const revokeMine = async function (req, res) {
  try {
    const { username, type } = me(req);
    if (!(await ApiToken.revoke(req.params.sid, username, type))) return res.status(404).json(RestResult.error(i18n.t(req, 'errors.apiTokenNotFound')));
    res.json(RestResult.single({ revoked: true }));
  } catch (err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'errors.apiTokensFailed'), err.toString()));
  }
};

/**
 * The user an admin's request names : a local user by its id (an admin account only by an admin,
 * as for every change to it), a directory user by its type and name.
 *
 * Returns:
 *   Promise<object|null>: { username, type }, or null once answered.
 */
async function named(req, res) {
  if (req.params.id !== undefined) {
    await assertMayTouchAdmin(req, { userId: req.params.id });
    const user = await User.findById(req.params.id);
    return { username: user.username, type: 'local' };
  }
  const type = String(req.params.type || '');
  const name = String(req.params.name || '');
  if (!DIRECTORY_TYPES.includes(type) || !name) {
    res.status(400).json(RestResult.error(i18n.t(req, 'resources.directoryTypeUnknown')));
    return null;
  }
  return { username: name, type };
}

/** A failure of an admin's request : 403 refused, 404 no such user, else 500. */
function failed(req, res, err) {
  if (err instanceof Errors.AccessDeniedError) return res.status(403).json(RestResult.error(err.message));
  if (err instanceof Errors.NotFoundError) return res.status(404).json(RestResult.error(err.message));
  res.status(500).json(RestResult.error(i18n.t(req, 'errors.apiTokensFailed'), err.toString()));
}

// GET /api/v2/user/:id/tokens, /api/v2/directory/users/:type/:name/tokens : a user's
const findForUser = async function (req, res) {
  try {
    const user = await named(req, res);
    if (!user) return;
    res.json(RestResult.list(await ApiToken.findForUser(user.username, user.type)));
  } catch (err) {
    failed(req, res, err);
  }
};

// DELETE /api/v2/user/:id/tokens/:sid, /api/v2/directory/users/:type/:name/tokens/:sid : one of a user's
const revokeForUser = async function (req, res) {
  try {
    const user = await named(req, res);
    if (!user) return;
    // a directory user who is an admin : the admin role's own to change, as a local admin account
    if (user.type !== 'local') await assertMayTouchDirectoryAdmin(req, { type: user.type, name: user.username });
    if (!(await ApiToken.revoke(req.params.sid, user.username, user.type))) return res.status(404).json(RestResult.error(i18n.t(req, 'errors.apiTokenNotFound')));
    res.json(RestResult.single({ revoked: true }));
  } catch (err) {
    failed(req, res, err);
  }
};

export default { create, findMine, revokeMine, findForUser, revokeForUser };
