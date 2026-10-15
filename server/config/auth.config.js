import crypto from 'crypto';

let jwtSecret = process.env.ACCESS_TOKEN_SECRET;
let jwtSecretIsGenerated = false;

if (!jwtSecret) {
  jwtSecret = crypto.randomBytes(64).toString('hex');
  jwtSecretIsGenerated = true;
  console.warn('[SECURITY WARNING] ACCESS_TOKEN_SECRET is not set. A random secret has been generated for this process. Tokens will NOT survive a restart. Set ACCESS_TOKEN_SECRET in your environment for stable token signing.');
}

// the Entra ID variables, named AZURE_* before 7.3 : the new name is read first, the old one
// only when the new one is not set (deprecated, removed in 8.0)
export const ENTRA_ENV_ALIASES = {
  ENTRA_AUTHORITY_URI: 'AZURE_AUTHORITY_URI',
  ENTRA_GRAPH_URI: 'AZURE_GRAPH_URI',
};
const ENTRA_ENV_DEFAULTS = {
  ENTRA_AUTHORITY_URI: 'https://login.microsoftonline.com',
  ENTRA_GRAPH_URI: 'https://graph.microsoft.com',
};

/**
 * The value of an Entra ID variable : its own name, else its old AZURE_* name, else the default.
 *
 * Args:
 *   name (string): ENTRA_AUTHORITY_URI or ENTRA_GRAPH_URI.
 *   env (object): the environment, process.env by default.
 *
 * Returns:
 *   string: the value.
 */
export function entraEnv(name, env = process.env) {
  return env[name] || env[ENTRA_ENV_ALIASES[name]] || ENTRA_ENV_DEFAULTS[name];
}

/**
 * The warnings for the old AZURE_* names still set, logged once at start (app-start.js).
 *
 * Args:
 *   env (object): the environment, process.env by default.
 *
 * Returns:
 *   string[]: one per old name set ; it says when the new name is set too, and wins.
 */
export function entraEnvWarnings(env = process.env) {
  const warnings = [];
  for (const [name, old] of Object.entries(ENTRA_ENV_ALIASES)) {
    if (!env[old]) continue;
    const both = env[name] ? ` : ${name} is set too and wins, ${old} is ignored` : '';
    warnings.push(`${old} is deprecated, use ${name} (removed in 8.0)${both}`);
  }
  return warnings;
}

export default {
  secret: jwtSecret,
  secretIsGenerated: jwtSecretIsGenerated,
  jwtExpiration: process.env.ACCESS_TOKEN_EXPIRATION || "30m",
  jwtRefreshExpiration: process.env.ACCESS_TOKEN_REFRESH_EXPIRATION || "24h",
  jwtIssuer: process.env.ACCESS_TOKEN_ISSUER || "ansibleforms",
  // an api token (a login with ?expiryDays=, for a role with extendedTokenExpiration) lives this
  // many days at most ; a longer request is cut to it
  apiTokenMaxDays: Math.max(1, parseInt(process.env.API_TOKEN_MAX_DAYS ?? 90, 10) || 90),
  // Microsoft Graph, read at an Entra ID login for the user's groups (ENTRA_GRAPH_URI)
  entraGraphUrl: entraEnv('ENTRA_GRAPH_URI'),
  // the Entra ID sign-in authority : Microsoft's public cloud, or a national cloud
  // (login.microsoftonline.us, login.chinacloudapi.cn) ; read when the Entra ID provider is enabled
  entraAuthorityUrl: entraEnv('ENTRA_AUTHORITY_URI'),
  ldapErrorRegex:".*, data ([^,]*),.*",
  ldapErrors:{
    "52e":"Wrong password",
    "525":"User not found",
    "530":"Not permitted to logon at this time",
    "532":"Password expired",
    "533":"Account disabled",
    "701":"Account expired",
    "773":"User must reset password",
    "775":"Account locked"
  }
};
