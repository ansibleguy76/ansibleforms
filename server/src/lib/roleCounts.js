// The number of roles a local user or a local group has, for the users and groups lists : the
// rule of the login (User.getRolesAndOptions), counted rather than applied. A role is a user's
// when its users name `local/<username>` or its groups `local/<group>` of one of the user's
// groups ; default is everyone's. A group's roles are those whose groups name `local/<group>`.
import { everyoneName } from "./defaultRole.js";
import Form from '../models/form.model.js';
import logger from './logger.js';

/**
 * Reads the roles of the base config ; none when it cannot be read (the lists still show).
 *
 * Returns:
 *   Promise<object[]>: the config's roles, each { name, users, groups }.
 */
export async function configRoles() {
  try {
    const baseConfig = await Form.load(null, null, null, true);
    return Array.isArray(baseConfig?.roles) ? baseConfig.roles : [];
  } catch (err) {
    logger.warning(`Roles not counted, the config could not be read: ${err}`);
    return [];
  }
}

const names = (list) => (Array.isArray(list) ? list.map(String) : []);

/**
 * Adds role_count to each local user : the roles it has, the role everyone has included.
 *
 * Args:
 *   users (object[]): the users, each { username, group_ids }.
 *   groups (object[]): the local groups, each { id, name }, to name a user's groups.
 *
 * Returns:
 *   Promise<object[]>: the same users, each with role_count.
 */
export async function withUserRoleCounts(users, groups) {
  const roles = await configRoles();
  const nameOf = new Map((groups || []).map((g) => [g.id, g.name]));
  return users.map((u) => {
    const mine = (u.group_ids || [u.group_id]).map((id) => `local/${nameOf.get(id)}`);
    const counted = new Set([everyoneName(roles)]);
    for (const r of roles) {
      if (names(r.users).includes(`local/${u.username}`) || names(r.groups).some((g) => mine.includes(g))) {
        counted.add(r.name);
      }
    }
    return { ...u, role_count: counted.size };
  });
}

/**
 * Adds role_count to each local group : the roles whose groups name it.
 *
 * Args:
 *   groups (object[]): the groups, each { name }.
 *
 * Returns:
 *   Promise<object[]>: the same groups, each with role_count.
 */
export async function withGroupRoleCounts(groups) {
  const roles = await configRoles();
  return groups.map((g) => ({
    ...g,
    role_count: new Set(roles.filter((r) => names(r.groups).includes(`local/${g.name}`)).map((r) => r.name)).size,
  }));
}
