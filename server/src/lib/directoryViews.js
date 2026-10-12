// The LDAP and SSO users and groups as the Users and Groups lists show them, beside the local
// ones : the users seen at sign-in (models/directoryUser.model.js) and those the config's roles
// name but who never signed in, the groups seen at a sign-in or named by a role. Each row with
// its counts : its roles by the login's rule (User.getRolesAndOptions - by name, through a
// group, public always), on the groups seen at its last sign-in.
import { everyoneName } from "./defaultRole.js";
import { DIRECTORY_TYPES } from './directoryTypes.js';

/**
 * A reference of the config, type/name, split : null for a local one or one of no known type.
 *
 * Args:
 *   ref (string): ldap/jdoe, azuread/Ops, local/admin...
 *
 * Returns:
 *   object|null: { type, name }.
 */
export function splitRef(ref) {
  const text = String(ref ?? '');
  const slash = text.indexOf('/');
  if (slash <= 0) return null;
  const type = text.slice(0, slash);
  const name = text.slice(slash + 1);
  return DIRECTORY_TYPES.includes(type) && name ? { type, name } : null;
}

const names = (list) => (Array.isArray(list) ? list.map(String) : []);

/**
 * The roles a directory user has, by the login's rule, on the groups given.
 *
 * Args:
 *   roles (object[]): the config's roles, each { name, users, groups }.
 *   type (string): ldap, azuread or oidc.
 *   username (string): the username.
 *   groups (string[]): its groups, prefixed (ldap/ops).
 *
 * Returns:
 *   string[]: the role names, the role everyone has included (default ; public in an older config).
 */
export function rolesOfDirectoryUser(roles, type, username, groups) {
  const out = new Set([everyoneName(roles)]);
  for (const r of roles || []) {
    if (names(r.users).includes(`${type}/${username}`) || names(r.groups).some((g) => groups.includes(g))) {
      out.add(r.name);
    }
  }
  return [...out];
}

/**
 * The directory users as rows of the Users list : those seen, and those the roles name who never
 * signed in (seen false, no groups).
 *
 * Args:
 *   seen (object[]): the directory users (DirectoryUser.findAll).
 *   roles (object[]): the config's roles.
 *
 * Returns:
 *   object[]: each { id, source, username, description, email, group_ids, role_count, seen,
 *     blocked, last_login, first_seen } - id type/username, group_ids the groups seen (the
 *     list counts them).
 */
export function directoryUserRows(seen, roles) {
  const rows = [];
  const known = new Set();
  const key = (type, username) => `${type}/${String(username).toLowerCase()}`;
  for (const u of seen || []) {
    known.add(key(u.type, u.username));
    rows.push({
      id: `${u.type}/${u.username}`,
      source: u.type,
      username: u.username,
      description: u.display_name || '',
      email: u.email || '',
      group_ids: u.groups,
      role_count: rolesOfDirectoryUser(roles, u.type, u.username, u.groups).length,
      seen: !!u.last_login,
      blocked: !!u.blocked,
      first_seen: u.first_seen || null,
      last_login: u.last_login || null,
    });
  }
  // named by a role, never signed in : roles by name alone, no group known
  for (const r of roles || []) {
    for (const ref of names(r.users)) {
      const id = splitRef(ref);
      if (!id || known.has(key(id.type, id.name))) continue;
      known.add(key(id.type, id.name));
      rows.push({
        id: `${id.type}/${id.name}`,
        source: id.type,
        username: id.name,
        description: '',
        email: '',
        group_ids: [],
        role_count: rolesOfDirectoryUser(roles, id.type, id.name, []).length,
        seen: false,
        blocked: false,
        first_seen: null,
        last_login: null,
      });
    }
  }
  return rows;
}

/**
 * The directory groups as rows of the Groups list : those seen at a sign-in and those a role
 * names, each with the users seen in it and the roles that name it.
 *
 * Args:
 *   seen (object[]): the directory users (DirectoryUser.findAll), their groups prefixed.
 *   roles (object[]): the config's roles.
 *
 * Returns:
 *   object[]: each { id, source, name, description, user_count, role_count, members } - id
 *     type/name, members the usernames seen in it.
 */
export function directoryGroupRows(seen, roles) {
  const groups = new Map();
  const add = (ref) => {
    const id = splitRef(ref);
    if (!id) return null;
    const k = `${id.type}/${id.name}`;
    if (!groups.has(k)) groups.set(k, { id: k, source: id.type, name: id.name, description: '', members: [] });
    return groups.get(k);
  };
  for (const u of seen || []) {
    for (const g of u.groups || []) {
      const row = add(g);
      if (row && !row.members.includes(u.username)) row.members.push(u.username);
    }
  }
  for (const r of roles || []) for (const g of names(r.groups)) add(g);
  return [...groups.values()].map((g) => ({
    ...g,
    user_count: g.members.length,
    role_count: new Set((roles || []).filter((r) => names(r.groups).includes(g.id)).map((r) => r.name)).size,
  }));
}
