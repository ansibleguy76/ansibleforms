// The profile page's views, as its left menu lists them : their name (in the address /profile/
// <view>), label, description and icon. The profile page shows them (pages/profile.vue) ; the
// start-up screen draws its menu with them before the page runs (AppLoadingScreen).

/**
 * The profile's views, in their own order (labels and descriptions spelled out, so the i18n key
 * check can find them).
 *
 * Args:
 *   t (Function): vue-i18n's translate function.
 *   options (Function): returns the user's role options (profile.options), read each time : the
 *     api token's view only for the roles with long-lived tokens.
 *
 * Returns:
 *   Array: [{ name, icon, label(), description(), visible()? }].
 */
export function profileViews(t, options) {
  return [
    {
      name: 'account',
      icon: 'id-card',
      label: () => t('profilePage.menu.account'),
      description: () => t('profilePage.description.account'),
    },
    {
      name: 'preferences',
      icon: 'sliders',
      label: () => t('profilePage.menu.preferences'),
      description: () => t('profilePage.description.preferences'),
    },
    {
      name: 'password',
      icon: 'key',
      label: () => t('profilePage.menu.password'),
      description: () => t('profilePage.description.password'),
    },
    {
      name: 'permissions',
      icon: 'shield-halved',
      label: () => t('profilePage.menu.permissions'),
      description: () => t('profilePage.description.permissions'),
    },
    {
      name: 'token',
      icon: 'code',
      label: () => t('profilePage.menu.token'),
      description: () => t('profilePage.description.token'),
      // long-lived tokens are a role option : the view is only there for the roles that have it
      visible: () => !!options()?.extendedTokenExpiration,
    },
  ];
}

/**
 * The views of the menu : those the user may open, alphabetically by their (translated) label ;
 * the page opens on the first of them.
 *
 * Args:
 *   views (Array): the views (profileViews).
 *   locale (string): the language the labels are sorted in.
 *
 * Returns:
 *   Array: the views shown, in the menu's order.
 */
export function profileMenuViews(views, locale) {
  return views
    .filter((v) => (v.visible ? v.visible() : true))
    .sort((a, b) => a.label().localeCompare(b.label(), locale));
}

export default { profileViews, profileMenuViews };
