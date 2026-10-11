// The types of a directory user (an LDAP or SSO sign-in) ; a local user lives in the users table.
// Apart from models/directoryUser.model.js so the pure helpers (lib/directoryViews.js) need no
// database.
export const DIRECTORY_TYPES = ['ldap', 'azuread', 'oidc'];
