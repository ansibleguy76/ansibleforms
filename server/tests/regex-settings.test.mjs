// Two settings are operator-supplied REGULAR EXPRESSIONS, and both are live-editable from
// the settings page: MASK_EXTRAVARS_REGEX and REGEX_FILTER_JOB_OUTPUT.
//
// Both were interpolated straight into `new RegExp`, on hot paths - a logging call in the
// job launcher, and the job output formatter that runs per line of every job. So a single
// stray bracket typed into a settings field threw a SyntaxError from inside logging and
// from inside Job.findById (which rethrows), aborting job launches and making every job
// unviewable, with nothing at the point of entry to say why. The log viewer's filter in
// logs.vue had already been fixed for exactly this; these two were the server's copy of it.
//
// The mask is the interesting half: its failure mode must be to keep MASKING. Dropping the
// pattern would write the credentials it exists to hide into the log, which is worse than
// the crash it replaced - so the fallback is the documented default, never "no pattern".
import { test, describe, expect, beforeEach, afterAll, vi } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

const logged = [];
vi.mock("../src/lib/logger.js", () => ({
  default: {
    error: (m) => logged.push(String(m)),
    warning: (m) => logged.push(String(m)),
    info: () => {}, notice: () => {}, debug: () => {},
  },
}));

const Helpers = (await import("../src/lib/common.js")).default;
const appConfig = (await import("./__mocks__/app.config.js")).default;
const EnvSettings = (await import("../src/lib/envSettings.js")).default;

const before = { ...appConfig };
beforeEach(() => { logged.length = 0; });
afterAll(() => { Object.assign(appConfig, before); });

const EXTRAVARS = '{"host":"web01","password":"hunter2","api_token":"abc123"}';

describe("a broken mask pattern must not stop masking", () => {
  test("a valid custom pattern masks what it names", () => {
    appConfig.maskExtravarsRegex = "password|token";
    const out = Helpers.logSafe(EXTRAVARS);
    expect(out).not.toContain("hunter2");
    expect(out).not.toContain("abc123");
    expect(out).toContain("web01");          // not a secret, still readable
  });

  test("an uncompilable pattern does not throw", () => {
    appConfig.maskExtravarsRegex = "password|[";
    expect(() => Helpers.logSafe(EXTRAVARS)).not.toThrow();
  });

  test("and it still masks, using the documented default", () => {
    appConfig.maskExtravarsRegex = "password|(";
    const out = Helpers.logSafe(EXTRAVARS);
    expect(out, "falling back to NO pattern would log the credential in clear").not.toContain("hunter2");
    expect(out).not.toContain("abc123");
    expect(logged.join(" ")).toMatch(/MASK_EXTRAVARS_REGEX is not a valid regular expression/);
  });

  test("the warning is not repeated for every call", () => {
    appConfig.maskExtravarsRegex = "still|bad|[";
    Helpers.logSafe(EXTRAVARS);
    const first = logged.length;
    Helpers.logSafe(EXTRAVARS);
    Helpers.logSafe(EXTRAVARS);
    expect(logged.length, "a bad value would otherwise log once per line of output").toBe(first);
  });
});

describe("a broken output filter must not make jobs unviewable", () => {
  // asText:false is the COLORIZING path - the one that compiles the filter. asText:true
  // returns the raw text long before it, so passing true tests nothing here.
  const records = [{ output: "TASK [something] ****", output_type: "stdout", timestamp: "2026-07-31 12:00:00", order: 1 }];

  test("a valid filter formats normally", () => {
    appConfig.filterJobOutputRegex = "\\[low\\]";
    expect(() => Helpers.formatOutput(records, false)).not.toThrow();
  });

  test("an uncompilable filter formats anyway", () => {
    appConfig.filterJobOutputRegex = "[unclosed";
    expect(() => Helpers.formatOutput(records, false)).not.toThrow();
    expect(logged.join(" "), "the compile has to actually be reached").toMatch(/REGEX_FILTER_JOB_OUTPUT is not a valid regular expression/);
  });

  test("the old code really did throw from here, so this is not vacuous", () => {
    // the exact expression the formatter used before the guard. Assembled at runtime
    // because eslint's no-invalid-regexp reads a literal one statically and fails the
    // lint - which is itself the point: this pattern does not compile.
    const bad = appConfig.filterJobOutputRegex;
    expect(() => new RegExp(bad, "i")).toThrow();
  });
});

describe("and the settings page refuses it in the first place", () => {
  // the consumers fall back, but the honest place to say no is the field it was typed into
  const doc = { type: "string", allowed: "an escaped regular expression" };

  test("an uncompilable value is rejected", () => {
    expect(EnvSettings.validate("MASK_EXTRAVARS_REGEX", "password|[", doc))
      .toMatch(/not a valid regular expression/);
    expect(EnvSettings.validate("REGEX_FILTER_JOB_OUTPUT", "(unclosed", doc))
      .toMatch(/not a valid regular expression/);
  });

  test("a valid one is accepted", () => {
    expect(EnvSettings.validate("MASK_EXTRAVARS_REGEX", "password|secret|token", doc)).toBeNull();
    expect(EnvSettings.validate("REGEX_FILTER_JOB_OUTPUT", "\\[low\\]", doc)).toBeNull();
  });

  test("clearing it is still allowed - that means 'back to the default'", () => {
    expect(EnvSettings.validate("MASK_EXTRAVARS_REGEX", "", doc)).toBeNull();
  });

  test("a variable that is not documented as a regex is not regex-checked", () => {
    // '[' is a fine value for a path or a label
    expect(EnvSettings.validate("BACKUP_PATH", "/data/[weird", { type: "string", allowed: "a valid directory path" })).toBeNull();
  });
});
