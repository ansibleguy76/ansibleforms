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
// the upgrade_backup row's release (none : never backed up before an upgrade), what was written
let backedUpFor;
// what information_schema says the database has, for the manifest check (missingFromManifest) :
// null is a complete schema (every table and column the manifest names)
let have;
const writes = [];
vi.mock("../src/models/db.model.js", () => ({
  default: {
    do: async (sql, params) => {
      if (/information_schema\.tables WHERE table_schema='AnsibleForms' AND table_name IN/.test(sql)) return legacy.map((t) => ({ t }));
      if (/information_schema\.tables/.test(sql)) return (have?.tables ?? manifestTables()).map((t) => ({ t }));
      if (/information_schema\.columns/.test(sql)) return (have?.columns ?? manifestColumns()).map((x) => ({ t: x.split(".")[0], c: x.split(".")[1] }));
      if (/^SHOW TABLES FROM \?\? WHERE/.test(sql)) return params[2] === "schema_migrations" && hasMigrations ? [{ t: "schema_migrations" }] : [];
      if (/FROM AnsibleForms\.`schema_migrations` WHERE name = 'schema'/.test(sql)) return recorded ? [{ version: recorded }] : [];
      if (/FROM AnsibleForms\.`schema_migrations` WHERE name = \?/.test(sql) && params[0] === "upgrade_backup") return backedUpFor ? [{ version: backedUpFor }] : [];
      if (/^INSERT INTO AnsibleForms\.`schema_migrations`/.test(sql)) {
        writes.push(params);
        if (params[0] === "upgrade_backup") backedUpFor = params[1];
      }
      return [];
    },
  },
}));
// the backup itself : counted, never run
const backups = [];
vi.mock("../src/models/backup.model.js", () => ({
  default: { doBackup: async (why) => { backups.push(why); return { backupFolder: "/backups/" + backups.length }; } },
}));
vi.mock("../src/lib/version.js", () => ({ appVersion: "7.3.0", majorMinor: (v) => String(v).split(".").slice(0, 2).join(".") }));

// whether this process is the worker (the one that patches)
let lockHeld = false;
vi.mock("../src/lib/workerLock.js", () => ({ holdsWorkerLock: () => lockHeld }));

const { default: Schema, pendingUpgrade, backupBeforeUpgrade, compareReleases, SCHEMA_MANIFEST } = await import("../src/models/schema.model.js");
// every table and column the manifest names : a complete schema
const manifestTables = () => [...new Set([...SCHEMA_MANIFEST.base.tables, ...Object.values(SCHEMA_MANIFEST.patches).flatMap((p) => p.tables || [])])];
const manifestColumns = () => Object.values(SCHEMA_MANIFEST.patches).flatMap((p) => p.columns || []);

beforeEach(() => {
  legacy = [];
  hasMigrations = true;
  recorded = "7.3.0";
  backedUpFor = null;
  have = null;
  writes.length = 0;
  backups.length = 0;
});

describe("one backup per release, however often the patches fail", () => {
  test("backed up once, recorded ; the next start of the same release does not back up again", async () => {
    recorded = "7.2.0";
    assert.match(await backupBeforeUpgrade(), /Backed up the database before the upgrade \(\/backups\/1\)/);
    assert.equal(backups.length, 1);
    assert.deepEqual(writes.find((w) => w[0] === "upgrade_backup"), ["upgrade_backup", "7.3.0"]);
    // the patch failed : the schema stays at 7.2.0, the upgrade still pending
    assert.match(await backupBeforeUpgrade(), /already/);
    assert.equal(backups.length, 1);
  });

  test("a backup recorded for an older release : backed up again for this one", async () => {
    recorded = "7.2.0";
    backedUpFor = "7.2.0";
    await backupBeforeUpgrade();
    assert.equal(backups.length, 1);
    assert.equal(backedUpFor, "7.3.0");
  });

  test("nothing pending : no backup, nothing recorded", async () => {
    assert.equal(await backupBeforeUpgrade(), null);
    assert.equal(backups.length, 0);
    assert.equal(writes.length, 0);
  });
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

  test("a fresh install lacking nothing, or an empty database: not pending", async () => {
    recorded = null;
    have = { tables: [], columns: [] };
    assert.deepEqual(await pendingUpgrade(), []);
  });

  test("no row, the core tables there and the manifest's columns missing (patches that always failed): pending", async () => {
    recorded = null;
    have = { tables: manifestTables(), columns: manifestColumns().filter((c) => !c.startsWith("runners.")) };
    const pending = await pendingUpgrade();
    assert.equal(pending.length, 1);
    assert.match(pending[0], /unrecorded schema to 7\.3\.0 \(it lacks runners\./);
  });

  test("a row of this release on a schema lacking what a development build adds: not pending", async () => {
    // no dump tool on a development machine : a new column there patches without a backup
    have = { tables: manifestTables().filter((t) => t !== "job_events"), columns: manifestColumns() };
    assert.deepEqual(await pendingUpgrade(), []);
  });

  test("no row and a missing table, but no users or jobs table: not an existing install, not pending", async () => {
    recorded = null;
    have = { tables: manifestTables().filter((t) => t !== "users" && t !== "jobs"), columns: [] };
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

describe("a restore checks and patches the schema that came back", () => {
  // the backup taken before an upgrade brings back the older release's schema, and the cached
  // "schema is up to date" of before kept this release running on it
  test("the worker: the cache goes, the schema is checked and patched again", async () => {
    lockHeld = true;
    Schema._cachedOk = { message: [], data: { success: [], failed: [] } };
    const spy = vi.spyOn(Schema, "hasSchema").mockImplementation(async () => {
      assert.equal(Schema._cachedOk, null, "checked again, not answered from the cache");
      return { message: [], data: { success: [], failed: [] } };
    });
    assert.deepEqual(await Schema.upgradeAfterRestore(), { upgraded: true });
    assert.equal(spy.mock.calls.length, 1);
    spy.mockRestore();
    lockHeld = false;
  });

  test("the worker: a patching that failed is what the restore reports", async () => {
    lockHeld = true;
    const err = new Error("Patching failed");
    err.result = { data: { failed: ["the backup before it failed"] } };
    const spy = vi.spyOn(Schema, "hasSchema").mockRejectedValue(err);
    assert.deepEqual(await Schema.upgradeAfterRestore(), { upgraded: false, failed: ["the backup before it failed"] });
    spy.mockRestore();
    lockHeld = false;
  });

  test("an app node: done once the worker made the schema complete ; else said what it lacks", async () => {
    assert.deepEqual(await Schema.upgradeAfterRestore({ waitMs: 0 }), { upgraded: true });
    have = { tables: manifestTables(), columns: manifestColumns().filter((c) => c !== "runners.credential") };
    const res = await Schema.upgradeAfterRestore({ waitMs: 0 });
    assert.equal(res.upgraded, false);
    assert.match(res.failed[0], /has not patched the restored schema yet, it lacks runners\.credential/);
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
