'use strict';
// The LDAP and SSO users and groups of Settings > Users and Groups : one user's record (who it
// is, what the directory gave it at its last sign-in), blocking or allowing its sign-in, ending
// its sessions, forgetting it ; one group's members seen at sign-in. Settings only (app.js) ;
// every change is in the audit log by the middleware, its target type/name (lib/auditMiddleware.js).
import DirectoryUser, { DIRECTORY_TYPES } from '../../models/directoryUser.model.js';
import RestResult from '../../models/restResult.model.v2.js';
import i18n from '../../lib/i18n.js';
import helpers from '../../lib/common.js';
import mysql from '../../models/db.model.js';
import authConfig from '../../../config/auth.config.js';
import { revokeUser } from '../../lib/tokenRevocation.js';
import { configRoles } from '../../lib/roleCounts.js';
import { directoryUserRows, directoryGroupRows } from '../../lib/directoryViews.js';

/**
 * The type and name of the request, checked : a directory type and a name.
 *
 * Args:
 *   req (object): the request, its params type and name.
 *   res (object): the response : 400 sent for a type of no directory.
 *
 * Returns:
 *   object|null: { type, name }, or null once answered.
 */
function identity(req, res) {
  const type = String(req.params.type || '');
  const name = String(req.params.name || '');
  if (!DIRECTORY_TYPES.includes(type) || !name) {
    res.status(400).json(RestResult.error(i18n.t(req, 'resources.directoryTypeUnknown')));
    return null;
  }
  return { type, name };
}

/**
 * Ends every session of a directory user : its tokens issued before now refused (an api token
 * too), its refresh tokens gone.
 *
 * Args:
 *   id (object): { type, name }.
 */
async function endSessions(id) {
  await revokeUser(id.name, id.type, authConfig.apiTokenMaxDays * 86400);
  await mysql.do('DELETE FROM AnsibleForms.`tokens` WHERE username = ? AND username_type = ?', [id.name, id.type]);
}

// one user : its row of the list (seen, or named by a role), and its record
const findUser = async function (req, res) {
  const id = identity(req, res);
  if (!id) return;
  try {
    const [seen, roles] = await Promise.all([DirectoryUser.findAll(), configRoles()]);
    const row = directoryUserRows(seen, roles).find(
      (r) => r.source === id.type && r.username.toLowerCase() === id.name.toLowerCase(),
    );
    if (!row) return res.status(404).json(RestResult.error(i18n.t(req, 'resources.userNotFound')));
    const record = seen.find((u) => u.type === id.type && u.username.toLowerCase() === id.name.toLowerCase());
    res.json(RestResult.single({ ...row, groups: record?.groups || [], roles_at_login: record?.roles || [] }));
  } catch (err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedDirectoryUser'), helpers.getError(err)));
  }
};

// block or allow its sign-in : blocked, its sessions end at once
const setBlocked = async function (req, res) {
  const id = identity(req, res);
  if (!id) return;
  try {
    const blocked = !!req.body?.blocked;
    await DirectoryUser.setBlocked(id.type, id.name, blocked);
    if (blocked) await endSessions(id);
    res.json(RestResult.single({ blocked }));
  } catch (err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedDirectoryUser'), helpers.getError(err)));
  }
};

// end its sessions : it signs in again (unless blocked)
const endUserSessions = async function (req, res) {
  const id = identity(req, res);
  if (!id) return;
  try {
    await endSessions(id);
    res.json(RestResult.single({ ended: true }));
  } catch (err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedDirectoryUser'), helpers.getError(err)));
  }
};

// forget its record : back at its next sign-in ; a blocked user is kept (forgetting would let it in)
const forgetUser = async function (req, res) {
  const id = identity(req, res);
  if (!id) return;
  try {
    const forgotten = await DirectoryUser.forget(id.type, id.name);
    if (!forgotten) return res.status(409).json(RestResult.error(i18n.t(req, 'resources.directoryUserKept')));
    res.json(RestResult.single({ forgotten }));
  } catch (err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedDirectoryUser'), helpers.getError(err)));
  }
};

// one group : seen at a sign-in or named by a role, its members seen
const findGroup = async function (req, res) {
  const id = identity(req, res);
  if (!id) return;
  try {
    const [seen, roles] = await Promise.all([DirectoryUser.findAll(), configRoles()]);
    const row = directoryGroupRows(seen, roles).find((g) => g.id === `${id.type}/${id.name}`);
    if (!row) return res.status(404).json(RestResult.error(i18n.t(req, 'resources.groupNotFound')));
    res.json(RestResult.single(row));
  } catch (err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedFindGroup'), helpers.getError(err)));
  }
};

export default { findUser, setBlocked, endUserSessions, forgetUser, findGroup };
