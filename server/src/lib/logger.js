import winston from 'winston';
import 'winston-daily-rotate-file';
import 'winston-syslog';
import loggerConfig from '../../config/log.config.js';
import moment from 'moment-timezone';
import os from 'os';
import { currentRequest } from './requestContext.js';

const color = {
'info': process.env.LOG_COLOR_INFO || "\x1b[32m",
'error': process.env.LOG_COLOR_ERROR || "\x1b[31m",
'warn': process.env.LOG_COLOR_WARN || "\x1b[33m",
'notice': process.env.LOG_COLOR_NOTICE || "\x1b[37m",
'debug' : process.env.LOG_COLOR_DEBUG || "\x1b[36m"
};

const getTimestamp = () => {
  const tz = loggerConfig.tz;
  return moment().tz(tz).format('YYYY-MM-DD HH:mm:ss:ms');
};

// the request a line belongs to (lib/requestContext.js), added to the line
const withRequest = winston.format((info) => {
  const ctx = currentRequest();
  if (ctx?.requestId) info.requestId = ctx.requestId;
  return info;
});
const requestSuffix = (info) => (info.requestId ? ` [req ${info.requestId}]` : '');

// LOG_FORMAT=json : one JSON object a line, for a log collector (Loki, ELK, Splunk...) - its time
// in ISO, its level, its message, the request and the process it comes from. Read per line, so
// a change on the settings page applies at once (setLogFormat)
let jsonLines = process.env.LOG_FORMAT === 'json';
const PROCESS_FIELDS = { role: process.env.AF_ROLE || 'all', host: os.hostname() };

/**
 * Switches the log lines between text and JSON (LOG_FORMAT), for every transport at once.
 *
 * Args:
 *   value (string): 'json', or anything else for text.
 */
export function setLogFormat(value) {
  jsonLines = String(value || '').trim().toLowerCase() === 'json';
}

/**
 * A log line as JSON : its time in ISO, its level, its message, its request and its process.
 *
 * Args:
 *   info (object): winston's entry.
 *
 * Returns:
 *   string: the line.
 */
const jsonLine = (info) => JSON.stringify({
  time: new Date().toISOString(),
  level: info.level,
  message: info.message,
  ...(info.requestId ? { requestId: info.requestId } : {}),
  ...PROCESS_FIELDS,
});

const formatColor = winston.format.combine(withRequest(), winston.format.printf(
  (info) => {
    if (jsonLines) return jsonLine(info);
    const timestamp = getTimestamp();
    return `${timestamp} ${color[info.level] || ''}${info.level}: ${info.message}${requestSuffix(info)}\x1b[0m`;
  }
));

const formatNoColor = winston.format.combine(withRequest(), winston.format.printf(
  (info) => {
    if (jsonLines) return jsonLine(info);
    const timestamp = getTimestamp();
    return `${timestamp} ${info.level}: ${info.message}${requestSuffix(info)}`;
  }
));

// how long the log files are kept (LOG_RETENTION_DAYS, Settings > Retention) : '<n>d' for the
// rotating transports, none (every file kept) for 0 ; read when a transport is built, so a new
// value applies when rebuildFileTransports rebuilds them
const keptFor = () => (loggerConfig.retentionDays > 0 ? `${loggerConfig.retentionDays}d` : undefined);

/**
 * A transport whose close() runs once, whatever calls it. winston closes a transport itself when
 * it is removed from a logger (winston-transport closes on 'unpipe' from its parent), and the
 * rebuilds below close what they removed too : a udp syslog transport closed twice throws
 * ERR_SOCKET_DGRAM_NOT_RUNNING from a timer, an uncaught exception that took the process down.
 *
 * Args:
 *   transport (object): the transport.
 *
 * Returns:
 *   object: the same transport.
 */
function closingOnce(transport) {
  const close = typeof transport?.close === 'function' ? transport.close.bind(transport) : null;
  if (!close) return transport;
  let closed = false;
  transport.close = (...args) => {
    if (closed) return;
    closed = true;
    return close(...args);
  };
  return transport;
}

const transportConsole = new winston.transports.Console({
  stderrLevels: ["error"],
  level:loggerConfig.consolelevel,
  format:formatColor
});

const transportDailyRotateFileErrors = closingOnce(new winston.transports.DailyRotateFile({
  filename: loggerConfig.path + "/ansibleforms.errors.%DATE%.log",
  datePattern: 'YYYY-MM-DD',
  maxFiles: keptFor(),
  zippedArchive: true,
  level: 'error',
  format:formatNoColor
}));

const transportDailyRotateFile = closingOnce(new winston.transports.DailyRotateFile({
  level: loggerConfig.level,
  filename: loggerConfig.path + "/ansibleforms.%DATE%.log",
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxFiles: keptFor(),
  format:formatColor
}));

var transports = [
  transportConsole,
  transportDailyRotateFileErrors,
  transportDailyRotateFile,
]

transportDailyRotateFile.on('error', error => {
  console.error('Error in transportDailyRotateFile:', error);
});

transportDailyRotateFileErrors.on('error', error => {
  console.error('Error in transportDailyRotateFileErrors:', error);
});


// The LOG_SYSLOG_* variables of before 7 : the syslog transport from the start, so the first
// lines of a boot still reach it. Once the syslog servers of Connections > Syslog are read
// (lib/syslogServers.js), which the variables were imported as, it is retired.
if(loggerConfig.sysloghost){
  transports.push(
    closingOnce(new winston.transports.Syslog({
      host: loggerConfig.sysloghost,
      port: loggerConfig.syslogport,
      protocol: loggerConfig.syslogprotocol,
      path: loggerConfig.syslogpath,
      localhost: loggerConfig.sysloglocalhost,
      type: loggerConfig.syslogtype,
      app_name: loggerConfig.syslogappname,
      format: formatNoColor,
      level: loggerConfig.sysloglevel
    }))
  )
}

const Logger = winston.createLogger({
  levels: winston.config.syslog.levels,
  transports,
})

// Log levels applied without a restart. winston keeps the level on the logger and on each
// transport as a plain mutable property, so the settings page can change LOG_LEVEL,
// LOG_CONSOLE_LEVEL and LOG_SYSLOG_LEVEL and have the next line honour it. The transports
// themselves (file rotation, the syslog socket, the colour map) are built here at import
// and genuinely do need a restart.
// The colour map is built once at import, but the formatter looks a level up in it on
// every line - so replacing an entry takes effect immediately.
export function setLogColor(level, code) {
  if (!level || !(level in color)) return false;
  color[level] = code || color[level];
  return true;
}

// The syslog transport is built at import from seven separate settings, so changing any of
// them means rebuilding it. winston lets a transport be removed and added at runtime, so a
// rebuild is enough - no restart. If the new configuration is invalid (winston-syslog
// throws for a unix protocol with no path, for instance) the old transport is kept and the
// caller is told, rather than leaving the logger with no syslog at all.
// LOG_PATH is baked into each rotating file's filename at construction, so a change means
// rebuilding both file transports. Same remove/add as the syslog one, and the same rule: if
// the new path cannot be used, keep the old transports rather than lose file logging.
// Winston's remove() UNPIPES a transport, and winston-transport closes it on that unpipe when
// the logger was its parent - but not one that was never piped. So a rebuilt transport could
// keep whatever it was holding:
// a DailyRotateFile keeps its open write stream and its file-stream-rotator watchers, and
// a Syslog keeps its udp/tcp socket. Both then live for the process lifetime, one set per
// rebuild - and seven LOG_SYSLOG_* variables each trigger a rebuild, so saving that tab
// with all seven changed leaked six sockets from a single click.
//
// Both close() implementations drain first (DailyRotateFile ends its stream with a
// callback, Syslog waits for its queue with a backoff), and this is only ever called AFTER
// the transport has been unpiped, so nothing new is arriving. A close that throws must not
// stop the replacement being installed, hence the catch.
function closeTransport(transport) {
  try {
    if (transport && typeof transport.close === 'function') transport.close();
  } catch (e) {
    console.error('Could not close a replaced log transport:', e.message);
  }
}

// The main file transport CURRENTLY attached. setLogLevel('file') used to mutate the
// import-time const, which rebuildFileTransports orphans - so after a LOG_PATH change a
// LOG_LEVEL change updated a transport nothing was piped to any more, while logConfig.level
// and the Status page both reported the new level. The file kept logging at the old one.
let currentFileTransport = transportDailyRotateFile;

export function rebuildFileTransports() {
  const make = (suffix, level, format) => closingOnce(new winston.transports.DailyRotateFile({
    level,
    filename: loggerConfig.path + suffix,
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxFiles: keptFor(),
    format,
  }));
  let errorsT, mainT;
  try {
    errorsT = make('/ansibleforms.errors.%DATE%.log', 'error', formatNoColor);
    mainT = make('/ansibleforms.%DATE%.log', loggerConfig.level, formatColor);
  } catch (e) {
    Logger.warning(`Could not apply the new log path, keeping the previous one: ${e.message}`);
    return false;
  }
  for (const t of [errorsT, mainT]) {
    t.on('error', (error) => console.error('Error in a rotating file transport:', error));
  }
  for (const old of [...transports]) {
    if (old instanceof winston.transports.DailyRotateFile) {
      // unpipe first, so nothing new arrives while it drains, then release the stream
      Logger.remove(old);
      transports.splice(transports.indexOf(old), 1);
      closeTransport(old);
    }
  }
  transports.push(errorsT, mainT);
  Logger.add(errorsT);
  Logger.add(mainT);
  // the level setter has to follow the live transport, not the one we just orphaned
  currentFileTransport = mainT;
  return true;
}

// the syslog transport the LOG_SYSLOG_* variables built : the only one that is not a server's
const envSyslog = () => transports.find((t) => t instanceof winston.transports.Syslog && !serverTransports.has(t));

export function rebuildSyslogTransport() {
  const existing = envSyslog();
  // the variables were imported as a syslog server : that one is the truth, they no longer are
  if (!loggerConfig.sysloghost || envSyslogRetired) {
    // no host configured : drop any transport we had and stop
    if (existing) {
      Logger.remove(existing);
      transports.splice(transports.indexOf(existing), 1);
      closeTransport(existing);
    }
    return true;
  }
  let replacement;
  try {
    replacement = closingOnce(new winston.transports.Syslog({
      host: loggerConfig.sysloghost,
      port: loggerConfig.syslogport,
      protocol: loggerConfig.syslogprotocol,
      path: loggerConfig.syslogpath,
      localhost: loggerConfig.sysloglocalhost,
      type: loggerConfig.syslogtype,
      app_name: loggerConfig.syslogappname,
      format: formatNoColor,
      level: loggerConfig.sysloglevel,
    }));
  } catch (e) {
    Logger.warning(`Could not apply the new syslog settings, keeping the previous ones: ${e.message}`);
    return false;
  }
  if (existing) {
    Logger.remove(existing);
    transports.splice(transports.indexOf(existing), 1);
    closeTransport(existing);
  }
  transports.push(replacement);
  Logger.add(replacement);
  return true;
}

// ─── the syslog servers (Settings > Connections > Syslog) ──────────────────────
// Each enabled server gets a transport of its own : on this logger for the server log, on
// auditLogger for the audit entries (models/audit.model.js), or both - a server that gets both
// has two, so each keeps its own level. lib/syslogServers.js reads them from the database at
// start and again whenever they change, here or on another node, and hands them over.

// the servers' transports, on this logger or on auditLogger
const serverTransports = new Set();
// what the audit entries are sent with : a logger of its own, so they never reach the files or
// the console (the database is their record) - only the servers that get them
const auditLogger = winston.createLogger({ levels: winston.config.syslog.levels, transports: [] });
let auditTargets = 0;
// the LOG_SYSLOG_* variables were imported as a server : their transport is gone for good
let envSyslogRetired = false;

// an audit entry's line : as it was built (one JSON object), never colored nor suffixed
const formatAudit = winston.format.printf((info) => info.message);

/**
 * A syslog transport for a server.
 *
 * Args:
 *   server (object): the server (host, port, protocol, path, type, app_name, source).
 *   level (string): the lowest level it sends.
 *   format (object): how its lines are written.
 *
 * Returns:
 *   object: the transport.
 *
 * Raises:
 *   Error: winston-syslog refuses the settings (a unix protocol without a path...).
 */
export function syslogTransportFor(server, level, format = formatNoColor) {
  const transport = closingOnce(new winston.transports.Syslog({
    host: server.host || 'localhost',
    port: Number(server.port) || 514,
    protocol: server.protocol || 'udp4',
    path: server.path || '/dev/log',
    localhost: server.source || 'localhost',
    type: server.type || 'BSD',
    app_name: server.app_name || 'AnsibleForms',
    format,
    level,
  }));
  // a server that cannot be reached must never take the process down : said on the console
  // (not through the logger, which would send it to the same server again)
  transport.on?.('error', (error) => console.error(`Syslog server '${server.name}': ${error?.message || error}`));
  return transport;
}

/**
 * Sends the server log and the audit entries to these servers, from now on : the transports
 * of the servers before are closed, those of the enabled ones built. One that cannot be built
 * is left out and named back.
 *
 * Args:
 *   servers (object[]): the syslog servers, as stored.
 *   options (object): { retireEnv : the LOG_SYSLOG_* variables were imported, their transport goes }.
 *
 * Returns:
 *   object: { log (servers getting the server log), audit (servers getting the audit entries),
 *     failed ([{ name, error }]) }.
 */
export function applySyslogServers(servers, { retireEnv = false } = {}) {
  const built = [];
  const failed = [];
  let log = 0;
  let audit = 0;
  for (const server of servers || []) {
    if (!server || !server.enabled) continue;
    const receives = ['log', 'audit'].includes(server.receives) ? server.receives : 'both';
    try {
      if (receives !== 'audit') {
        built.push({ transport: syslogTransportFor(server, server.level || 'info'), target: Logger });
        log++;
      }
      if (receives !== 'log') {
        // every audit entry : the level is the server log's
        built.push({ transport: syslogTransportFor(server, 'debug', formatAudit), target: auditLogger });
        audit++;
      }
    } catch (e) {
      failed.push({ name: server.name, error: e.message });
    }
  }
  // the ones before : unpiped, then closed (see closeTransport)
  for (const old of [...serverTransports]) {
    Logger.remove(old);
    auditLogger.remove(old);
    const at = transports.indexOf(old);
    if (at >= 0) transports.splice(at, 1);
    serverTransports.delete(old);
    closeTransport(old);
  }
  if (retireEnv && !envSyslogRetired) {
    envSyslogRetired = true;
    rebuildSyslogTransport();
  }
  for (const { transport, target } of built) {
    serverTransports.add(transport);
    if (target === Logger) transports.push(transport);
    target.add(transport);
  }
  auditTargets = audit;
  return { log, audit, failed };
}

/**
 * Sends an audit entry to the syslog servers that get them, as one line : `audit` and the
 * entry as JSON. Nothing when none does. Never throws.
 *
 * Args:
 *   entry (object): the entry, without secrets (models/audit.model.js scrubs it).
 */
export function sendAuditLine(entry) {
  if (!auditTargets) return;
  try {
    auditLogger.log('notice', `audit ${JSON.stringify(entry)}`);
  } catch (e) {
    console.error(`Could not send an audit entry to syslog: ${e.message || e}`);
  }
}

/**
 * Sends one line to a server, through a transport of its own closed after : the Test of a
 * server's page. Resolves once it is handed to the socket (udp says no more), rejects on an
 * error the transport reports within the timeout.
 *
 * Args:
 *   server (object): the server.
 *   message (string): the line.
 *   timeoutMs (number): how long to wait.
 *
 * Returns:
 *   Promise<void>: sent.
 */
export function sendTestLine(server, message, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let transport;
    let settled = false;
    const done = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // a moment for the socket to flush before it closes
      setTimeout(() => closeTransport(transport), 200);
      error ? reject(error) : resolve();
    };
    const timer = setTimeout(() => done(new Error(`no answer from ${server.host || server.path} within ${timeoutMs / 1000}s`)), timeoutMs);
    try {
      transport = closingOnce(new winston.transports.Syslog({
        host: server.host || 'localhost',
        port: Number(server.port) || 514,
        protocol: server.protocol || 'udp4',
        path: server.path || '/dev/log',
        localhost: server.source || 'localhost',
        type: server.type || 'BSD',
        app_name: server.app_name || 'AnsibleForms',
      }));
      transport.on('error', (error) => done(error instanceof Error ? error : new Error(String(error))));
      const info = { level: 'notice', message };
      info[Symbol.for('level')] = 'notice';
      info[Symbol.for('message')] = message;
      transport.log(info, () => done());
    } catch (e) {
      done(e);
    }
  });
}

export function setLogLevel(which, level) {
  if (!level) return false;
  if (which === 'file') {
    // the transport currently attached, NOT the import-time one : see currentFileTransport
    currentFileTransport.level = level;
    return true;
  }
  if (which === 'console') {
    transportConsole.level = level;
    return true;
  }
  if (which === 'syslog') {
    const syslog = envSyslog();
    if (!syslog) return false;
    syslog.level = level;
    return true;
  }
  return false;
}

export default Logger;