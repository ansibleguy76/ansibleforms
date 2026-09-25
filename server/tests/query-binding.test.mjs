// The query endpoint used to run whatever SQL was in the request body, on a route carrying
// nothing but JWT auth - so any authenticated user could read or write any configured
// datasource with the stored credential's privileges, whatever their role options said.
//
// It is now bound to the form: the client sends formName + fieldName + values, and the
// server takes the QUERY TEXT from the definition, loaded with the caller's own roles. A
// raw query in the body is still accepted from a showSettings user, because the designer
// previews queries that way and that user can rewrite the whole config anyway.
import { test, describe, beforeEach, vi } from "vitest";
import assert from "node:assert/strict";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

// what Form.load returns, per test
let formResult = null;
let formLoadArgs = null;
vi.mock("../src/models/form.model.js", () => ({
  default: {
    load: async (roles, name) => {
      formLoadArgs = { roles, name };
      if (!formResult) throw new Error("no config");
      return formResult;
    },
  },
}));

// capture what actually reaches the database layer. `query` is the TEMPLATE now :
// substitution moved into Query.findAll, which is the only layer that knows each
// datasource's engine and therefore how a value has to be escaped.
let ranWith = null;
vi.mock("../src/models/query.model.js", () => ({
  default: {
    findAll: async (query, jq, config, noLog, values) => { ranWith = { query, jq, config, values }; return [{ ok: 1 }]; },
  },
}));
// what Query.findAll would build from what it was handed
const ranSql = () => substitute(ranWith.query, ranWith.values);

const { escapeSqlValue, substitute } = await import("../src/controllers/v2/query.controller.js");
const controller = (await import("../src/controllers/v2/query.controller.js")).default;

function makeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const call = async (body, user, query = {}) => {
  const res = makeRes();
  await controller.findAll({ body, query, user: { user } }, res);
  return res;
};

const plainUser = { username: "bob", type: "local", roles: ["public"], options: {} };
const settingsUser = { username: "root", type: "local", roles: ["admin"], options: { showSettings: true } };

beforeEach(() => {
  ranWith = null; formLoadArgs = null;
  formResult = {
    forms: [{
      name: "Servers",
      fields: [{ name: "host", query: "SELECT name FROM hosts WHERE env = '$(env)'", dbConfig: "cmdb" }],
    }],
  };
});

describe("a raw query is refused for an ordinary user", () => {
  test("403, and nothing reaches the database", async () => {
    const res = await call({ query: "SELECT * FROM users", config: "cmdb" }, plainUser);
    assert.equal(res.statusCode, 403, "401 would log the user out; this is a permission answer");
    assert.equal(ranWith, null, "the query must never have run");
  });

  test("a settings user may still send a raw query, for the designer preview", async () => {
    const res = await call({ query: "SELECT 1", config: "cmdb" }, settingsUser);
    assert.equal(res.statusCode, 200);
    assert.equal(ranWith.query, "SELECT 1");
  });
});

describe("a form-bound query comes from the definition, not the body", () => {
  test("the body's query text is ignored entirely", async () => {
    const res = await call({
      formName: "Servers", fieldName: "host",
      values: { env: "prod" },
      query: "SELECT * FROM users -- what the caller tried to run",
      config: "some-other-datasource",
    }, plainUser);
    assert.equal(res.statusCode, 200);
    assert.match(ranWith.query, /FROM hosts/, "the definition's query must win");
    assert.equal(ranWith.query.includes("FROM users"), false, "the body's query must be ignored");
    assert.equal(ranWith.config, "cmdb", "the datasource comes from the definition too");
  });

  test("the form is loaded with the CALLER's roles", async () => {
    await call({ formName: "Servers", fieldName: "host", values: {} }, plainUser);
    assert.deepEqual(formLoadArgs.roles, ["public"], "a form they may not see must be unreachable");
    assert.equal(formLoadArgs.name, "Servers");
  });

  test("a form the caller cannot see is a 404, not a query", async () => {
    formResult = { forms: [] };
    const res = await call({ formName: "Secret", fieldName: "host", values: {} }, plainUser);
    assert.equal(res.statusCode, 404);
    assert.equal(ranWith, null);
  });

  test("a field with no query is refused", async () => {
    formResult = { forms: [{ name: "Servers", fields: [{ name: "host" }] }] };
    const res = await call({ formName: "Servers", fieldName: "host", values: {} }, plainUser);
    assert.equal(res.statusCode, 404);
    assert.equal(ranWith, null);
  });
});

describe("substituted values cannot break out of a quoted placeholder", () => {
  test("the classic injection is neutralised", async () => {
    await call({
      formName: "Servers", fieldName: "host",
      values: { env: "prod' OR 1=1 -- " },
    }, plainUser);
    // the quote is doubled, so it stays inside the literal
    assert.match(ranSql(), /env = 'prod'' OR 1=1 -- '/);
  });

  test("a backslash cannot escape the closing quote", () => {
    // MySQL treats \\ as an escape, so `x\` would otherwise swallow the closing quote
    assert.equal(escapeSqlValue("x\\"), "x\\\\");
  });

  test("numbers and booleans stay unquoted values", () => {
    assert.equal(escapeSqlValue(5), "5");
    assert.equal(escapeSqlValue(true), "true");
  });

  test("null and undefined become empty, not the words", () => {
    assert.equal(escapeSqlValue(null), "");
    assert.equal(escapeSqlValue(undefined), "");
  });

  test("a non-finite number is absent, not pasted as an identifier", () => {
    // String(NaN) is 'NaN', which MySQL parses as a COLUMN NAME - `WHERE n = NaN` fails
    // with "Unknown column 'NaN'". Unreachable over HTTP (JSON carries no NaN) but this
    // is the function that decides, so it must not rely on that.
    assert.equal(escapeSqlValue(NaN), "");
    assert.equal(escapeSqlValue(Infinity), "");
    assert.equal(escapeSqlValue(-Infinity), "");
    // finite ones are unchanged
    assert.equal(escapeSqlValue(0), "0");
    assert.equal(escapeSqlValue(-1.5), "-1.5");
  });

  test("an object is json, escaped", () => {
    // the doubled quote is SQL escaping, written here with a backslash so it is valid JS
    assert.equal(escapeSqlValue({ a: "it's" }), '{"a":"it\'\'s"}');
  });

  test("an unknown placeholder is left alone rather than blanked", () => {
    assert.equal(substitute("a $(nope) b", {}), "a $(nope) b");
  });

  test("every occurrence is substituted, not just the first", () => {
    assert.equal(substitute("$(x)-$(x)", { x: "a" }), "a-a");
  });
});
