/*  ──────────────────────────────────────────────────────────────── */
/*  An SSO provider's redirect URL : the full address of the app's   */
/*  callback, as registered at the identity provider.                */
/*  ──────────────────────────────────────────────────────────────── */

// the callback path of each provider type
const CALLBACK_PATHS = {
  azuread: '/api/v2/auth/azureadoauth2/callback',
  oidc: '/api/v2/auth/oidc/callback',
};

/**
 * The callback path of a provider type.
 *
 * Args:
 *   provider (string): the provider type, 'azuread' or 'oidc'.
 *
 * Returns:
 *   string: its callback path, or '' for an unknown type.
 */
export function ssoCallbackPath(provider) {
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
 *
 * Returns:
 *   string: the full redirect URL, or '' without an address.
 */
export function ssoCallbackUrl(provider, baseUrl) {
  const base = ssoCallbackBase(provider, baseUrl);
  return base ? `${base}${ssoCallbackPath(provider)}` : '';
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
  const path = ssoCallbackPath(provider);
  if (path && base.endsWith(path)) base = base.slice(0, -path.length);
  return base.replace(/\/+$/, '');
}
