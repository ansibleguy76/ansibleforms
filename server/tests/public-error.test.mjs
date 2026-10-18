// A database error carries its statement and the names of the tables, columns and keys : handed
// back in a 500 it described the schema. The credential, job, directory, LDAP and stored job
// controllers answer it with a generic text, the detail logged on the server ; any other failure
// is told as it was. And a stored job named as another of the user's is a 409 that says so,
// where it was a 500 with the database's message.
import { describe, test, expect, vi } from "vitest";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

vi.mock("../src/lib/i18n.js", () => ({ default: { t: (_req, key) => key } }));

// an error as mysql2 throws it
function sqlError(code, message) {
  return Object.assign(new Error(message), { code, errno: 1, sqlState: "23000", sqlMessage: message, sql: "INSERT INTO AnsibleForms.`stored_jobs` SET ..." });
}

let failWith = null;
// a class : models extend it
vi.mock("../src/models/crud.model.js", () => ({
  default: class {
    static async create() { throw failWith; }
    static async update() { throw failWith; }
    static async findById() { return { id: 1, username: "local/alice" }; }
    static async findAll() { throw failWith; }
    static getCache() { return null; }
  },
}));
vi.mock("../src/models/credential.model.v2.js", () => ({
  default: { findAll: async () => { throw failWith; }, usageCounts: async () => new Map(), URL_TYPES: [], SIGNIN_TYPES: [] },
}));
vi.mock("../src/models/form.model.js", () => ({ default: { load: async () => ({ forms: [] }) } }));
vi.mock("../src/models/workflowRun.js", () => ({ workflowCredentials: async () => [] }));

const { isDatabaseError, publicMessage } = await import("../src/controllers/v2/publicError.js");
const { default: stored } = await import("../src/controllers/v2/stored-jobs.controller.js");
const { default: credentials } = await import("../src/controllers/v2/credential.controller.js");
const { default: Errors } = await import("../src/lib/errors.js");

function call(handler, { body = {}, params = {}, query = {} } = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(data) { resolve({ status: this.statusCode, data }); return this; },
    };
    handler({ body, params, query, headers: {}, user: { user: { username: "alice", type: "local", roles: ["admin"], options: { showSettings: true } } } }, res);
  });
}

describe("a database error", () => {
  test("is told apart from the others", () => {
    expect(isDatabaseError(sqlError("ER_PARSE_ERROR", "near 'x'"))).toBe(true);
    expect(isDatabaseError({ code: "ER_NO_SUCH_TABLE" })).toBe(true);
    expect(isDatabaseError(new Error("connection refused"))).toBe(false);
    expect(isDatabaseError(new Errors.ConflictError("x"))).toBe(false);
  });

  test("is answered with a generic text ; any other as before", () => {
    expect(publicMessage({}, sqlError("ER_PARSE_ERROR", "You have an error near 'SELECT secret'"))).toBe("errors.databaseError");
    expect(publicMessage({}, new Error("runner unreachable"))).toBe("Error: runner unreachable");
  });

  test("a credential list that fails on the database says nothing of the statement", async () => {
    failWith = sqlError("ER_BAD_FIELD_ERROR", "Unknown column 'secret_ref' in 'field list'");
    const r = await call(credentials.find);
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.data)).not.toMatch(/secret_ref|field list/);
  });
});

describe("a stored job named as another of the user's", () => {
  test("create: 409 naming it, not the database's message", async () => {
    failWith = sqlError("ER_DUP_ENTRY", "Duplicate entry 'local/alice-nightly' for key 'stored_jobs.uk_name'");
    const r = await call(stored.create, { body: { name: "nightly", form_name: "f" } });
    expect(r.status).toBe(409);
    expect(r.data.error).toBe("resources.storedJobNameInUse");
  });

  test("update: 409 too", async () => {
    failWith = sqlError("ER_DUP_ENTRY", "Duplicate entry");
    const r = await call(stored.update, { params: { id: "1" }, body: { name: "nightly" } });
    expect(r.status).toBe(409);
  });

  test("another database error: a generic 500", async () => {
    failWith = sqlError("ER_DATA_TOO_LONG", "Data too long for column 'form_data'");
    const r = await call(stored.create, { body: { name: "x" } });
    expect(r.status).toBe(500);
    expect(r.data.error).toBe("errors.databaseError");
  });
});
