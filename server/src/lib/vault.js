// HashiCorp Vault HTTP client
// Reads secrets from a Vault server using the standard HashiCorp environment
// variables (VAULT_ADDR, VAULT_TOKEN, VAULT_NAMESPACE).
//
// Supports both KV v2 (default) and KV v1.
// Returns the secret payload (an object of key/value pairs).
//
// Includes a small in-memory TTL cache (default 60s) to avoid hammering Vault
// on every credential resolution.
import axios from "axios";
import http from "http";
import https from "https";
import NodeCache from "node-cache";
import logger from "./logger.js";

// Shared keep-alive agents — reuse TCP+TLS sockets across vault reads to avoid
// the full handshake per call. One agent per (protocol, insecure) combination.
const httpAgent = new http.Agent({ keepAlive: true, keepAliveMsecs: 30000, maxSockets: 10 });
const httpsAgents = {
  secure: new https.Agent({ keepAlive: true, keepAliveMsecs: 30000, maxSockets: 10, rejectUnauthorized: true }),
  insecure: new https.Agent({ keepAlive: true, keepAliveMsecs: 30000, maxSockets: 10, rejectUnauthorized: false }),
};

const DEFAULT_CACHE_TTL_SECONDS = 60;

/**
 * Milliseconds from the environment to a node-cache stdTTL in seconds.
 *
 * Two ways the plain `Math.max(0, Math.round(ms/1000))` was wrong, and node-cache turns
 * both into the SAME failure - `stdTTL: 0` means UNLIMITED there, not "expire at once":
 *
 *  - a non-numeric value ("60s", "abc") parses to NaN, and Math.max(0, NaN) is NaN, so
 *    every entry was stored with an expiry of NaN and `t < Date.now()` is false for NaN;
 *  - any value below 500ms rounds to 0. The help text says "lower this if you rotate
 *    secrets aggressively", so the operator who most wants fresh secrets is exactly the
 *    one who sets 100 or 250 - and got a cache that never expired for the process
 *    lifetime instead.
 *
 * A positive request therefore clamps to one second, the smallest node-cache can express,
 * and anything unparseable falls back to the documented default rather than to 0.
 */
export function resolveCacheTtlSeconds(ms, fallbackSeconds = DEFAULT_CACHE_TTL_SECONDS) {
  const parsed = parseInt(ms, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallbackSeconds;
  if (parsed === 0) return 0;                    // explicit: caching disabled, see cacheEnabled
  return Math.max(1, Math.round(parsed / 1000));
}

const ttlSeconds = resolveCacheTtlSeconds(process.env.VAULT_CACHE_TTL_MS);
// 0 means "do not cache". node-cache cannot express that through stdTTL (0 is unlimited
// there) so the reads bypass the cache instead.
let cacheEnabled = ttlSeconds > 0;
const cache = new NodeCache({
  stdTTL: ttlSeconds,
  checkperiod: Math.max(60, Math.round(ttlSeconds / 2)),
});

// VAULT_CACHE_TTL_MS applied without a restart. node-cache reads options.stdTTL on every
// set(), so changing it takes effect for the next read ; only `checkperiod` is fixed at
// construction, and that merely decides how often expired keys are actively swept - a
// get() still honours the current ttl. Existing entries were stored under the old ttl, so
// they are flushed rather than left to outlive the new setting.
export function setCacheTtl(ms) {
  const seconds = resolveCacheTtlSeconds(ms);
  cacheEnabled = seconds > 0;
  cache.options.stdTTL = seconds;
  cache.flushAll();
  logger.debug(`[vault] read cache ttl set to ${seconds}s`);
  return seconds;
}

function getEnv() {
  return {
    addr: process.env.VAULT_ADDR,
    token: process.env.VAULT_TOKEN,
    namespace: process.env.VAULT_NAMESPACE,
    kvVersion: parseInt(process.env.VAULT_KV_VERSION || "2", 10),
    defaultMount: process.env.VAULT_DEFAULT_MOUNT || "secret",
    insecure: String(process.env.VAULT_SKIP_VERIFY || "").toLowerCase() === "true",
  };
}

export function isConfigured() {
  const env = getEnv();
  return !!(env.addr && env.token);
}

export function clearCache(path) {
  if (path) cache.del(path);
  else cache.flushAll();
}

// Normalize a vault path. Accepts:
//   "secret/data/foo/bar"   -> used as-is
//   "secret/foo/bar"        -> if KV v2 and missing /data/ segment, leave to caller
//   "foo/bar"               -> prefixed with VAULT_DEFAULT_MOUNT
// For KV v2, the API path needs `/data/` after the mount. We auto-insert it
// if it's missing AND VAULT_KV_VERSION is 2.
function buildApiPath(rawPath, kvVersion, defaultMount) {
  let p = String(rawPath || "").replace(/^\/+/, "");
  if (!p) throw new Error("Vault path is empty");

  // If no slash at all, prefix the default mount.
  if (!p.includes("/")) {
    p = `${defaultMount}/${p}`;
  }

  if (kvVersion === 2) {
    // Insert /data/ after the mount if not already present.
    const parts = p.split("/");
    const mount = parts[0];
    const rest = parts.slice(1);
    if (rest[0] !== "data" && rest[0] !== "metadata") {
      return `${mount}/data/${rest.join("/")}`;
    }
  }
  return p;
}

/**
 * Read a secret from Vault.
 * @param {string} rawPath - Path without the /v1/ prefix (e.g. "secret/data/foo" or "foo").
 * @returns {Promise<object>} The secret data (key/value pairs).
 */
export async function vaultRead(rawPath) {
  const env = getEnv();
  if (!env.addr || !env.token) {
    throw new Error("Vault is not configured (set VAULT_ADDR and VAULT_TOKEN)");
  }
  const apiPath = buildApiPath(rawPath, env.kvVersion, env.defaultMount);
  const cacheKey = `${env.addr}|${env.namespace || ""}|${apiPath}`;

  // cacheEnabled is false when the ttl is an explicit 0 : node-cache reads stdTTL 0 as
  // UNLIMITED, so honouring "do not cache" has to be a bypass
  const cached = cacheEnabled ? cache.get(cacheKey) : undefined;
  if (cached) {
    logger.debug(`[vault] cache hit for ${apiPath}`);
    return cached;
  }

  const url = `${env.addr.replace(/\/+$/, "")}/v1/${apiPath}`;
  const headers = { "X-Vault-Token": env.token };
  if (env.namespace) headers["X-Vault-Namespace"] = env.namespace;

  logger.debug(`[vault] reading ${apiPath}`);
  let res;
  try {
    res = await axios.get(url, {
      headers,
      httpAgent,
      httpsAgent: env.insecure ? httpsAgents.insecure : httpsAgents.secure,
      timeout: 10000,
    });
  } catch (e) {
    const status = e?.response?.status;
    const msg = e?.response?.data?.errors?.join(", ") || e.message;
    throw new Error(`Vault read failed for ${apiPath} (HTTP ${status || "?"}): ${msg}`, { cause: e });
  }

  // KV v2 wraps payload under data.data ; KV v1 puts it directly under data.
  const body = res?.data;
  let payload;
  if (env.kvVersion === 2) {
    payload = body?.data?.data;
  } else {
    payload = body?.data;
  }
  if (!payload || typeof payload !== "object") {
    throw new Error(`Vault response for ${apiPath} did not contain a usable secret payload`);
  }

  if (cacheEnabled) cache.set(cacheKey, payload);
  return payload;
}

/**
 * Map a Vault payload into the {user, password} shape used by AnsibleForms.
 * Accepts common key aliases (username, user, password, token, api_key, secret).
 * Unknown keys are passed through so they remain available for templates.
 */
// Verifies the address, the token and the namespace WITHOUT reading a secret :
// token/lookup-self needs no policy beyond the token's own, so a correctly configured
// Vault always answers it, whatever the KV mount looks like. Read only by definition.
export async function vaultCheck({ timeoutMs = 10000 } = {}) {
  const env = getEnv();
  if (!env.addr || !env.token) {
    throw new Error("Vault is not configured (set VAULT_ADDR and VAULT_TOKEN)");
  }
  const headers = { "X-Vault-Token": env.token };
  if (env.namespace) headers["X-Vault-Namespace"] = env.namespace;
  const url = `${env.addr.replace(/\/+$/, "")}/v1/auth/token/lookup-self`;
  try {
    const res = await axios.get(url, {
      headers,
      httpAgent,
      httpsAgent: env.insecure ? httpsAgents.insecure : httpsAgents.secure,
      timeout: timeoutMs,
    });
    const d = res?.data?.data || {};
    // never the token itself, and never its accessor
    return {
      addr: env.addr,
      namespace: env.namespace || null,
      kvVersion: env.kvVersion,
      defaultMount: env.defaultMount,
      renewable: !!d.renewable,
      // seconds left, or null for a token that never expires
      ttl: typeof d.ttl === 'number' ? d.ttl : null,
      policies: Array.isArray(d.policies) ? d.policies : [],
    };
  } catch (e) {
    const status = e?.response?.status;
    if (status === 403) throw new Error("Vault refused the token (403) - check VAULT_TOKEN and its policies", { cause: e });
    if (status === 404) throw new Error("Vault did not recognise the token endpoint (404) - check VAULT_ADDR", { cause: e });
    throw new Error(`Could not reach Vault at ${env.addr} : ${e.message}`, { cause: e });
  }
}

// The KV mounts this token can see, for the Default mount dropdown.
//
// sys/internal/ui/mounts is what Vault's own UI calls: it returns only what the token is
// allowed to see and needs no root policy, unlike sys/mounts which usually requires sudo.
// A short timeout because this runs on page load - a slow or unreachable Vault must not
// hold the page, the caller just falls back to a free-text field.
export async function vaultMounts() {
  const env = getEnv();
  if (!env.addr || !env.token) {
    throw new Error("Vault is not configured (set VAULT_ADDR and VAULT_TOKEN)");
  }
  const headers = { "X-Vault-Token": env.token };
  if (env.namespace) headers["X-Vault-Namespace"] = env.namespace;
  const url = `${env.addr.replace(/\/+$/, "")}/v1/sys/internal/ui/mounts`;
  let res;
  try {
    res = await axios.get(url, {
      headers,
      httpAgent,
      httpsAgent: env.insecure ? httpsAgents.insecure : httpsAgents.secure,
      timeout: 5000,
    });
  } catch (e) {
    throw new Error(`Could not list the Vault mounts : ${e.message}`, { cause: e });
  }
  const secret = res?.data?.data?.secret || {};
  return Object.entries(secret)
    // only kv : a database or pki mount cannot answer a credential read
    .filter(([, v]) => String(v?.type || "").toLowerCase() === "kv")
    .map(([mountPath, v]) => ({
      path: String(mountPath).replace(/\/+$/, ""),
      // '1' or '2' as Vault reports it, so the page can flag a mismatch with VAULT_KV_VERSION
      version: String(v?.options?.version || v?.version || "") || null,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function mapVaultPayloadToCredential(payload) {
  if (!payload || typeof payload !== "object") return {};
  const user = payload.user ?? payload.username ?? payload.login ?? "";
  const password =
    payload.password ?? payload.token ?? payload.api_key ?? payload.apikey ?? payload.secret ?? "";
  return { ...payload, user, password };
}

export default { vaultRead, vaultCheck, vaultMounts, setCacheTtl, mapVaultPayloadToCredential, isConfigured, clearCache };
