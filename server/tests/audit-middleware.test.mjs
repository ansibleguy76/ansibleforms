// The blanket audit middleware, against a real express server.
//
// Every case here is a way the trail could be defeated or flooded, found in a
// pre-release adversarial review:
//  - a client that aborts mid-request had its mutation performed and NOT recorded,
//    because node emits 'close' rather than 'finish' on an abort
//  - an unrouted path still reaches this middleware, so an unauthenticated caller could
//    write one row per request with an action of its own choosing
//  - a query string can carry a credential, which key-based scrubbing cannot catch
import { test, describe, beforeEach, afterEach, vi } from "vitest";
import assert from "node:assert/strict";
import express from "express";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

let rows = [];
vi.mock("../src/models/audit.model.js", () => ({
  default: { log: async (e) => { rows.push(e); } },
}));

const mw = (await import("../src/lib/auditMiddleware.js")).default;
const { pathOnly } = await import("../src/lib/auditMiddleware.js");

let server;
let base;

beforeEach(async () => {
  rows = [];
  const app = express();
  app.use("/api", mw);
  app.post("/api/v2/ok", (req, res) => res.json({ ok: 1 }));
  app.get("/api/v2/ok", (req, res) => res.json({ ok: 1 }));
  app.post("/api/v2/slow", async (req, res) => {
    await new Promise((r) => setTimeout(r, 400));
    res.json({ mutated: 1 });
  });
  app.post("/api/v2/boom", (req, res) => res.status(500).json({ e: 1 }));
  app.post("/api/v2/denied", (req, res) => res.status(403).json({ e: 1 }));
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  await new Promise((r) => server.close(r));
});

const settle = (ms = 200) => new Promise((r) => setTimeout(r, ms));

describe("what gets recorded", () => {
  test("a normal mutation is recorded once", async () => {
    await fetch(`${base}/api/v2/ok`, { method: "POST" });
    await settle();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].action, "ok.create");
    assert.equal(rows[0].outcome, "success");
  });

  test("a GET is not recorded : reads would bury the mutations", async () => {
    await fetch(`${base}/api/v2/ok`);
    await settle();
    assert.equal(rows.length, 0);
  });

  test("a refusal is 'denied' and a server error is 'failure'", async () => {
    await fetch(`${base}/api/v2/denied`, { method: "POST" });
    await fetch(`${base}/api/v2/boom`, { method: "POST" });
    await settle();
    assert.deepEqual(rows.map((r) => r.outcome).sort(), ["denied", "failure"]);
  });
});

describe("the trail cannot be defeated", () => {
  test("an ABORTED request is still recorded", async () => {
    // the handler runs to completion regardless, so the mutation happened : without a
    // 'close' listener the client could suppress the record by hanging up
    const ac = new AbortController();
    fetch(`${base}/api/v2/slow`, { method: "POST", signal: ac.signal }).catch(() => {});
    await settle(60);
    ac.abort();
    await settle(800);
    assert.equal(rows.length, 1, "an aborted mutation must not vanish");
    assert.equal(rows[0].action, "slow.create");
    assert.equal(rows[0].outcome, "failure");
    assert.equal(rows[0].detail.aborted, true);
  });

  test("one request produces exactly one row, never two", async () => {
    // 'finish' and 'close' both fire on a normal response
    await fetch(`${base}/api/v2/ok`, { method: "POST" });
    await settle(400);
    assert.equal(rows.length, 1);
  });
});

describe("the trail cannot be flooded or used to store secrets", () => {
  test("an unrouted path writes nothing", async () => {
    await fetch(`${base}/api/v2/${"Z".repeat(80)}/junk`, { method: "POST" });
    await fetch(`${base}/api/notaversion/whatever`, { method: "POST" });
    await settle();
    assert.equal(rows.length, 0, "a 404 changed nothing, so there is nothing to audit");
  });

  test("the query string is never recorded", async () => {
    await fetch(`${base}/api/v2/ok?token=ghp_SUPERSECRET&password=hunter2`, { method: "POST" });
    await settle();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].detail.url, "/api/v2/ok");
    assert.equal(JSON.stringify(rows[0]).includes("SUPERSECRET"), false);
  });

  test("pathOnly strips a query and tolerates junk", () => {
    assert.equal(pathOnly("/api/v2/x?a=1&b=2"), "/api/v2/x");
    assert.equal(pathOnly("/api/v2/x"), "/api/v2/x");
    assert.equal(pathOnly(undefined), "");
    assert.equal(pathOnly("?only=query"), "");
  });
});

// ─── the target of a REFUSED request ──────────────────────────
//
// When an app-level guard (checkSettingsMiddleware, authobj) answers 403, express has
// already stripped the mount prefix from req.path and only restores it inside next() -
// which a refusing guard never calls. So at finish time req.path is '/myrepo', not
// '/api/v2/repository/myrepo'. Verified against express directly. The old fallback did
// segments.slice(3) on that mount-relative path, dropped everything, and recorded
// target: null on exactly the rows this branch exists to name.
describe("targetFrom names the object of a refused request", () => {
  const here2 = path.dirname(fileURLToPath(import.meta.url));
  const src2 = readFileSync(path.join(here2, "../src/lib/auditMiddleware.js"), "utf8");
  const body = /function targetFrom\([\s\S]*?\n\}/.exec(src2)[0];
  const targetFrom = new Function(`${body}; return targetFrom;`)();

  test("it was extracted, so these assertions are not vacuous", () => {
    assert.equal(typeof targetFrom, "function");
  });

  test("a guard refusal still names the repository", () => {
    // baseUrl + path is what express leaves behind in that case
    assert.equal(targetFrom("/myrepo", undefined, "/api/v2/repository"), "myrepo");
  });

  test("a named sub-action keeps its whole tail", () => {
    assert.equal(targetFrom("/myrepo/pull", undefined, "/api/v2/repository"), "myrepo/pull");
  });

  test("a routed request still reads the parameter positionally", () => {
    // here path and routePath are both router-relative, and baseUrl is irrelevant
    assert.equal(targetFrom("/myrepo", "/:name", "/api/v2/repository"), "myrepo");
    assert.equal(targetFrom("/42/approve", "/:id/approve", "/api/v2/job"), "42");
  });

  test("an unrouted path with nothing to name is still null", () => {
    assert.equal(targetFrom("/", undefined, "/api/v2/repository"), null);
  });

  test("the numeric fallback still works", () => {
    assert.equal(targetFrom("/5", undefined, "/api/v2/user"), "5");
  });
});
