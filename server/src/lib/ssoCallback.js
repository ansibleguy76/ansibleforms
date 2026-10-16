// An SSO credential's redirect URL : the full address of the app's callback, as registered at the
// identity provider with the client id and secret. Typed in the credential, or left empty : then
// the app's address (Settings > URL) and its type's callback path.
import Settings from "../models/settings.model.js";
import logger from "./logger.js";

// the callback path of each credential type, as the routes serve it (routes/v2/auth)
export const CALLBACK_PATHS = {
  entraid: "/api/v2/auth/entraid/callback",
  oidc: "/api/v2/auth/oidc/callback",
};

/**
 * The redirect URL a provider signs in with : its credential's, else its own (from before
 * credentials held it), else the app's address and the type's callback path.
 *
 * Args:
 *   type (string): the credential type, entraid or oidc.
 *   ...urls (string[]): the redirect URLs set, the first one set wins (the credential's, the
 *     provider's own).
 *
 * Returns:
 *   Promise<string>: the redirect URL, or '' when none is set and the app has no address.
 */
export async function redirectUrl(type, ...urls) {
  const set = urls.map((u) => String(u || "").trim()).find(Boolean);
  if (set) return set;
  const base = await Settings.findUrl()
    .then((s) => String(s?.url || "").trim().replace(/\/+$/, ""))
    .catch((e) => {
      logger.debug(`No app address for the ${type} redirect URL: ${e?.message || e}`);
      return "";
    });
  return base && CALLBACK_PATHS[type] ? `${base}${CALLBACK_PATHS[type]}` : "";
}
