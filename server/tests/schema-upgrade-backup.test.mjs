// The boot backs the database up before the patches change it (backupBeforeUpgrade), when
// pendingUpgrade says an upgrade is pending. Up to 7.3 that was only the tables 7.0.0 drops,
// so an upgrade from 7.2 to 7.3 - which moves secrets into credentials, retypes them and
// renames the LDAP directory - patched without a backup. It is pending now too when the
// schema was recorded by an older release (schema_migrations, row 'schema').
import { test, describe, beforeEach, vi } from "vitest";
import assert from "node:assert/strict";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

// a tiny database : the legacy tables still there, whether schema_migrations is, and the
// release its 'schema' row names (none : a fresh install)
let legacy;
let hasMigrations;
let recorded;
vi.mock("../src/models/db.model.js", () => ({
  default: {
    do: async (sql, params) => {
      if (/information_schema\.tables/.test(sql)) return legacy.map((t) => ({ t }));
      if (/^SHOW TABLES FROM \?\? WHERE/.test(sql)) return params[2] === "schema_migrations" && hasMigrations ? [{ t: "schema_migrations" }] : [];
      if (/FROM AnsibleForms\.`schema_migrations` WHERE name = 'schema'/.test(sql)) return recorded ? [{ version: recorded }] : [];
      return [];
    },
  },
}));
vi.mock("../src/lib/version.js", () => ({ appVersion: "7.3.0", majorMinor: (v) => String(v).split(".").slice(0, 2).join(".") }));

const { pendingUpgrade, compareReleases } = await import("../src/models/schema.model.js");

beforeEach(() => {
  legacy = [];
  hasMigrations = true;
  recorded = "7.3.0";
});

describe("an upgrade is pending, and backed up first", () => {
  test("the schema of this release: nothing pending, no backup on every restart", async () => {
    assert.deepEqual(await pendingUpgrade(), []);
  });

  test("a schema an older release recorded: pending", async () => {
    recorded = "7.2.0";
    assert.deepEqual(await pendingUpgrade(), ["upgrade the schema from 7.2.0 to 7.3.0"]);
  });

  test("a schema a newer release recorded (a rollback): not pending", async () => {
    recorded = "7.4.1";
    assert.deepEqual(await pendingUpgrade(), []);
  });

  test("a fresh install (the table without its row): not pending", async () => {
    recorded = null;
    assert.deepEqual(await pendingUpgrade(), []);
  });

  test("a database from before schema_migrations: pending", async () => {
    hasMigrations = false;
    assert.match((await pendingUpgrade()).join(), /unrecorded schema to 7\.3\.0/);
  });

  test("the tables 7.0.0 drops: still pending", async () => {
    legacy = ["awx"];
    assert.deepEqual(await pendingUpgrade(), ["drop awx"]);
  });
});

describe("release numbers compare on major, minor and patch", () => {
  test("older, equal, newer ; a pre-release is its release ; not a release : null", () => {
    assert.ok(compareReleases("7.2.0", "7.3.0") < 0);
    assert.ok(compareReleases("7.10.0", "7.9.3") > 0);
    assert.equal(compareReleases("v7.3.0", "7.3.0"), 0);
    assert.equal(compareReleases("7.3.0-rc.1", "7.3.0"), 0);
    assert.equal(compareReleases("unknown", "7.3.0"), null);
  });
});
