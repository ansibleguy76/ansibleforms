// A guard that only one API version enforces is not a guard.
//
// /api/v2/query was bound to the form definition so an ordinary user cannot send SQL of
// their own. /api/v1/query was left taking req.body.query verbatim, and it is mounted
// with nothing but `authobj` - so the whole fix was bypassable by changing v2 to v1 in
// the URL. The policy now lives in lib/queryPolicy.js and both controllers call it.
import { test, describe, beforeEach, vi } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

let formResult = null;
vi.mock("../src/models/form.model.js", () => ({
  default: {
    load: async () => {
      if (!formResult) throw new Error("no config");
      return formResult;
    },
  },
}));

let ranWith = null;
vi.mock("../src/models/query.model.js", () => ({
  default: {
    findAll: async (query, jq, config, noLog, values) => { ranWith = { query, jq, config, values }; return [{ ok: 1 }]; },
  },
}));
const { substitute } = await import("../src/lib/queryPolicy.js");
// substitution happens inside Query.findAll now (only it knows the engine) - assert on
// the sql that layer would build from what it was handed
const ranSql = () => substitute(ranWith.query, ranWith.values);

const v1 = (await import("../src/controllers/v1/query.controller.js")).default;
const v2 = (await import("../src/controllers/v2/query.controller.js")).default;

function makeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const call = async (controller, body, user) => {
  const res = makeRes();
  await controller.findAll({ body, query: {}, user: { user } }, res);
  return res;
};

const plainUser = { username: "bob", type: "local", roles: ["public"], options: {} };
const settingsUser = { username: "root", type: "local", roles: ["admin"], options: { showSettings: true } };

beforeEach(() => {
  ranWith = null;
  formResult = {
    forms: [{
      name: "Servers",
      fields: [{ name: "host", query: "SELECT name FROM hosts WHERE env = '$(env)'", dbConfig: "cmdb" }],
    }],
  };
});

describe.each([["v1", () => v1], ["v2", () => v2]])("%s enforces the same policy", (name, get) => {
  const controller = get();

  test("a raw query from an ordinary user is refused, and never runs", async () => {
    const res = await call(controller, { query: "SELECT * FROM users", config: "cmdb" }, plainUser);
    assert.equal(res.statusCode, 403, "401 would log the user out; this is a permission answer");
    assert.equal(ranWith, null, "the query must never reach the database");
  });

  test("a settings user may still send a raw query", async () => {
    const res = await call(controller, { query: "SELECT 1", config: "cmdb" }, settingsUser);
    assert.equal(res.statusCode, 200);
    assert.equal(ranWith.query, "SELECT 1");
  });

  test("a form-bound query ignores the body's SQL and datasource", async () => {
    const res = await call(controller, {
      formName: "Servers", fieldName: "host",
      values: { env: "prod" },
      query: "SELECT * FROM users -- what the caller tried to run",
      config: "some-other-datasource",
    }, plainUser);
    assert.equal(res.statusCode, 200);
    assert.match(ranWith.query, /FROM hosts/, "the definition's query must win");
    assert.equal(ranWith.query.includes("FROM users"), false);
    assert.equal(ranWith.config, "cmdb");
  });

  test("substituted values cannot break out of a quoted placeholder", async () => {
    await call(controller, {
      formName: "Servers", fieldName: "host",
      values: { env: "prod' OR 1=1 -- " },
    }, plainUser);
    assert.match(ranSql(), /env = 'prod'' OR 1=1 -- '/);
  });

  test("a form the caller cannot see is refused", async () => {
    formResult = { forms: [] };
    const res = await call(controller, { formName: "Secret", fieldName: "host", values: {} }, plainUser);
    assert.equal(res.statusCode, 404);
    assert.equal(ranWith, null);
  });
});

describe("neither controller re-implements the policy", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const read = (p) => readFileSync(path.join(here, p), "utf8");

  test.each([
    ["v1", "../src/controllers/v1/query.controller.js"],
    ["v2", "../src/controllers/v2/query.controller.js"],
  ])("%s delegates to lib/queryPolicy", (name, file) => {
    const src = read(file);
    assert.match(src, /from ['"]\.\.\/\.\.\/lib\/queryPolicy\.js['"]/);
    assert.match(src, /await resolveQuery\(req\)/);
    // the body's query must not be read directly any more - that is the bug
    assert.doesNotMatch(src, /Query\.findAll\(\s*req\.body\.query/);
  });
});
