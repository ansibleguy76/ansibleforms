// Every audit row must say WHAT it was about.
//
// A blank target is invisible until somebody reads the table looking for "who created that
// user" and finds a row that only says `user.create`. It was the commonest gap in a real
// audit table: a collection-level POST (`/api/v2/user`, `/group`, `/repository`) carries no
// :param, so the positional read had nothing to work with and every create recorded null.
//
// Three sources, in order, and the last one cannot fail - so no row is ever blank:
//   1. the :param in the matched route             (DELETE /repository/:name -> 'myrepo')
//   2. an identifying field from the body, by an explicit ALLOWLIST of key names
//   3. the resource itself                         (POST /expression -> 'expression')
//
// The allowlist is the whole safety argument for reading the body at all, so it is pinned
// here as hard as the behaviour: a key not on it must never be read, whatever it contains.
import { test, describe } from "vitest";
import assert from "node:assert/strict";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

const { targetFrom, targetFromBody, resourceFrom } = await import("../src/lib/auditMiddleware.js");

/** What the middleware would store, given the three sources in order. */
const targetOf = (req) =>
  targetFrom(req.path, req.routePath, req.baseUrl) ||
  targetFromBody(req.body) ||
  resourceFrom(req.baseUrl, req.path);

describe("the :param still wins", () => {
  test("a routed delete names the object from the URL", () => {
    assert.equal(
      targetOf({ baseUrl: "/api/v2/repository", path: "/myrepo", routePath: "/:name", body: { name: "other" } }),
      "myrepo",
      "the URL is the object being acted on - the body must not override it"
    );
  });

  test("a refused request still names what was attempted", () => {
    // an app-level guard answers 403 before routing, so there is no route pattern
    assert.equal(targetOf({ baseUrl: "/api/v2/repository", path: "/myrepo", routePath: null, body: {} }), "myrepo");
  });
});

describe("a collection-level create names the thing being created", () => {
  const cases = [
    ["/api/v2/user", { username: "alice", password: "hunter2" }, "alice"],
    ["/api/v2/group", { name: "operators" }, "operators"],
    ["/api/v2/repository", { name: "forms-repo" }, "forms-repo"],
    ["/api/v2/job", { formName: "deploy", extravars: { x: 1 } }, "deploy"],
    ["/api/v2/query", { formName: "deploy", query: "select 1" }, "deploy"],
    ["/api/v2/backup", { folder: "2026-07-31T00-00-00" }, "2026-07-31T00-00-00"],
  ];
  for (const [baseUrl, body, expected] of cases) {
    test(`POST ${baseUrl} -> ${expected}`, () => {
      assert.equal(targetOf({ baseUrl, path: "/", routePath: "/", body }), expected);
    });
  }
});

describe("the body allowlist is the safety boundary", () => {
  test("a password or a token is never read, even as the only field", () => {
    for (const body of [
      { password: "hunter2" },
      { token: "s3cr3t" },
      { VAULT_TOKEN: "s3cr3t" },
      { secret: "s3cr3t" },
      { currentPassword: "hunter2" },
    ]) {
      assert.equal(targetFromBody(body), null, `read a value it must not: ${Object.keys(body)[0]}`);
    }
  });

  test("user data that is not an identifier is not read", () => {
    // a raw query or expression can carry values that key-based scrubbing cannot see,
    // which is the same reason the query string is dropped from the url
    assert.equal(targetFromBody({ query: "select * from users" }), null);
    assert.equal(targetFromBody({ expression: "fn.fnLs('/etc')" }), null);
  });

  test("only a short scalar is accepted, so no document can be smuggled in", () => {
    assert.equal(targetFromBody({ name: { deep: "object" } }), null);
    assert.equal(targetFromBody({ name: ["a", "b"] }), null);
    assert.equal(targetFromBody({ name: "x".repeat(256) }), null);
    assert.equal(targetFromBody({ name: "x".repeat(255) }), "x".repeat(255));
  });

  test("a blank or whitespace name falls through rather than storing nothing", () => {
    assert.equal(targetFromBody({ name: "   " }), null);
    assert.equal(targetFromBody({ name: "", username: "alice" }), "alice");
  });

  test("survives a body that is absent or not an object", () => {
    for (const b of [undefined, null, "string", 42, []]) assert.equal(targetFromBody(b), null);
  });
});

describe("nothing is ever recorded blank", () => {
  test("an endpoint with no identifier at all falls back to the resource", () => {
    assert.equal(targetOf({ baseUrl: "/api/v2/expression", path: "/", routePath: "/", body: { expression: "1+1" } }), "expression");
    assert.equal(targetOf({ baseUrl: "/api/v2/lock", path: "/", routePath: "/", body: {} }), "lock");
    // a sub-resource is named by targetFrom's own tail branch before the fallback is
    // reached, and 'env' is the more useful answer than 'config'
    assert.equal(targetOf({ baseUrl: "/api/v2/config/env", path: "/", routePath: "/", body: {} }), "env");
  });

  test("every shape the middleware can see yields a target", () => {
    const shapes = [
      { baseUrl: "/api/v2/user", path: "/", routePath: "/", body: {} },
      { baseUrl: "/api/v2/settings", path: "/config", routePath: "/config", body: {} },
      { baseUrl: "/api/v1/credential", path: "/", routePath: "/", body: {} },
      { baseUrl: "", path: "/api/v2/group", routePath: null, body: {} },
    ];
    for (const s of shapes) {
      const t = targetOf(s);
      assert.ok(t && String(t).trim(), `blank target for ${s.baseUrl}${s.path}`);
    }
  });

  test("resourceFrom strips api and the version, whichever way the mount is split", () => {
    assert.equal(resourceFrom("/api/v2/repository", "/myrepo"), "repository");
    assert.equal(resourceFrom("", "/api/v2/repository/myrepo"), "repository");
    assert.equal(resourceFrom("/api/v1/user", "/"), "user");
  });
});
