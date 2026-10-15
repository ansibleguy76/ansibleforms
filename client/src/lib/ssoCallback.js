/*  ──────────────────────────────────────────────────────────────── */
/*  An SSO provider's redirect URL : the full address of the app's   */
/*  callback, as registered at the identity provider.                */
/*  ──────────────────────────────────────────────────────────────── */

// the callback path of each provider type (and of each SSO credential type : entraid, oidc)
const CALLBACK_PATHS = {
  azuread: '/api/v2/auth/entraid/callback',
  entraid: '/api/v2/auth/entraid/callback',
  oidc: '/api/v2/auth/oidc/callback',
};

// the callback path of before 7.3 : a provider saved with it keeps it (the server still serves
// it, removed in 8.0), its redirect URL registered at the identity provider stays right
const LEGACY_CALLBACK_PATHS = {
  azuread: '/api/v2/auth/azureadoauth2/callback',
};

/**
 * The callback path of a provider type : the old one when the saved redirect URL has it.
 *
 * Args:
 *   provider (string): the provider type, 'azuread' or 'oidc'.
 *   saved (string): the provider's saved redirect URL, if any.
 *
 * Returns:
 *   string: its callback path, or '' for an unknown type.
 */
export function ssoCallbackPath(provider, saved = '') {
  const legacy = LEGACY_CALLBACK_PATHS[provider];
  const url = String(saved || '').trim();
  if (legacy && url.endsWith(legacy)) return legacy;
  return CALLBACK_PATHS[provider] || '';
}

// the example address shown in the empty address field
export const SSO_EXAMPLE_BASE = 'https://www.example.com';

/**
 * The redirect URL of a provider type at an address : the address typed, the callback path joined.
 *
 * Without an address there is no URL : a bare path would not sign anyone in.
 *
 * Args:
 *   provider (string): the provider type, 'azuread' or 'oidc'.
 *   baseUrl (string): the address the app is reached at, e.g. https://forms.example.com.
 *   saved (string): the provider's saved redirect URL, if any : its callback path is kept.
 *
 * Returns:
 *   string: the full redirect URL, or '' without an address.
 */
export function ssoCallbackUrl(provider, baseUrl, saved = '') {
  const base = ssoCallbackBase(provider, baseUrl);
  return base ? `${base}${ssoCallbackPath(provider, saved)}` : '';
}

/**
 * The address part of a redirect URL : the URL without its callback path (and trailing slashes).
 *
 * A saved redirect URL is shown as its address, the path beside it : saving joins them again.
 *
 * Args:
 *   provider (string): the provider type, 'azuread' or 'oidc'.
 *   url (string): a redirect URL, or an address.
 *
 * Returns:
 *   string: the address, e.g. https://forms.example.com, or '' without one.
 */
export function ssoCallbackBase(provider, url) {
  let base = String(url || '').trim();
  const path = ssoCallbackPath(provider, base);
  if (path && base.endsWith(path)) base = base.slice(0, -path.length);
  return base.replace(/\/+$/, '');
}
