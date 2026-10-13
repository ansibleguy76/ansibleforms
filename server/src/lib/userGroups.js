'use strict';
// The groups of a signed-in user, kept out of its tokens (#1036).
//
// The access and refresh tokens used to carry every group of the user. An Entra ID user is in
// each group twice (its object id and its name), so a user in about 120 groups had a token of
// some 15 KB, sent on every request in the Authorization header : with the other headers it
// passed Node's 16 KB limit and every api call was refused with 431, before it reached the app.
// The roles and options the groups resolve to stay in the token ; the groups themselves are
// where the sign-in left them :
//
//   local                   the users and user_groups tables (live, as the admin set them)
//   ldap, azuread, oidc     the user's record in directory_users, written at each sign-in
//                           (lib/signInGate.js, models/directoryUser.model.js)
//
// The jwt strategy (auth/auth_jwt.js) puts them back on req.user.user, so every reader (the
// job's ansibleforms_user, a planned job's owner, __user__ in a form, the profile) sees the
// user as before. A token issued before this change still carries its groups, and keeps them.
import { DIRECTORY_TYPES } from './directoryTypes.js';
import logger from './logger.js';
import helpers from './common.js';

// The models are loaded when first needed, not with this module : the jwt strategy imports it,
// and the database configuration must not be required to load the strategy (the routes that
// only check a token, their tests).
const models = async () => ({
  User: (await import('../models/user.model.js')).default,
  DirectoryUser: (await import('../models/directoryUser.model.js')).default,
});

// ─── cache ────────────────────────────────────────────────────────────────────
// Every authenticated request asks for the groups ; a short cache keeps that from becoming a
// query per request. A sign-in on this instance forgets the entry (forgetGroups), another
// instance sees the new groups within the TTL.
const TTL_MS = 30 * 1000;
const MAX_ENTRIES = 1000;
const cache = new Map(); // "<type>/<username>" -> { groups, at }

/**
 * The cache key of a user.
 *
 * Args:
 *   type (string): local, ldap, azuread or oidc.
 *   username (string): the username.
 *
 * Returns:
 *   string: "<type>/<username>", the username lowercased (the tables compare it so).
 */
function keyOf(type, username) {
  return `${type}/${String(username).toLowerCase()}`;
}

/**
 * Forgets the cached groups of a user : its next request reads them again. Called at sign-in,
 * when the groups were just written.
 *
 * Args:
 *   type (string): local, ldap, azuread or oidc.
 *   username (string): the username.
 */
export function forgetGroups(type, username) {
  if (!type || !username) return;
  cache.delete(keyOf(type, username));
}

/**
 * Empties the cache (tests).
 */
export function clearGroupsCache() {
  cache.clear();
}

// ─── lookup ───────────────────────────────────────────────────────────────────

/**
 * The groups stored for a user, as the sign-in named them (local/..., ldap/..., azuread/...,
 * oidc/...).
 *
 * Args:
 *   user (object): the user, { type, username }.
 *
 * Returns:
 *   Promise<string[]|null>: the groups ; null when nothing is stored for the user (a directory
 *     user without a record, a local user that is gone, a type without groups).
 *
 * Raises:
 *   Error: the database could not be read.
 */
export async function storedGroups(user) {
  if (!user?.username) return null;
  if (user.type !== 'local' && !DIRECTORY_TYPES.includes(user.type)) return null;
  const { User, DirectoryUser } = await models();
  if (user.type === 'local') {
    const csv = await User.groupNames(user.username);
    if (csv === null) return null;
    // a user in no group (it cannot be, but a row may say so) : none, not "local/"
    if (!csv) return [];
    return User.getGroups({ type: 'local' }, csv);
  }
  if (DIRECTORY_TYPES.includes(user.type)) {
    const record = await DirectoryUser.find(user.type, user.username);
    return record ? record.groups : null;
  }
  return null;
}

/**
 * The groups of a user : the ones its token carries (a token issued before #1036), else the
 * stored ones (storedGroups), else none. A lookup that fails gives none, logged : groups only
 * ever add, so none is the safe answer.
 *
 * Args:
 *   user (object): the user, { type, username, groups? }.
 *   options (object): { cached } - false to skip the cache (the token refresh).
 *
 * Returns:
 *   Promise<string[]>: the groups.
 */
export async function groupsOf(user, { cached = true } = {}) {
  if (Array.isArray(user?.groups)) return user.groups;
  if (!user?.username || !user?.type) return [];
  const key = keyOf(user.type, user.username);
  if (cached) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.groups;
  }
  let groups;
  try {
    groups = (await storedGroups(user)) || [];
  } catch (err) {
    logger.error(`The groups of ${user.type}/${user.username} could not be read : ${helpers.getError(err)}`);
    return [];
  }
  // bounded : the oldest entry goes first (a Map keeps the order of insertion)
  cache.delete(key);
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { groups, at: Date.now() });
  return groups;
}

/**
 * The user with its groups : the user of a token, made whole again for the readers of
 * req.user.user.
 *
 * Args:
 *   user (object): the user of a token.
 *
 * Returns:
 *   Promise<object>: the same user when it carries its groups already, else a copy with them.
 */
export async function withGroups(user) {
  if (!user || Array.isArray(user.groups)) return user;
  return { ...user, groups: await groupsOf(user) };
}

/**
 * The user as a token carries it : without its groups.
 *
 * Args:
 *   user (object): the user.
 *
 * Returns:
 *   object: a copy without `groups`.
 */
export function tokenUser(user) {
  const { groups: _groups, ...rest } = user || {}; // eslint-disable-line no-unused-vars
  return rest;
}
