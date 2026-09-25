// API_BODY_LIMIT_MB is a LIVE setting, and the only thing that makes it live is the
// indirection in lib/bodyParsers.js.
//
// body-parser bakes `limit` in when the middleware is CREATED. Express keeps whatever
// object it was handed at startup, so `app.use(bodyParser.json({limit}))` can never change
// again without a restart. The fix is a stable pair of wrappers that express holds forever,
// delegating to a parser the settings page can replace underneath.
//
// Both halves of that are silent when broken, which is why they are pinned here:
//
//  - if app.js is ever "simplified" back to app.use(bodyParser.json(...)), rebuild() still
//    runs and still reports success, the settings page still says the value was applied,
//    and the limit in force is still the one from startup. Nothing throws.
//  - if the wrappers ever capture the parser instead of dereferencing it per request
//    (`export const jsonBody = jsonParser`), the same thing happens for the same reason.
//
// The parser itself is faked : this is about which object express ends up calling, not
// about body-parser's own byte counting.
import { test, describe, beforeEach, expect, vi } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

const serverRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// records every parser built, and every parser actually invoked
const spy = vi.hoisted(() => ({ built: [], invoked: [] }));

vi.mock("body-parser", () => {
  const make = (kind) => (opts) => {
    const mw = (req, res, next) => { spy.invoked.push({ kind, limit: opts.limit }); next(); };
    spy.built.push({ kind, ...opts });
    return mw;
  };
  return { default: { json: make("json"), urlencoded: make("urlencoded") } };
});

// bodyParsers.js imports '../../config/app.config.js', which vitest.config.js aliases to
// this stub - so a vi.mock of the real path would resolve to a different module id and do
// nothing. Import the stub itself and set the field on it ; it is the same object.
import appConfig from "./__mocks__/app.config.js";
import { jsonBody, urlencodedBody, rebuildBodyParsers } from "../src/lib/bodyParsers.js";

const run = (mw) => new Promise((resolve) => mw({}, {}, resolve));

describe("the body parser limit is live", () => {
  beforeEach(() => {
    spy.built.length = 0;
    spy.invoked.length = 0;
    delete appConfig.apiBodyLimitMb;
  });

  test("a rebuild is visible through the reference express already holds", async () => {
    // exactly what app.js does : take the reference ONCE, at startup
    const installedJson = jsonBody;
    const installedUrlencoded = urlencodedBody;

    appConfig.apiBodyLimitMb = 7;
    rebuildBodyParsers();
    await run(installedJson);
    await run(installedUrlencoded);
    expect(spy.invoked).toEqual([
      { kind: "json", limit: "7mb" },
      { kind: "urlencoded", limit: "7mb" },
    ]);

    // the settings page saves a new value : the SAME references must now use it
    spy.invoked.length = 0;
    appConfig.apiBodyLimitMb = 123;
    rebuildBodyParsers();
    await run(installedJson);
    await run(installedUrlencoded);
    expect(spy.invoked).toEqual([
      { kind: "json", limit: "123mb" },
      { kind: "urlencoded", limit: "123mb" },
    ]);
  });

  test("the documented default is 50mb, and a junk value falls back to it", async () => {
    for (const bad of [undefined, 0, NaN, ""]) {
      spy.invoked.length = 0;
      appConfig.apiBodyLimitMb = bad;
      rebuildBodyParsers();
      await run(jsonBody);
      expect(spy.invoked[0].limit, `apiBodyLimitMb=${String(bad)}`).toBe("50mb");
    }
  });

  test("urlencoded keeps extended:true, or nested form bodies stop parsing", () => {
    appConfig.apiBodyLimitMb = 5;
    rebuildBodyParsers();
    expect(spy.built.find((b) => b.kind === "urlencoded").extended).toBe(true);
  });

  test("rebuild reports success, which is what the settings page shows the operator", () => {
    appConfig.apiBodyLimitMb = 5;
    expect(rebuildBodyParsers()).toBe(true);
  });
});

describe("the wiring that makes it live", () => {
  test("app.js installs the indirection, never a parser built at startup", () => {
    const app = readFileSync(path.join(serverRoot, "src/app.js"), "utf8");
    expect(app).toMatch(/app\.use\(\s*jsonBody\s*\)/);
    expect(app).toMatch(/app\.use\(\s*urlencodedBody\s*\)/);
    // the regression: a parser constructed inline is frozen at startup
    expect(app).not.toMatch(/app\.use\(\s*(?:bodyParser|express)\.(?:json|urlencoded)\s*\(/);
  });

  test("the wrappers dereference per request instead of capturing the parser", () => {
    const src = readFileSync(path.join(serverRoot, "src/lib/bodyParsers.js"), "utf8");
    // `export const jsonBody = jsonParser` would bind the parser that existed at import
    expect(src).not.toMatch(/export const (?:jsonBody|urlencodedBody)\s*=\s*(?:json|urlencoded)Parser\s*[;\n]/);
  });

  test("API_BODY_LIMIT_MB is wired to a rebuild, not merely stored on appConfig", () => {
    const env = readFileSync(path.join(serverRoot, "src/lib/envSettings.js"), "utf8");
    const line = env.split("\n").find((l) => l.includes("API_BODY_LIMIT_MB:"));
    expect(line, "API_BODY_LIMIT_MB must have a LIVE_CUSTOM applier").toBeTruthy();
    expect(line).toContain("rebuildBodyParsers");
  });
});
