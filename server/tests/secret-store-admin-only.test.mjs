// A secret store logs in with a Vault token or a CyberArk client key, which it sends to its address
// on every read and on Check. A user with only connections access could change a store's url and
// press Check, and receive the stored token at a server of their own. These pin the rules : adding,
// changing or deleting a store is an admin's (Check and the mounts of a saved store stay open), and
// a write that moves a store to another address, CA bundle or certificate check without its secret
// typed again clears the stored token and client key (defense in depth).
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

// nothing here may reach a database
vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));

// ---------------------------------------------------------------------------------------------
// The stores there are, and what the model was asked to write
// ---------------------------------------------------------------------------------------------

const stored = {
  1: { id: 1, name: "vault", type: "vault", url: "https://vault.local:8200", token: "hvs.stored", ignore_certs: 0, ca_bundle: null, credential: null, namespace: null },
  2: { id: 2, name: "ccp", type: "cyberark_ccp", url: "https://ccp.local", client_key: "KEY", client_cert: "CERT", ignore_certs: 0, ca_bundle: "CA", credential: null },
};
const writes = [];
vi.mock("../src/models/crud.model.js", () => ({
  default: class {
    static getCache() { return null; }
    static async findByName() { return undefined; }
    static async findAll() { return Object.values(stored); }
    static async findById(modelName, id) { return stored[id] ? { ...stored[id] } : undefined; }
    static async create(modelName, data) { writes.push(["create", { ...data }]); return 9; }
    static async update(modelName, data, id) { writes.push(["update", { ...data }, id]); return { ...data }; }
    static async delete(modelName, id) { writes.push(["delete", id]); return true; }
  },
}));
vi.mock("../src/secrets/providers/index.js", async () => {
  const actual = await vi.importActual("../src/secrets/providers/index.js");
  return { ...actual, checkStore: async () => ({ ok: true }), listMounts: async () => [] };
});

const { default: SecretStore } = await import("../src/models/secretStore.model.js");
const { default: controller } = await import("../src/controllers/v2/secretStore.controller.js");

/**
 * Calls a controller handler as the given user, and answers what it sent.
 *
 * Args:
 *   handler (Function): the controller's handler.
 *   user (object): the signed-in user (its roles).
 *   opts (object): { body, params } of the request.
 *
 * Returns:
 *   Promise<{status: number, data: object}>: the answer.
 */
function call(handler, user, { body = {}, params = { id: "1" } } = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(data) { resolve({ status: this.statusCode, data }); return this; },
    };
    handler({ body, params, query: {}, headers: {}, user: { user } }, res);
  });
}

const ops = { username: "ops", roles: ["ops"], options: { showConnectionsSettings: true } };
const admin = { username: "admin", roles: ["admin"] };

beforeEach(() => { writes.length = 0; });
afterEach(() => { vi.restoreAllMocks(); });

// ---------------------------------------------------------------------------------------------
// Who may write a store
// ---------------------------------------------------------------------------------------------

describe("a connections user", () => {
  test("may not add, change or delete a store", async () => {
    expect((await call(controller.create, ops, { body: { name: "x", type: "vault", url: "https://evil" } })).status).toBe(403);
    expect((await call(controller.update, ops, { body: { url: "https://evil" } })).status).toBe(403);
    expect((await call(controller.update, ops, { body: { description: "harmless" } })).status).toBe(403);
    expect((await call(controller.delete, ops)).status).toBe(403);
    expect(writes).toEqual([]);
  });

  test("may still check a saved store and list its mounts", async () => {
    expect((await call(controller.check, ops)).status).toBeLessThan(300);
    expect((await call(controller.mounts, ops)).status).toBeLessThan(300);
  });
});

describe("an admin", () => {
  test("may add, change and delete one", async () => {
    expect((await call(controller.create, admin, { body: { name: "x", type: "vault", url: "https://v" } })).status).toBeLessThan(300);
    expect((await call(controller.update, admin, { body: { description: "d" } })).status).toBeLessThan(300);
    expect((await call(controller.delete, admin)).status).toBeLessThan(300);
    expect(writes.map((w) => w[0])).toEqual(["create", "update", "delete"]);
  });
});

// ---------------------------------------------------------------------------------------------
// A store moved elsewhere leaves its secret behind
// ---------------------------------------------------------------------------------------------

describe("a store moved to another address", () => {
  test("without a new token: the stored token and client key are cleared", async () => {
    await SecretStore.update({ url: "https://evil:8200", token: "**********" }, 1);
    expect(writes[0][1].token).toBeNull();
    expect(writes[0][1].client_key).toBeNull();
  });

  test("a new CA bundle or the certificate check turned off counts as a move", async () => {
    await SecretStore.update({ ca_bundle: "OTHER" }, 2);
    await SecretStore.update({ ignore_certs: 1 }, 1);
    expect(writes[0][1].client_key).toBeNull();
    expect(writes[1][1].token).toBeNull();
  });

  test("with a new token typed: it is kept", async () => {
    await SecretStore.update({ url: "https://new:8200", token: "hvs.typed" }, 1);
    expect(writes[0][1].token).toBe("hvs.typed");
  });

  test("the same address sent back (a trailing slash, spaces): nothing is cleared", async () => {
    await SecretStore.update({ url: " https://vault.local:8200/ ", ignore_certs: 0, ca_bundle: "", description: "d" }, 1);
    expect("token" in writes[0][1]).toBe(false);
    expect("client_key" in writes[0][1]).toBe(false);
  });

  test("the config seed's write is left as it is", async () => {
    await SecretStore.update({ url: "https://seeded:8200" }, 1, { fromSeed: true });
    expect("token" in writes[0][1]).toBe(false);
  });
});
