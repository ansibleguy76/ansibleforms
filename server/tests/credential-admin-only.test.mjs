// Since 7.3 a runner, a secret store and the other connections take their URL and token from
// their credential. A user with connections access but not the admin role could not edit the
// runner, yet could point its credential at another server and receive its jobs' secrets. A
// credential of a type that carries an address, or one a runner names, is an admin's to change,
// as the runner is. And a credential still in use is neither deleted nor renamed (409) : what
// names it would stop working without a word.
import { describe, test, expect, vi, beforeEach } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

const calls = [];
// the credentials there are, by id, and the records naming each (usageCounts)
const rows = {
  1: { id: 1, name: "rte-token", credential_type: "rte" },
  2: { id: 2, name: "plain", credential_type: "userpass" },
  3: { id: 3, name: "runner-login", credential_type: "userpass" },
  4: { id: 4, name: "ldap-bind", credential_type: "ldap" },
};
const usage = new Map([["ldap-bind", 2], ["runner-login", 1]]);
const runnerRefs = { "runner-login": ["awx1"] };

vi.mock("../src/models/credential.model.v2.js", () => ({
  default: {
    URL_TYPES: ["rte", "awx", "aap", "ascender", "semaphore", "rundeck", "jenkins", "vault", "cyberark"],
    create: async (data) => { calls.push(["create", data]); return 9; },
    update: async (data, id) => { calls.push(["update", data, id]); return true; },
    delete: async (id) => { calls.push(["delete", id]); return true; },
    findById: async (id) => ({ ...rows[id] }),
    usageOf: async (name) => usage.get(name) || 0,
    runnersUsing: async (name) => runnerRefs[name] || [],
  },
}));
vi.mock("../src/auth/auth_entraid.js", () => ({ default: { initialize: async () => {} } }));
vi.mock("../src/auth/auth_oidc.js", () => ({ default: { initialize: async () => {} } }));

const { default: controller } = await import("../src/controllers/v2/credential.controller.js");

function call(handler, user, { body = {}, params = { id: "1" } } = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(data) { resolve({ status: this.statusCode, data }); return this; },
    };
    handler({ body, params, headers: {}, user: { user } }, res);
  });
}

const connectionsUser = { username: "ops", roles: ["ops"], options: { showConnectionsSettings: true } };
const admin = { username: "admin", roles: ["admin"], options: { showSettings: true } };

beforeEach(() => { calls.length = 0; });

describe("a credential a connection takes its address from", () => {
  test.each(["rte", "awx", "aap", "ascender", "semaphore", "rundeck", "jenkins", "vault", "cyberark"])("creating a %s one: refused for a connections user", async (type) => {
    const r = await call(controller.create, connectionsUser, { body: { name: "x", credential_type: type, url: "http://evil" } });
    expect(r.status).toBe(403);
    expect(calls).toEqual([]);
  });

  test("updating or deleting one: refused for a connections user", async () => {
    expect((await call(controller.update, connectionsUser, { body: { url: "http://evil" }, params: { id: "1" } })).status).toBe(403);
    expect((await call(controller.delete, connectionsUser, { params: { id: "1" } })).status).toBe(403);
    expect(calls).toEqual([]);
  });

  test("one a runner names, whatever its type: refused for a connections user", async () => {
    expect((await call(controller.update, connectionsUser, { body: { password: "x" }, params: { id: "3" } })).status).toBe(403);
    expect(calls).toEqual([]);
  });

  test("an admin may", async () => {
    expect((await call(controller.create, admin, { body: { name: "x", credential_type: "rte" } })).status).toBeLessThan(300);
    expect((await call(controller.update, admin, { body: { url: "http://new" }, params: { id: "1" } })).status).toBeLessThan(300);
    expect((await call(controller.delete, admin, { params: { id: "1" } })).status).toBeLessThan(300);
    expect(calls.map((c) => c[0])).toEqual(["create", "update", "delete"]);
  });

  test("other credentials stay open to connections users", async () => {
    expect((await call(controller.create, connectionsUser, { body: { name: "y", credential_type: "userpass" } })).status).toBeLessThan(300);
    expect((await call(controller.update, connectionsUser, { body: { password: "p" }, params: { id: "2" } })).status).toBeLessThan(300);
    expect((await call(controller.delete, connectionsUser, { params: { id: "2" } })).status).toBeLessThan(300);
  });
});

describe("a credential in use", () => {
  test("is not deleted: 409, naming it", async () => {
    const r = await call(controller.delete, admin, { params: { id: "4" } });
    expect(r.status).toBe(409);
    expect(r.data.error).toContain("ldap-bind");
    expect(calls).toEqual([]);
  });

  test("is not renamed: 409", async () => {
    const r = await call(controller.update, admin, { body: { name: "other" }, params: { id: "4" } });
    expect(r.status).toBe(409);
    expect(calls).toEqual([]);
  });

  test("may still be changed under its own name", async () => {
    const r = await call(controller.update, admin, { body: { name: "ldap-bind", password: "p" }, params: { id: "4" } });
    expect(r.status).toBeLessThan(300);
    expect(calls.length).toBe(1);
  });
});
