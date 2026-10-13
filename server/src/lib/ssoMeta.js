// The single sign-on providers that are on, told to the page in index.html : the sign-in card
// draws the room of their buttons from its first frame (client/src/lib/loginSso.js), instead of
// growing when it has asked the api (/api/v2/auth/settings). A meta tag, which the
// Content-Security-Policy allows (no inline script). index.html is served with no-cache, so an
// admin switching a provider on or off is seen at the next page load.

import { setMeta } from "./indexMeta.js";

// the providers, by their name in the meta tag, in the order the card shows their buttons
export const SSO_PROVIDERS = ["azuread", "oidc"];

/**
 * The single sign-on providers that are on.
 *
 * Args:
 *   models (Object): { AzureAd, OIDC } - the providers' models (their isEnabled()).
 *
 * Returns:
 *   Promise<string[]>: the names of those on (azuread, oidc), in the card's order.
 */
export async function enabledSsoProviders({ AzureAd, OIDC }) {
  const [azure, oidc] = await Promise.all([AzureAd.isEnabled(), OIDC.isEnabled()]);
  const on = { azuread: !!azure?.enable, oidc: !!oidc?.enable };
  return SSO_PROVIDERS.filter((name) => on[name]);
}

/**
 * Puts the providers that are on in index.html : <meta name="af-sso" content="azuread,oidc">,
 * replacing the one already there, else in the head.
 *
 * Args:
 *   html (string): index.html.
 *   providers (string[]|null): the providers on ; null when they could not be read : the page
 *     is left without the tag (the card then keeps the room it had last time in the browser).
 *
 * Returns:
 *   string: index.html with the tag.
 */
export function injectSsoProviders(html, providers) {
  if (!html || !Array.isArray(providers)) return html;
  // only the known names : nothing else reaches the attribute
  return setMeta(html, "af-sso", providers.filter((p) => SSO_PROVIDERS.includes(p)).join(","));
}
