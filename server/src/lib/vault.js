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
const ttlSeconds = Math.max(
  0,
  Math.round(parseInt(process.env.VAULT_CACHE_TTL_MS || String(DEFAULT_CACHE_TTL_SECONDS * 1000), 10) / 1000)
);
const cache = new NodeCache({
  stdTTL: ttlSeconds,
  checkperiod: Math.max(60, Math.round(ttlSeconds / 2)),
});

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

  const cached = cache.get(cacheKey);
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
    throw new Error(`Vault read failed for ${apiPath} (HTTP ${status || "?"}): ${msg}`);
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

  cache.set(cacheKey, payload);
  return payload;
}

/**
 * Map a Vault payload into the {user, password} shape used by AnsibleForms.
 * Accepts common key aliases (username, user, password, token, api_key, secret).
 * Unknown keys are passed through so they remain available for templates.
 */
export function mapVaultPayloadToCredential(payload) {
  if (!payload || typeof payload !== "object") return {};
  const user = payload.user ?? payload.username ?? payload.login ?? "";
  const password =
    payload.password ?? payload.token ?? payload.api_key ?? payload.apikey ?? payload.secret ?? "";
  return { ...payload, user, password };
}

export default { vaultRead, mapVaultPayloadToCredential, isConfigured, clearCache };
