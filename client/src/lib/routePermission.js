/******************************************************************/
/*                                                                */
/*  The role option a link needs : the `meta.permission` of the   */
/*  route it resolves to (router/index.js), or null when the      */
/*  route has none. The left menus and the header search show a   */
/*  link only to a user who has it, so neither can disagree with  */
/*  the route's guard.                                            */
/*                                                                */
/******************************************************************/
import router from '@/router';
import { designerSwitchedOff } from '@/stores/app';
import { hasPermission } from '@/lib/permission';

/**
 * The role option the route of a link needs.
 *
 * Args:
 *   link (string): the link (/settings/users).
 *
 * Returns:
 *   string|string[]|null: the option (showSettings...), any of several (the audit log), or null for
 *     a route open to every user.
 */
export function routePermission(link) {
  try {
    return router.resolve(link)?.meta?.permission || null;
  } catch {
    return null;
  }
}

/**
 * Whether the user may open a link.
 *
 * Args:
 *   link (string): the link.
 *   options (object): the user's role options (profile.options).
 *
 * Returns:
 *   boolean: true when the route needs nothing, or an option the user has (any of them).
 */
export function mayOpen(link, options) {
  const permission = routePermission(link);
  // the designer switched off for the instance (SHOW_DESIGNER) : for no one
  if (permission === 'showDesigner' && designerSwitchedOff()) return false;
  return hasPermission(options, permission);
}

export default { routePermission, mayOpen };
