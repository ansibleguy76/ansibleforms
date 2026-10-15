/******************************************************************/
/*                                                                */
/*  Whether a user's role options give a route's permission : one */
/*  option (showSettings), or any of several (the audit log :     */
/*  showSettings or showAuditLog). The router's guard and the     */
/*  menus (lib/routePermission.js) read it the same way.          */
/*                                                                */
/******************************************************************/

/**
 * Whether the role options give a permission.
 *
 * Args:
 *   options (object): the user's role options (profile.options, or the token's).
 *   permission (string|string[]|null): one option, any of several, or none.
 *
 * Returns:
 *   boolean: true for no permission, or when the user has the option (any of them).
 */
export function hasPermission(options, permission) {
  if (!permission) return true;
  const any = Array.isArray(permission) ? permission : [permission];
  return any.some((option) => !!options?.[option]);
}

export default { hasPermission };
