// The query endpoint takes its SQL from the form definition and substitutes the caller's
// values into it. Three things about that were wrong, and each is pinned below.
//
//  1. A subform could not be resolved at all. The client renders a wizard step and a list
//     row with the SUBFORM as its currentForm, so it sent the subform's name - and the
//     schema forbids a subform from carrying `roles`, so checkFormRole denies it and
//     Form.load THROWS. Every query field inside a wizard or a list row answered 500, for
//     everyone except an admin, who short-circuits the role check and so never saw it.
//  2. Substitution was a flat lookup by field name, so the documented placeholder forms -
//     `$(city.name)`, `$(rows[0].id)` and placeholderColumn - were either left in the SQL
//     verbatim or replaced by the whole record. The client resolves them and now sends the
//     result keyed by the raw placeholder text.
//  3. Escaping was mysql's for every engine. Doubling a backslash is REQUIRED on mysql and
//     is data corruption on postgres/mssql/oracle, where it is a literal - and mongodb is
//     json, not sql, so a double quote broke the document.
import { test, describe, beforeEach, vi } from "vitest";
import assert from "node:assert/strict";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

let formResult = null;
let formLoadArgs = null;
vi.mock("../src/models/form.model.js", () => ({
  default: {
    load: async (roles, name) => {
      formLoadArgs = { roles, name };
      if (!formResult) throw new Error("no config");
      // what Form.load really does for a form the caller's roles do not grant
      if (formResult === "denied") {
        const e = new Error(`Access denied to form ${name}.`);
        e.name = "AccessDeniedError";
        throw e;
      }
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

const { substitute, escapeSqlValue } = await import("../src/lib/queryPolicy.js");
const controller = (await import("../src/controllers/v2/query.controller.js")).default;

function makeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const call = async (body, user) => {
  const res = makeRes();
  await controller.findAll({ body, query: {}, user: { user } }, res);
  return res;
};
const ranSql = (dialect) => substitute(ranWith.query, ranWith.values, dialect);

const plainUser = { username: "bob", type: "local", roles: ["public"], options: {} };

beforeEach(() => {
  ranWith = null; formLoadArgs = null;
  formResult = {
    constants: { TENANT: "acme", NET: { vlan: 42 } },
    forms: [{
      name: "Provision",
      fields: [{ name: "host", query: "SELECT n FROM h WHERE t = '$(TENANT)'", dbConfig: "cmdb" }],
      subforms: [{
        name: "NicStep",
        fields: [
          { name: "subnet", query: "SELECT s FROM nets WHERE city = '$(city.name)'", dbConfig: "cmdb" },
          { name: "noquery" },
        ],
      }],
    }],
  };
});

describe("a field inside a subform resolves through its root form", () => {
  test("the root form is what gets loaded, never the subform", async () => {
    const res = await call({
      formName: "Provision", subformName: "NicStep", fieldName: "subnet",
      values: { "city.name": "Ghent" },
    }, plainUser);
    assert.equal(res.statusCode, 200, "a wizard/list-row query field must not 500");
    assert.equal(formLoadArgs.name, "Provision", "the ROOT form carries the roles; a subform has none");
    assert.match(ranSql(), /city = 'Ghent'/);
  });

  test("a subform that is not part of that form is a 404, not a query", async () => {
    const res = await call({
      formName: "Provision", subformName: "SomeoneElsesSubform", fieldName: "subnet", values: {},
    }, plainUser);
    assert.equal(res.statusCode, 404);
    assert.equal(ranWith, null);
  });

  test("a subform field with no query is refused", async () => {
    const res = await call({
      formName: "Provision", subformName: "NicStep", fieldName: "noquery", values: {},
    }, plainUser);
    assert.equal(res.statusCode, 404);
    assert.equal(ranWith, null);
  });

  test("a denied form answers 403, not 500 - and never 401, which logs the user out", async () => {
    formResult = "denied";
    const res = await call({ formName: "Secret", fieldName: "host", values: {} }, plainUser);
    assert.equal(res.statusCode, 403);
    assert.equal(ranWith, null);
  });
});

describe("placeholders are keyed by their raw text, so the documented forms work", () => {
  test("dot notation is substituted, not left in the sql", async () => {
    await call({
      formName: "Provision", subformName: "NicStep", fieldName: "subnet",
      values: { "city.name": "Ghent" },
    }, plainUser);
    const sql = ranSql();
    assert.equal(sql.includes("$("), false, "an unsubstituted placeholder is a syntax error");
  });

  test("an index path is substituted too", () => {
    assert.equal(substitute("SELECT $(rows[0].id)", { "rows[0].id": 7 }), "SELECT 7");
  });

  test("a placeholder nothing resolved is still left alone, so a typo is visible", () => {
    assert.equal(substitute("a $(nope) b", { other: 1 }), "a $(nope) b");
  });
});

describe("constants come from the configuration, never from the request", () => {
  test("a caller cannot choose the value of a constant", async () => {
    // `WHERE tenant = '$(TENANT)'` is a scoping rule ; taking it from the body let a
    // caller read another tenant's rows
    await call({
      formName: "Provision", fieldName: "host",
      values: { TENANT: "someone-else" },
    }, plainUser);
    assert.match(ranSql(), /t = 'acme'/, "the config's constant must win");
    assert.equal(ranSql().includes("someone-else"), false);
  });

  test("a path into a constant is resolved server side as well", async () => {
    formResult.forms[0].fields[0].query = "SELECT v FROM n WHERE vlan = $(NET.vlan)";
    await call({
      formName: "Provision", fieldName: "host",
      values: { "NET.vlan": 9999 },
    }, plainUser);
    assert.match(ranSql(), /vlan = 42/);
  });

  test("an ordinary field value is still the caller's to supply", async () => {
    formResult.forms[0].fields[0].query = "SELECT n FROM h WHERE env = '$(env)'";
    await call({ formName: "Provision", fieldName: "host", values: { env: "prod" } }, plainUser);
    assert.match(ranSql(), /env = 'prod'/);
  });
});

describe("escaping follows the engine, because they do not agree", () => {
  test("mysql and mariadb treat a backslash as an escape, so it must be doubled", () => {
    // without this, `x\` before the author's closing quote swallows it
    assert.equal(escapeSqlValue("x\\", "mysql"), "x\\\\");
    assert.equal(escapeSqlValue("x\\", "mariadb"), "x\\\\");
    // and the quote doubling still happens, exactly once
    assert.equal(escapeSqlValue("it's", "mysql"), "it''s");
  });

  test("postgres, mssql and oracle take a backslash literally - doubling it corrupts data", () => {
    // DOMAIN\user and C:\path are values this product carries around
    for (const dialect of ["postgres", "mssql", "oracle"]) {
      assert.equal(escapeSqlValue("DOMAIN\\user", dialect), "DOMAIN\\user", dialect);
      assert.equal(escapeSqlValue("it's", dialect), "it''s", dialect);
    }
  });

  test("mongodb is json, so it needs json escaping and not sql escaping", () => {
    // mongodb.js JSON.parses the query, so an embedded double quote broke the document
    assert.equal(escapeSqlValue('say "hi"', "mongodb"), 'say \\"hi\\"');
    assert.equal(escapeSqlValue("it's", "mongodb"), "it's", "doubling a single quote is wrong in json");
    assert.equal(escapeSqlValue("C:\\x", "mongodb"), "C:\\\\x");
  });

  test("an unknown or absent engine falls back to the strictest rules", () => {
    // query.model.js defaults an unknown credential to mysql, so over-escaping here is a
    // wrong value while under-escaping is an injection
    assert.equal(escapeSqlValue("x\\"), "x\\\\");
    assert.equal(escapeSqlValue("x\\", undefined), "x\\\\");
    assert.equal(escapeSqlValue("x\\", "somethingnew"), "x\\\\");
  });
});
