'use strict';
// The LDAP and SSO users seen at sign-in (the directory_users table) : one row per type and
// username, written on every successful sign-in of an LDAP, Entra ID or OIDC user. It records who
// they are and the groups and roles the directory gave them that time, for their page in
// Settings > Users ; the directory stays the source of truth, the row is what was last seen.
// An admin may block a user's sign-in here : refused at the next sign-in, its sessions ended.
//
// The unique key (type, username) compares as the column's collation does : case-insensitively,
// as an LDAP directory compares names, so JDoe and jdoe are one person.
import mysql from './db.model.js';
import logger from '../lib/logger.js';

// the types a directory user has (lib/directoryTypes.js), handed on to the callers
import { DIRECTORY_TYPES } from '../lib/directoryTypes.js';
export { DIRECTORY_TYPES };

/**
 * A list kept as JSON in a text column, read back : an empty list for none or unreadable.
 *
 * Args:
 *   text (string|null): the column.
 *
 * Returns:
 *   string[]: the list.
 */
function listOf(text) {
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * A row as the api hands it : its lists parsed, blocked a boolean.
 *
 * Args:
 *   row (object): the row.
 *
 * Returns:
 *   object: { id, type, username, external_id, display_name, email, groups, roles, first_seen,
 *     last_login, blocked }.
 */
function fromRow(row) {
  return { ...row, groups: listOf(row.groups), roles: listOf(row.roles), blocked: !!row.blocked };
}

const DirectoryUser = {
  /**
   * Records a sign-in : the user's row added, or brought up to date (its name, email, groups and
   * roles as given now, the time). Never fails the sign-in : a row that cannot be written is
   * logged.
   *
   * Args:
   *   user (object): the signed-in user, { type, username, id?, displayName?, email?, groups,
   *     roles } - id the provider's stable id (an Entra ID oid, an OIDC sub).
   *
   * Returns:
   *   Promise<void>: settles once written (or logged).
   */
  async recordSignIn(user) {
    if (!user?.username || !DIRECTORY_TYPES.includes(user.type)) return;
    const clamp = (v) => (v === null || v === undefined || v === '' ? null : String(v).slice(0, 250));
    try {
      await mysql.do(
        'INSERT INTO AnsibleForms.`directory_users` (type, username, external_id, display_name, email, `groups`, roles, first_seen, last_login) ' +
          'VALUES (?,?,?,?,?,?,?,NOW(),NOW()) ' +
          'ON DUPLICATE KEY UPDATE external_id = COALESCE(VALUES(external_id), external_id), display_name = VALUES(display_name), ' +
          'email = VALUES(email), `groups` = VALUES(`groups`), roles = VALUES(roles), last_login = NOW()',
        [
          user.type,
          clamp(user.username),
          clamp(user.id),
          clamp(user.displayName),
          clamp(user.email),
          JSON.stringify(Array.isArray(user.groups) ? user.groups : []),
          JSON.stringify(Array.isArray(user.roles) ? user.roles : []),
        ],
      );
    } catch (err) {
      logger.error(`The sign-in of ${user.type}/${user.username} was not recorded : ${err}`);
    }
  },

  /**
   * Whether an admin blocked a user's sign-in.
   *
   * Args:
   *   type (string): ldap, azuread or oidc.
   *   username (string): the username.
   *
   * Returns:
   *   Promise<boolean>: true when blocked ; false for a user never seen.
   */
  async isBlocked(type, username) {
    if (!DIRECTORY_TYPES.includes(type) || !username) return false;
    const rows = await mysql.do(
      'SELECT blocked FROM AnsibleForms.`directory_users` WHERE type = ? AND username = ?',
      [type, username],
    );
    return !!rows?.[0]?.blocked;
  },

  /**
   * Every directory user seen.
   *
   * Returns:
   *   Promise<object[]>: the users (fromRow), by type then username.
   */
  async findAll() {
    const rows = await mysql.do('SELECT * FROM AnsibleForms.`directory_users` ORDER BY type, username');
    return (rows || []).map(fromRow);
  },

  /**
   * One directory user.
   *
   * Args:
   *   type (string): ldap, azuread or oidc.
   *   username (string): the username.
   *
   * Returns:
   *   Promise<object|null>: the user (fromRow), or null when never seen.
   */
  async find(type, username) {
    const rows = await mysql.do('SELECT * FROM AnsibleForms.`directory_users` WHERE type = ? AND username = ?', [
      type,
      username,
    ]);
    return rows?.[0] ? fromRow(rows[0]) : null;
  },

  /**
   * Blocks or allows a user's sign-in. A user never seen gets its row (a user named in the
   * config, blocked before its first sign-in).
   *
   * Args:
   *   type (string): ldap, azuread or oidc.
   *   username (string): the username.
   *   blocked (boolean): true to block.
   *
   * Returns:
   *   Promise<void>: settles once written.
   */
  async setBlocked(type, username, blocked) {
    await mysql.do(
      'INSERT INTO AnsibleForms.`directory_users` (type, username, blocked) VALUES (?,?,?) ' +
        'ON DUPLICATE KEY UPDATE blocked = VALUES(blocked)',
      [type, String(username).slice(0, 250), blocked ? 1 : 0],
    );
  },

  /**
   * Forgets a user : its row goes, and comes back at its next sign-in. A blocked user stays
   * blocked : forgetting it would let it in again.
   *
   * Args:
   *   type (string): ldap, azuread or oidc.
   *   username (string): the username.
   *
   * Returns:
   *   Promise<boolean>: whether a row went (false for a blocked user, kept).
   */
  async forget(type, username) {
    const res = await mysql.do(
      'DELETE FROM AnsibleForms.`directory_users` WHERE type = ? AND username = ? AND blocked = 0',
      [type, username],
    );
    return (res?.affectedRows || 0) > 0;
  },
};

export default DirectoryUser;
