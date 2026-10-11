/******************************************************************/
/*                                                                */
/*  iconName : whether a name is a solid Font Awesome icon the    */
/*  app knows (plugins/index.js adds them all), for a name an     */
/*  admin typed (Settings > Appearance > Links) - an unknown one  */
/*  would leave the link without an icon and an error in the      */
/*  console.                                                      */
/*                                                                */
/******************************************************************/
import { findIconDefinition } from '@fortawesome/fontawesome-svg-core';

/**
 * Whether a solid icon of that name exists.
 *
 * Args:
 *   name (string): the icon's name (book, life-ring).
 *
 * Returns:
 *   boolean: true when it does.
 */
export function isIconName(name) {
  if (!name || typeof name !== 'string') return false;
  try {
    return !!findIconDefinition({ prefix: 'fas', iconName: name });
  } catch {
    return false;
  }
}

/**
 * The icon to show for a name : itself when it exists, else a fallback.
 *
 * Args:
 *   name (string): the icon's name.
 *   fallback (string): the icon instead (link).
 *
 * Returns:
 *   string: an icon's name.
 */
export function iconOrDefault(name, fallback = 'link') {
  return isIconName(name) ? name : fallback;
}

// the icons a header link may pick (Settings > Appearance > Links) : what such links usually
// point to - documentation, support, monitoring, tools
export const LINK_ICONS = [
  'link',
  'arrow-up-right-from-square',
  'book',
  'book-open',
  'circle-question',
  'life-ring',
  'headset',
  'bug',
  'ticket',
  'comments',
  'envelope',
  'phone',
  'globe',
  'house',
  'gauge',
  'chart-line',
  'chart-column',
  'server',
  'database',
  'cloud',
  'network-wired',
  'shield-halved',
  'lock',
  'key',
  'user',
  'users',
  'calendar',
  'clock',
  'list-check',
  'clipboard-list',
  'file-lines',
  'folder',
  'code',
  'terminal',
  'gear',
  'screwdriver-wrench',
  'rocket',
  'bolt',
  'star',
  'bell',
  'newspaper',
  'graduation-cap',
  'lightbulb',
  'flask',
  'cubes',
  'box-archive',
  'magnifying-glass',
  'history',
];
