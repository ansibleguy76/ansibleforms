// 7 adds a name to the ldap table (single-row by design up to 7.2, without a key) and makes it
// unique. A database with several rows got the name 'default' on every one of them from the
// column's default, so the unique key could never be added and the patch failed at every
// start. dedupeLdapNames gives them distinct names first.
import { test, describe, beforeEach, vi } from "vitest";
import assert from "node:assert/strict";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

// the ldap rows, and whether the unique key is there already
let rows;
let keyed;
vi.mock("../src/models/db.model.js", () => ({
  default: {
    do: async (sql, params) => {
      if (/^SHOW INDEX/.test(sql)) return keyed ? [{ Key_name: "unique_name" }] : [];
      if (/^SELECT id, name FROM AnsibleForms\.`ldap`/.test(sql)) return rows.map((r) => ({ ...r }));
      if (/^UPDATE AnsibleForms\.`ldap` SET name = \? WHERE id = \?/.test(sql)) {
        rows.find((r) => r.id === params[1]).name = params[0];
        return { affectedRows: 1 };
      }
      return [];
    },
  },
}));

const { dedupeLdapNames } = await import("../src/models/schema.model.js");

beforeEach(() => {
  keyed = false;
  rows = [];
});

describe("the LDAP directories get distinct names before the unique key", () => {
  test("several rows named default: the first keeps it, the others get their id after it", async () => {
    rows = [{ id: 1, name: "default" }, { id: 2, name: "default" }, { id: 3, name: "default-3" }, { id: 4, name: "default" }];
    // default-3 is somebody's own already : row 3 keeps it, and a later clash would take -2
    rows.push({ id: 5, name: "default-3" });
    assert.match(await dedupeLdapNames(), /renamed/);
    assert.deepEqual(rows.map((r) => r.name), ["default", "default-2", "default-3", "default-4", "default-3-5"]);
    assert.equal(new Set(rows.map((r) => r.name)).size, rows.length);
  });

  test("distinct names already: nothing to do", async () => {
    rows = [{ id: 1, name: "main" }, { id: 2, name: "eu" }];
    assert.equal(await dedupeLdapNames(), null);
  });

  test("the key is there: nothing to do", async () => {
    keyed = true;
    rows = [{ id: 1, name: "default" }, { id: 2, name: "default" }];
    assert.equal(await dedupeLdapNames(), null);
    assert.deepEqual(rows.map((r) => r.name), ["default", "default"]);
  });
});
