// The four database variables must be reported by their own name when they are missing.
//
// db.config.js throws at import when any of them is absent, so this message is the FIRST
// thing an operator sees when a container will not start - and it is all they get, because
// the process dies before anything else is logged. A copy-paste left the DB_PASSWORD check
// reporting "DB_USER is missing", which sends someone to look at the wrong variable in a
// situation where they have nothing else to go on.
//
// Not covered by anything else: this file is imported once per process by everything that
// touches the database, so by the time any other test runs it is already cached with a
// complete environment and the failure branch never executes.
import { test, describe, expect, vi, beforeEach, afterAll } from "vitest";

const DB_VARS = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD"];
const original = Object.fromEntries(DB_VARS.map((v) => [v, process.env[v]]));

const logged = [];
vi.mock("../src/lib/logger.js", () => ({
  default: {
    error: (m) => logged.push(String(m)),
    warning: () => {}, info: () => {}, notice: () => {}, debug: () => {},
  },
}));

function setAll() {
  for (const v of DB_VARS) process.env[v] = "x";
}

/** Import db.config with exactly one variable missing, and return what it logged. */
async function importMissing(missing) {
  setAll();
  delete process.env[missing];
  logged.length = 0;
  vi.resetModules();          // it is cached after the first import, so force a re-evaluation
  let threw = null;
  try {
    await import("../config/db.config.js");
  } catch (e) {
    threw = e;
  }
  return { logged: [...logged], threw };
}

beforeEach(() => { logged.length = 0; });
afterAll(() => {
  for (const [k, v] of Object.entries(original)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
});

describe("a missing database variable is named correctly", () => {
  test.each(DB_VARS)("%s is reported as itself", async (missing) => {
    const { logged: lines, threw } = await importMissing(missing);
    const named = lines.filter((l) => /is missing$/.test(l));
    expect(named, `expected exactly one "<VAR> is missing" line, got ${JSON.stringify(lines)}`).toHaveLength(1);
    expect(named[0]).toBe(`${missing} is missing`);
    // and the others must NOT be blamed
    for (const other of DB_VARS.filter((v) => v !== missing)) {
      expect(named[0]).not.toContain(other);
    }
    expect(threw, "a missing database variable has to stop the boot").toBeTruthy();
  });

  test("the thrown error names all four, so the fix is obvious", async () => {
    const { threw } = await importMissing("DB_HOST");
    for (const v of DB_VARS) expect(threw.message).toContain(v);
  });

  test("with everything set it imports cleanly and exports the connection", async () => {
    setAll();
    logged.length = 0;
    vi.resetModules();
    const cfg = (await import("../config/db.config.js")).default;
    expect(logged.filter((l) => /is missing/.test(l))).toEqual([]);
    expect(cfg.host).toBe("x");
    expect(cfg.user).toBe("x");
    expect(cfg.port).toBe("x");
    // the password is carried but must never be logged
    expect(cfg.password).toBe("x");
    expect(logged.join(" ")).not.toContain("x");
  });
});
