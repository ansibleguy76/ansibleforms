// The syslog servers of Settings > Connections > Syslog, applied to this process's logger
// (lib/logger.js applySyslogServers) : at start, whenever they change here (the model reloads
// them after a save), and whenever they change on another node (the 'syslogserver' epoch,
// init/cluster.js ; an RTE, which follows no epochs, reads them again every minute).
//
// Before 7 the one syslog server was configured with the LOG_SYSLOG_* environment variables.
// The first start that finds LOG_SYSLOG_HOST set imports them ONCE as the server `syslog`
// (getting the server log, as they did), and records that in settings.syslog_env_imported_at.
// From then on the rows are the only truth and the variables are ignored - a server deleted
// later is never re-imported - as the VAULT_* variables became the secret store `vault`.
import logger, { applySyslogServers } from "./logger.js";
import mysql from "../models/db.model.js";

// the server the variables become
export const SYSLOG_ENV_SERVER_NAME = "syslog";

// what was applied last, so a reload that changes nothing rebuilds no socket
let appliedKey = null;
let pollTimer = null;

/**
 * Whether the LOG_SYSLOG_* variables describe a server : LOG_SYSLOG_HOST names one.
 *
 * Args:
 *   env (object): the environment.
 *
 * Returns:
 *   boolean: true when they do.
 */
export function syslogEnvIsSet(env = process.env) {
  return !!String(env.LOG_SYSLOG_HOST || "").trim();
}

/**
 * The syslog server the LOG_SYSLOG_* variables describe, with their defaults (config/log.config.js).
 *
 * Args:
 *   env (object): the environment.
 *
 * Returns:
 *   object: the server's fields.
 */
export function syslogServerFromEnv(env = process.env) {
  const protocol = String(env.LOG_SYSLOG_PROTOCOL || "udp4");
  return {
    name: SYSLOG_ENV_SERVER_NAME,
    description: "Imported from the LOG_SYSLOG_* environment variables",
    host: String(env.LOG_SYSLOG_HOST || "").trim(),
    port: parseInt(env.LOG_SYSLOG_PORT || "514", 10) || 514,
    // the short names winston-syslog also takes, as the 4 they mean
    protocol: { udp: "udp4", tcp: "tcp4", tls: "tls4" }[protocol] || protocol,
    path: protocol.startsWith("unix") ? env.LOG_SYSLOG_PATH || "/dev/log" : null,
    level: env.LOG_SYSLOG_LEVEL === "warn" ? "warning" : env.LOG_SYSLOG_LEVEL || "debug",
    type: ["5424", "RFC5424"].includes(String(env.LOG_SYSLOG_TYPE)) ? "5424" : "BSD",
    app_name: env.LOG_SYSLOG_APPNAME || "AnsibleForms",
    source: env.LOG_SYSLOG_SOURCE || "localhost",
    // what they sent : the server log
    receives: "log",
    enabled: 1,
  };
}

async function readMarker() {
  const rows = await mysql.do("SELECT syslog_env_imported_at FROM AnsibleForms.`settings` LIMIT 1");
  return rows?.[0]?.syslog_env_imported_at || null;
}

// upsert : the settings row can be missing on a fresh or partly restored database
async function writeMarker() {
  const now = new Date();
  const ins = await mysql.do(
    "INSERT INTO AnsibleForms.`settings` (syslog_env_imported_at) SELECT ? FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM AnsibleForms.`settings`)",
    [now],
  );
  if (!ins?.affectedRows) await mysql.do("UPDATE AnsibleForms.`settings` SET syslog_env_imported_at = ?", [now]);
}

/**
 * At every start of the app or the worker, once the schema is ready : imports the LOG_SYSLOG_*
 * variables the first time it sees them, and only warns after that.
 *
 * Args:
 *   options (object): { env, marker ({ read, write }), create (the server's create) } - for tests.
 *
 * Returns:
 *   Promise<string>: "none" (no LOG_SYSLOG_HOST), "imported", "kept" (a server named syslog was
 *     there already) or "ignored" (imported before).
 */
export async function importSyslogFromEnvOnce({ env = process.env, marker = { read: readMarker, write: writeMarker }, model = null } = {}) {
  if (!syslogEnvIsSet(env)) return "none";
  if (await marker.read()) {
    logger.warning("The LOG_SYSLOG_* environment variables are ignored: they were imported as the syslog server 'syslog' before - manage it under Connections > Syslog and remove them from the environment");
    return "ignored";
  }
  const SyslogServer = model || (await import("../models/syslogServer.model.js")).default;
  let outcome;
  if (await SyslogServer.findByName(SYSLOG_ENV_SERVER_NAME)) {
    logger.warning(`A syslog server named '${SYSLOG_ENV_SERVER_NAME}' already exists - the LOG_SYSLOG_* environment variables were not imported and are ignored from now on`);
    outcome = "kept";
  } else {
    await SyslogServer.create(syslogServerFromEnv(env));
    logger.warning(`Imported the LOG_SYSLOG_* environment variables as the syslog server '${SYSLOG_ENV_SERVER_NAME}' - they are ignored from now on, remove them from the environment`);
    outcome = "imported";
  }
  await marker.write();
  return outcome;
}

/**
 * Reads the syslog servers and applies them to this process's logger. The variables' own
 * transport stays while they were never imported and no server is kept (a database being
 * patched, or an install that never had syslog). A database that cannot be read changes
 * nothing.
 *
 * Args:
 *   options (object): { force : apply even when nothing changed }.
 *
 * Returns:
 *   Promise<object|null>: what applySyslogServers did, null when nothing was read or changed.
 */
export async function reloadSyslogServers({ force = false } = {}) {
  let servers;
  let imported;
  try {
    servers = await mysql.tryDo("SELECT * FROM AnsibleForms.`syslog_servers` ORDER BY id");
    imported = await readMarker().catch(() => null);
  } catch (e) {
    logger.debug(`Could not read the syslog servers: ${e.message || e}`);
    return null;
  }
  const retireEnv = !!imported || (servers || []).length > 0;
  const key = JSON.stringify([servers, retireEnv]);
  if (!force && key === appliedKey) return null;
  appliedKey = key;
  const result = applySyslogServers(servers || [], { retireEnv });
  for (const { name, error } of result.failed) {
    logger.error(`Syslog server '${name}' could not be applied: ${error}`);
  }
  return result;
}

/**
 * Applies the syslog servers at start and follows their changes : through the epochs on the
 * app and the worker (subscribed in init/cluster.js), every minute on an RTE (pollMs).
 *
 * Args:
 *   options (object): { pollMs : read them again this often, 0 for never }.
 */
export async function startSyslogServers({ pollMs = 0 } = {}) {
  await reloadSyslogServers({ force: true });
  if (pollMs > 0 && !pollTimer) {
    pollTimer = setInterval(() => {
      reloadSyslogServers().catch(() => {});
    }, pollMs);
    pollTimer.unref?.();
  }
}

// tests only
export function resetSyslogServers() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  appliedKey = null;
}

export default { importSyslogFromEnvOnce, reloadSyslogServers, startSyslogServers, syslogServerFromEnv, syslogEnvIsSet };
