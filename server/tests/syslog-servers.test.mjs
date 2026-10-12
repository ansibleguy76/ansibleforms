// The syslog servers of Settings > Connections > Syslog : what a save may hold, the LOG_SYSLOG_*
// variables of before 7 imported once as the server `syslog`, a transport per server on the
// logger (the server log) or on the audit logger (the audit entries), the ones before closed,
// and the variables' own transport retired once they were imported.
import { test, describe, beforeEach, expect, vi } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
// the variables' transport exists from the start, as on an install from before 7
process.env.LOG_SYSLOG_HOST = "10.0.0.9";

// stand-ins that record what happens to them : no socket, no file
const built = [];
class FakeTransport {
  constructor(opts = {}) { this.level = opts.level; this.opts = opts; this.closed = false; this.closes = 0; this.lines = []; }
  on() { return this; }
  close() { this.closed = true; this.closes++; }
  log(info, cb) { this.lines.push(info); if (cb) cb(); }
}
class FakeSyslog extends FakeTransport {
  constructor(opts) { super(opts); built.push(this); }
}
// two loggers : the app's, and the audit entries'
const loggers = [];
vi.mock("winston", () => {
  const makeLogger = () => {
    const l = {
      piped: new Set(),
      level: "info",
      add(t) { this.piped.add(t); return this; },
      remove(t) { this.piped.delete(t); return this; },
      log(level, message) { for (const t of this.piped) t.log({ level, message }); },
      warning() {}, error() {}, info() {}, notice() {}, debug() {},
    };
    loggers.push(l);
    return l;
  };
  return {
    default: {
      format: Object.assign(() => () => ({}), { printf: () => ({}), combine: () => ({}) }),
      config: { syslog: { levels: { emerg: 0, alert: 1, crit: 2, error: 3, warning: 4, notice: 5, info: 6, debug: 7 } } },
      createLogger: (opts) => { const l = makeLogger(); (opts.transports || []).forEach((t) => l.piped.add(t)); return l; },
      transports: { Console: FakeTransport, DailyRotateFile: FakeTransport, Syslog: FakeSyslog },
    },
  };
});
vi.mock("winston-daily-rotate-file", () => ({ default: {} }));
vi.mock("winston-syslog", () => ({ default: {} }));

const { applySyslogServers, sendAuditLine, rebuildSyslogTransport } = await import("../src/lib/logger.js");
const [appLogger, auditLogger] = loggers;
const { syslogServerFromEnv, importSyslogFromEnvOnce } = await import("../src/lib/syslogServers.js");
const { default: SyslogServer } = await import("../src/models/syslogServer.model.js");

const server = (fields) => ({ name: "siem", host: "siem.example.com", port: 514, protocol: "udp4", level: "info", receives: "both", enabled: 1, ...fields });
const live = (logger) => [...logger.piped].filter((t) => t instanceof FakeSyslog);

describe("a transport per server", () => {
  beforeEach(() => applySyslogServers([], {}));

  test("the server log, the audit entries, or both : on the logger they belong to", () => {
    const result = applySyslogServers([server({ name: "a", receives: "log" }), server({ name: "b", receives: "audit" }), server({ name: "c" })]);
    expect(result).toEqual({ log: 2, audit: 2, failed: [] });
    const appHosts = live(appLogger).filter((t) => t.opts.host === "siem.example.com");
    expect(appHosts.length).toBe(2);
    expect(live(auditLogger).length).toBe(2);
    // the audit entries all go, whatever the server log's level
    expect(live(auditLogger).every((t) => t.level === "debug")).toBe(true);
  });

  test("a transport is closed once, however often it is asked : twice, a udp socket throws from a timer", () => {
    applySyslogServers([server()]);
    const [t] = live(auditLogger);
    applySyslogServers([]);
    // what winston does itself when the transport leaves its logger
    t.close();
    t.close();
    expect(t.closes).toBe(1);
  });

  test("a disabled server gets nothing", () => {
    expect(applySyslogServers([server({ enabled: 0 })])).toEqual({ log: 0, audit: 0, failed: [] });
    expect(live(auditLogger).length).toBe(0);
  });

  test("the transports before are closed, not only unpiped", () => {
    applySyslogServers([server()]);
    const before = [...live(auditLogger)];
    applySyslogServers([server({ port: 1514 })]);
    for (const t of before) {
      expect(t.closed).toBe(true);
      expect(auditLogger.piped.has(t)).toBe(false);
    }
    expect(live(auditLogger)[0].opts.port).toBe(1514);
  });

  test("an audit entry goes to the servers that get them, as one JSON line ; none, nothing", () => {
    applySyslogServers([server({ receives: "audit" })]);
    sendAuditLine({ action: "role.update", actor: "bob" });
    const [t] = live(auditLogger);
    expect(t.lines.at(-1).message).toBe('audit {"action":"role.update","actor":"bob"}');
    applySyslogServers([server({ receives: "log" })]);
    expect(() => sendAuditLine({ action: "x" })).not.toThrow();
    expect(live(auditLogger).length).toBe(0);
  });

  test("the variables' transport stays until they were imported, then is gone for good", () => {
    const envT = () => live(appLogger).find((t) => t.opts.host === "10.0.0.9");
    expect(envT(), "built at start from LOG_SYSLOG_HOST").toBeTruthy();
    const first = envT();
    applySyslogServers([server({ receives: "audit" })], { retireEnv: true });
    expect(envT()).toBeFalsy();
    expect(first.closed).toBe(true);
    // a LOG_SYSLOG_* change on the settings page builds it no more
    rebuildSyslogTransport();
    expect(envT()).toBeFalsy();
  });
});

describe("the LOG_SYSLOG_* variables, imported once", () => {
  const marker = (at = null) => ({ at, read: async function () { return this.at; }, write: async function () { this.at = new Date(); } });
  const model = (existing = null) => ({ created: [], findByName: async () => existing, create: async function (d) { this.created.push(d); return 1; } });

  test("as the server syslog, getting the server log as they did", () => {
    expect(syslogServerFromEnv({ LOG_SYSLOG_HOST: "10.0.0.9", LOG_SYSLOG_PROTOCOL: "tcp", LOG_SYSLOG_LEVEL: "warn", LOG_SYSLOG_TYPE: "RFC5424" })).toMatchObject({
      name: "syslog", host: "10.0.0.9", port: 514, protocol: "tcp4", path: null, level: "warning", type: "5424", receives: "log", enabled: 1,
    });
    expect(syslogServerFromEnv({ LOG_SYSLOG_HOST: "x", LOG_SYSLOG_PROTOCOL: "unix" }).path).toBe("/dev/log");
  });

  test("imported, then ignored ; kept when a server syslog is there ; none without a host", async () => {
    const m = marker();
    const md = model();
    expect(await importSyslogFromEnvOnce({ env: { LOG_SYSLOG_HOST: "10.0.0.9" }, marker: m, model: md })).toBe("imported");
    expect(md.created[0].host).toBe("10.0.0.9");
    expect(await importSyslogFromEnvOnce({ env: { LOG_SYSLOG_HOST: "10.0.0.9" }, marker: m, model: md })).toBe("ignored");
    expect(md.created.length).toBe(1);
    expect(await importSyslogFromEnvOnce({ env: { LOG_SYSLOG_HOST: "x" }, marker: marker(), model: model({ id: 3 }) })).toBe("kept");
    expect(await importSyslogFromEnvOnce({ env: {}, marker: marker(), model: model() })).toBe("none");
  });
});

describe("what a save may hold", () => {
  test("a new server : the defaults written", () => {
    const d = { name: "a", host: "h" };
    SyslogServer.normalise(d);
    expect(d).toMatchObject({ protocol: "udp4", level: "info", type: "BSD", receives: "both", enabled: 1 });
  });

  test("a host, or a path on a unix socket", () => {
    expect(() => SyslogServer.normalise({ name: "a" })).toThrow(/needs its host/);
    expect(() => SyslogServer.normalise({ name: "a", protocol: "unix" })).toThrow(/needs its path/);
    expect(() => SyslogServer.normalise({ name: "a", protocol: "unix", path: "/dev/log" })).not.toThrow();
    // an update keeps what is stored
    expect(() => SyslogServer.normalise({ level: "debug" }, { host: "h", protocol: "udp4" })).not.toThrow();
  });

  test("a protocol, level, type, what it receives and a port it knows", () => {
    expect(() => SyslogServer.normalise({ name: "a", host: "h", protocol: "http" })).toThrow(/protocol/);
    expect(() => SyslogServer.normalise({ name: "a", host: "h", level: "loud" })).toThrow(/level/);
    expect(() => SyslogServer.normalise({ name: "a", host: "h", receives: "jobs" })).toThrow(/receives/);
    expect(() => SyslogServer.normalise({ name: "a", host: "h", type: "3164" })).toThrow(/type/);
    expect(() => SyslogServer.normalise({ name: "a", host: "h", port: 70000 })).toThrow(/port/);
    const d = { name: "a", host: "h", port: "1514" };
    SyslogServer.normalise(d);
    expect(d.port).toBe(1514);
  });
});
