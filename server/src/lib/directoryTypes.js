// The types of a directory user (an LDAP or SSO sign-in) ; a local user lives in the users table.
// Apart from models/directoryUser.model.js so the pure helpers (lib/directoryViews.js) need no
// database.
export const DIRECTORY_TYPES = ['ldap', 'azuread', 'oidc'];

// the type of a Microsoft Entra ID sign-in as stored (users, tokens, jobs, directory records) :
// still its old name, azuread, kept for compatibility
export const ENTRA_TYPE = 'azuread';

// a role names an Entra ID member entraid/<name> since 7.3 ; azuread/<name>, the old prefix, is
// the same member (deprecated, removed in 8.0)
export const ENTRA_PREFIX = 'entraid';

/**
 * A member of a role (users, groups) as it is matched : entraid/<name> is azuread/<name>, the
 * type the sign-in stores.
 *
 * Args:
 *   ref (string): the member, e.g. entraid/AF-Operators, azuread/AF-Operators, ldap/ops.
 *
 * Returns:
 *   string: the member to match, e.g. azuread/AF-Operators.
 */
export function memberRef(ref) {
  const text = String(ref ?? '');
  return text.startsWith(`${ENTRA_PREFIX}/`) ? `${ENTRA_TYPE}/${text.slice(ENTRA_PREFIX.length + 1)}` : text;
}

/**
 * The members of a role (users, groups) as they are matched (memberRef).
 *
 * Args:
 *   list (any): the role's list from the yaml.
 *
 * Returns:
 *   string[]: the members ; none when it is not a list.
 */
export function memberRefs(list) {
  return Array.isArray(list) ? list.map(memberRef) : [];
}
