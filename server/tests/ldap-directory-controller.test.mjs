// Settings > Access > LDAP : the directories answer as the other records do (typed errors) : 404
// for one that is not there, 403 for the config seed's, 400 for an empty body, 201 for a new one.
// A test never hands a credential of another kind (a runner's token, a database login) to an
// LDAP server. The legacy /api/v2/ldap is the default directory's handlers. Moving a directory
// renumbers them in one transaction, as the labels.
import { describe, test, expect, vi, beforeEach } from "vitest";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

const directories = {
  1: { id: 1, name: "main", position: 1, managed: 0, server: "ldap.corp", port: 636, enable_tls: 1, ignore_certs: 0, cert: "", ca_bundle: "", bind_user_dn: "cn=svc", bind_user_pw: "", credential: null },
  2: { id: 2, name: "seeded", position: 2, managed: 1, server: "ldap2.corp", port: 389, credential: null },
  3: { id: 3, name: "corp", position: 3, managed: 0, server: "ldap3.corp", port: 389, credential: null },
};
const credentials = { "rte-token": "rte", "ldap-bind": "ldap" };
const writes = [];
const txWrites = [];
vi.mock("../src/models/db.model.js", () => ({
  default: {
    do: async (sql, params) => {
      if (/SELECT \* FROM AnsibleForms\.`ldap` WHERE id = \?/.test(sql)) return directories[params[0]] ? [{ ...directories[params[0]] }] : [];
      if (/SELECT \* FROM AnsibleForms\.`ldap` ORDER BY/.test(sql)) return Object.values(directories).map((d) => ({ ...d }));
      if (/SELECT id FROM AnsibleForms\.`ldap` ORDER BY/.test(sql)) return Object.values(directories).map((d) => ({ id: d.id }));
      if (/SELECT credential_type FROM AnsibleForms\.`credentials`/.test(sql)) return credentials[params[0]] ? [{ credential_type: credentials[params[0]] }] : [];
      if (/SELECT host, port, secure/.test(sql)) return [];
      if (/SELECT id FROM AnsibleForms\.`ldap` WHERE name = \?/.test(sql)) return [];
      if (/COALESCE\(MAX\(position\)/.test(sql)) return [{ p: 3 }];
      if (/^INSERT INTO AnsibleForms\.`ldap`/.test(sql)) { writes.push(["insert", params]); return { insertId: 4 }; }
      if (/^UPDATE AnsibleForms\.`ldap`/.test(sql)) { writes.push(["update", params]); return {}; }
      if (/^DELETE FROM AnsibleForms\.`ldap`/.test(sql)) { writes.push(["delete", params]); return {}; }
      return [];
    },
    transaction: async (fn) => fn(async (sql, params) => { txWrites.push([sql, params]); return {}; }),
  },
}));
vi.mock("ldap-authentication", () => ({ authenticate: async () => { throw new Error("no LDAP server in a test"); } }));

const { default: controller } = await import("../src/controllers/v2/ldapDirectory.controller.js");
const { default: legacy } = await import("../src/controllers/v2/ldap.controller.js");
const { withEnds } = await import("../src/models/listOrder.js");

function call(handler, { body = {}, params = {} } = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(data) { resolve({ status: this.statusCode, data }); return this; },
    };
    handler({ body, params, headers: {}, user: { user: { username: "admin", roles: ["admin"], options: { showSettings: true } } } }, res);
  });
}

beforeEach(() => { writes.length = 0; txWrites.length = 0; });

describe("the LDAP directories", () => {
  test("one that is not there: 404", async () => {
    expect((await call(controller.findById, { params: { id: "9" } })).status).toBe(404);
    expect((await call(controller.update, { params: { id: "9" }, body: { description: "x" } })).status).toBe(404);
    expect((await call(controller.remove, { params: { id: "9" } })).status).toBe(404);
  });

  test("the config seed's: 403, nothing written", async () => {
    expect((await call(controller.update, { params: { id: "2" }, body: { description: "x" } })).status).toBe(403);
    expect((await call(controller.remove, { params: { id: "2" } })).status).toBe(403);
    expect(writes).toEqual([]);
  });

  test("an empty body: 400", async () => {
    expect((await call(controller.create, { body: {} })).status).toBe(400);
    expect((await call(controller.update, { params: { id: "1" }, body: {} })).status).toBe(400);
    expect((await call(controller.check, { params: { id: "1" }, body: {} })).status).toBe(400);
  });

  test("a new one: 201", async () => {
    const r = await call(controller.create, { body: { name: "emea", server: "ldap.emea" } });
    expect(r.status).toBe(201);
    expect(r.data.id).toBe(4);
  });

  test("a name that is not valid, or a credential of another kind: 400", async () => {
    expect((await call(controller.create, { body: { name: "bad name!", server: "x" } })).status).toBe(400);
    expect((await call(controller.update, { params: { id: "3" }, body: { credential: "rte-token" } })).status).toBe(400);
  });

  test("a test with a credential of another kind is refused before any LDAP server is asked", async () => {
    const r = await call(controller.check, { params: { id: "1" }, body: { credential: "rte-token", server: "evil.example.com", testuser: "u", testpassword: "p" } });
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/ldap credential/);
  });

  test("the list says the first and the last", async () => {
    const r = await call(controller.findAll);
    expect(r.data.records.map((d) => [d.isFirst, d.isLast])).toEqual([[true, false], [false, false], [false, true]]);
  });

  test("a move renumbers every directory in one transaction", async () => {
    const r = await call(controller.move, { params: { id: "3" }, body: { direction: "up" } });
    expect(r.data.moved).toBe(true);
    expect(txWrites.map(([, p]) => p)).toEqual([[1, 1], [2, 3], [3, 2]]);
    expect(writes).toEqual([]);
  });

  test("a move up of the first moves nothing ; another direction is 400 ; another id 404", async () => {
    expect((await call(controller.move, { params: { id: "1" }, body: { direction: "up" } })).data.moved).toBe(false);
    expect((await call(controller.move, { params: { id: "1" }, body: { direction: "left" } })).status).toBe(400);
    expect((await call(controller.move, { params: { id: "9" }, body: { direction: "up" } })).status).toBe(404);
    expect(txWrites).toEqual([]);
  });
});

describe("the legacy /api/v2/ldap", () => {
  test("reads and writes the default directory through the directory handlers", async () => {
    const found = await call(legacy.find);
    expect(found.status).toBe(200);
    expect(found.data.name).toBe("main");
    const updated = await call(legacy.update, { body: { description: "the main one" } });
    expect(updated.status).toBe(200);
    expect(writes[0][0]).toBe("update");
    expect(writes[0][1][1]).toBe(1);
  });
});

// the stored bind password reaches only the stored servers : a check that names other servers
// and sends the mask is refused, one that leaves the password out binds without it
describe("the bind password of a check", () => {
  let binds;
  beforeEach(async () => {
    const appConfig = (await import("./__mocks__/app.config.js")).default;
    appConfig.encryptionSecret ||= "0123456789abcdef0123456789abcdef";
    const { default: crypto } = await import("../src/lib/crypto.js");
    directories[1].bind_user_pw = crypto.encrypt("stored-pw");
    const { default: Ldap } = await import("../src/models/ldap.model.js");
    binds = [];
    vi.spyOn(Ldap, "authenticateOn").mockImplementation(async (cfg, bindPassword) => {
      binds.push({ server: cfg.server, bindPassword });
      return { dn: "cn=u" };
    });
  });

  test("left out, for the stored servers: the stored one", async () => {
    await call(controller.check, { params: { id: "1" }, body: { testuser: "u", testpassword: "p" } });
    expect(binds).toEqual([{ server: "ldap.corp", bindPassword: "stored-pw" }]);
  });

  test("left out, for other servers: none", async () => {
    await call(controller.check, { params: { id: "1" }, body: { server: "evil.example.com", testuser: "u", testpassword: "p" } });
    expect(binds).toEqual([{ server: "evil.example.com", bindPassword: "" }]);
  });

  test("the legacy route follows the same rule", async () => {
    await call(legacy.check, { body: { server: "evil.example.com", testuser: "u", testpassword: "p" } });
    expect(binds).toEqual([{ server: "evil.example.com", bindPassword: "" }]);
  });

  test("the mask, for other servers: refused, nothing bound", async () => {
    const r = await call(controller.check, { params: { id: "1" }, body: { server: "evil.example.com", bind_user_pw: "**********", testuser: "u", testpassword: "p" } });
    expect(r.status).toBe(400);
    expect(binds).toEqual([]);
  });

  test("typed: what was typed, wherever", async () => {
    await call(controller.check, { params: { id: "1" }, body: { server: "other", bind_user_pw: "typed", testuser: "u", testpassword: "p" } });
    expect(binds).toEqual([{ server: "other", bindPassword: "typed" }]);
  });
});

describe("withEnds", () => {
  test("marks the first and the last, an empty list stays empty", () => {
    expect(withEnds([{ id: 1 }])).toEqual([{ id: 1, isFirst: true, isLast: true }]);
    expect(withEnds([])).toEqual([]);
    expect(withEnds(undefined)).toEqual([]);
  });
});
