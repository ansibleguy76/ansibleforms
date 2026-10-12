// The role every signed-in user has : `default`, whose options are everyone's defaults - an option
// one of the user's own roles sets wins over it, in either direction. `public` is its name before 7
// and stays an alias for good : forms in git repositories, tokens and planned jobs carry it. There
// is no anonymous access ; nobody gets this role without signing in.
import logger from "./logger.js";

export const DEFAULT_ROLE = "default";
export const LEGACY_DEFAULT_ROLE = "public";
// what every user carries, so a form listing either name matches
export const EVERYONE_ROLES = Object.freeze([DEFAULT_ROLE, LEGACY_DEFAULT_ROLE]);

/** a role every user has : default, or public its old name */
export function isEveryoneRole(name) {
  return EVERYONE_ROLES.includes(typeof name === "string" ? name.trim() : name);
}

let warnedLegacy = false;

/**
 * The config's entry for the role every user has : `default`, else `public`. A config with both is
 * refused (load and save) : two sets of everyone's defaults have no order.
 *
 * Args:
 *   roles (object[]): the config's roles.
 *
 * Returns:
 *   object|undefined: the entry.
 */
export function everyoneEntry(roles) {
  const list = Array.isArray(roles) ? roles : [];
  const found = list.find((r) => r?.name === DEFAULT_ROLE) || list.find((r) => r?.name === LEGACY_DEFAULT_ROLE);
  if (found?.name === LEGACY_DEFAULT_ROLE && !warnedLegacy) {
    warnedLegacy = true;
    logger.warning("Role 'public' is deprecated since 7 : rename it to 'default' in config.yaml (forms listing public keep working)");
  }
  return found;
}

/** the name the config gives the role every user has : default, or public in an older config */
export function everyoneName(roles) {
  return (Array.isArray(roles) ? roles : []).find((r) => isEveryoneRole(r?.name))?.name || DEFAULT_ROLE;
}

/**
 * Refuses a config with both a `default` and a `public` role.
 *
 * Raises:
 *   Error: both are there.
 */
export function assertOneEveryoneRole(roles) {
  const names = new Set((Array.isArray(roles) ? roles : []).map((r) => (typeof r?.name === "string" ? r.name.trim() : "")));
  if (names.has(DEFAULT_ROLE) && names.has(LEGACY_DEFAULT_ROLE)) {
    throw new Error("The roles 'default' and 'public' are the same role ('public' is its old name) : keep one, 'default'");
  }
}

export default { DEFAULT_ROLE, LEGACY_DEFAULT_ROLE, EVERYONE_ROLES, isEveryoneRole, everyoneEntry, everyoneName, assertOneEveryoneRole };
