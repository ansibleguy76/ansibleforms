// winston's syslog levels have `warning` and no `warn`, and winston logs NOTHING at all (errors
// included) for a level it does not know. LOG_LEVEL=warn, the value the documentation once
// gave, silenced the whole log. `warn` is now `warning`, in any case, and any other unknown
// value falls back to the documented default with one warning naming it.
import { test, expect, vi } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
delete process.env.LOG_SYSLOG_HOST;
// the three ways a level variable can be set : the old spelling, the old spelling shouting,
// and a value that names no level at all
process.env.LOG_LEVEL = "warn";
process.env.LOG_CONSOLE_LEVEL = " WARN ";
process.env.LOG_SYSLOG_LEVEL = "loud";

// Stand-ins that record their level, and a logger that records what it warns : this is about
// the levels handed to winston, not about winston's internals.
const built = { console: [], file: [] };
const warnings = [];
class FakeTransport {
  constructor(opts = {}) { this.level = opts.level; this.opts = opts; }
  on() { return this; }
  close() {}
  log(info, cb) { if (cb) cb(); }
}
class FakeConsole extends FakeTransport {
  constructor(opts) { super(opts); built.console.push(this); }
}
class FakeDailyRotateFile extends FakeTransport {
  constructor(opts) { super(opts); built.file.push(this); }
}

vi.mock("winston", () => {
  const printf = () => ({});
  const logger = {
    level: "info",
    add() { return this; },
    remove() { return this; },
    warning(message) { warnings.push(message); },
    error() {}, info() {}, notice() {}, debug() {},
  };
  return {
    default: {
      format: Object.assign(() => () => ({}), { printf, combine: () => ({}) }),
      config: { syslog: { levels: { emerg: 0, alert: 1, crit: 2, error: 3, warning: 4, notice: 5, info: 6, debug: 7 } } },
      createLogger: () => logger,
      transports: { Console: FakeConsole, DailyRotateFile: FakeDailyRotateFile, Syslog: FakeTransport },
    },
  };
});
vi.mock("winston-daily-rotate-file", () => ({ default: {} }));
vi.mock("winston-syslog", () => ({ default: {} }));

const { default: logConfig, parseLogLevel, knownLogLevel } = await import("../config/log.config.js");
const { logLevelOf, setLogLevel } = await import("../src/lib/logger.js");

// the main log file : the rotating transport that is not the errors one
const mainFile = () => built.file.find((t) => t.level !== "error" || !String(t.opts.filename).includes("errors"));

test("LOG_LEVEL=warn logs at warning", () => {
  expect(logConfig.level).toBe("warning");
  expect(mainFile().level).toBe("warning");
});

test("LOG_CONSOLE_LEVEL=WARN, in capitals and spaces, logs at warning", () => {
  expect(logConfig.consolelevel).toBe("warning");
  expect(built.console[0].level).toBe("warning");
});

test("an unknown level falls back to the documented default", () => {
  expect(logConfig.sysloglevel).toBe("debug");
});

test("an unknown level is said once at start, naming the variable and its value", () => {
  const said = warnings.filter((w) => w.includes("LOG_SYSLOG_LEVEL"));
  expect(said).toHaveLength(1);
  expect(said[0]).toContain("LOG_SYSLOG_LEVEL=loud");
  expect(said[0]).toContain("using debug");
  // warn is a known spelling : nothing to say about it
  expect(warnings.some((w) => w.startsWith("LOG_LEVEL=") || w.startsWith("LOG_CONSOLE_LEVEL="))).toBe(false);
});

test("unset, each level variable takes its documented default", () => {
  expect(parseLogLevel("LOG_LEVEL", undefined)).toBe("notice");
  expect(parseLogLevel("LOG_CONSOLE_LEVEL", "")).toBe("notice");
  expect(parseLogLevel("LOG_SYSLOG_LEVEL", "  ")).toBe("debug");
});

test("every syslog level is kept as it is, in any case", () => {
  for (const level of ["emerg", "alert", "crit", "error", "warning", "notice", "info", "debug"]) {
    expect(knownLogLevel(level)).toBe(level);
    expect(knownLogLevel(level.toUpperCase())).toBe(level);
  }
  expect(knownLogLevel("verbose")).toBeNull();
});

test("a level changed later is read the same way, and an unknown one is said", () => {
  warnings.length = 0;
  expect(logLevelOf("LOG_LEVEL", "Warn")).toBe("warning");
  expect(warnings).toHaveLength(0);
  expect(logLevelOf("LOG_LEVEL", "chatty")).toBe("notice");
  expect(warnings).toEqual([expect.stringContaining("LOG_LEVEL=chatty")]);
});

test("setLogLevel never hands winston a level it does not know", () => {
  expect(setLogLevel("console", "warn")).toBe(true);
  expect(built.console[0].level).toBe("warning");
  expect(setLogLevel("console", "chatty")).toBe(false);
  expect(built.console[0].level).toBe("warning");
});
