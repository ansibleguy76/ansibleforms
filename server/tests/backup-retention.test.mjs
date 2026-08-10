// NIGHTLY_BACKUP_RETENTION keeps the last N nightly backups. Three things about that have
// each been wrong:
//
//  - 0 used to delete EVERY nightly backup (slice(0) is the whole list) while help.yaml
//    documented 0 as the way to switch cleanup off ;
//  - the quota counted invalid folders, so an instance whose backups had been failing kept
//    N pieces of 0-byte junk and deleted the last genuinely restorable snapshot ;
//  - fixing that by filtering `&& b.valid` also removed the junk from the DELETION list, so
//    an invalid folder was then kept for ever - the retention setting silently did not
//    apply to exactly the folders nobody wants.
//
// The rule that has to hold through all of it: nothing NEWER than the newest backup we are
// keeping is ever a deletion candidate, so a backup still being written cannot be removed
// underneath itself.
import { test, describe, beforeEach, vi } from "vitest";
import assert from "node:assert/strict";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

// capture each task's callback instead of scheduling it
const tasks = new Map();
vi.mock("croner", () => ({
  Cron: class {
    constructor(pattern, opts, fn) { this.pattern = pattern; this.fn = fn; tasks.set(pattern, fn); }
    stop() {}
    nextRun() { return new Date(0); }
  },
}));
vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));
vi.mock("../src/models/audit.model.js", () => ({ default: { log: async () => {} } }));

const cronService = (await import("../src/services/cron.service.js")).default;

let listed = [];
let deleted = [];
const BackupModel = {
  doBackup: async (description) => ({ backupFolder: "/x/20260731000000", timestamp: "20260731000000", description }),
  listBackups: async () => listed,
  deleteBackup: async (folder) => { deleted.push(folder); },
};
const NIGHTLY = "Automated nightly backup";
const nightly = (folder, valid = true) => ({ folder, description: NIGHTLY, valid });

async function runNightly(retention) {
  tasks.clear();
  await cronService.initializeSystemTasks(
    { removeOlderThan: async () => 0 },
    { removeExpired: async () => 0, cleanup: async () => 0 },
    BackupModel,
    { nightlyBackupRetention: retention, auditRetentionDays: 0, jobRetentionDays: 0 }
  );
  const fn = tasks.get("0 0 * * *");
  assert.ok(fn, "the nightly backup task must be registered at midnight");
  await fn();
}

beforeEach(() => { deleted = []; listed = []; });

describe("invalid nightly backups are swept, not kept for ever", () => {
  test("a 0-byte folder older than what we keep is removed", async () => {
    listed = [
      nightly("20260731000000"),          // taken just now, kept
      nightly("20260730000000", false),   // junk from a failed run
      nightly("20260729000000", false),   // junk from a failed run
    ];
    await runNightly(1);
    assert.deepEqual(deleted.sort(), ["20260729000000", "20260730000000"]);
  });

  test("invalid folders do not consume the quota", async () => {
    listed = [
      nightly("20260731000000"),
      nightly("20260730000000", false),
      nightly("20260729000000"),
      nightly("20260728000000"),
    ];
    await runNightly(2);
    // the two newest VALID ones are kept ; the junk and the surplus valid one go
    assert.deepEqual(deleted.sort(), ["20260728000000", "20260730000000"]);
  });
});

describe("a backup still being written is never a candidate", () => {
  test("nothing newer than the newest kept backup is deleted", async () => {
    listed = [
      nightly("20260731235959", false),   // in progress : the dump is not there yet
      nightly("20260731000000"),          // the one we just took, kept
      nightly("20260730000000"),
    ];
    await runNightly(1);
    assert.equal(deleted.includes("20260731235959"), false,
      "an in-progress backup reads as invalid and must not be removed underneath itself");
    assert.deepEqual(deleted, ["20260730000000"]);
  });

  test("with no valid backup at all, nothing is deleted", async () => {
    listed = [nightly("20260731000000", false), nightly("20260730000000", false)];
    await runNightly(1);
    assert.deepEqual(deleted, [], "there is no snapshot to protect, and the folders are the only record of the failure");
  });
});

describe("0 means keep everything", () => {
  test("retention 0 deletes nothing", async () => {
    listed = [nightly("20260731000000"), nightly("20260730000000"), nightly("20260729000000")];
    await runNightly(0);
    assert.deepEqual(deleted, []);
  });
});

describe("only nightly backups are touched", () => {
  test("a manual backup is left alone whatever its age", async () => {
    listed = [
      nightly("20260731000000"),
      { folder: "20260101000000", description: "Before the big migration", valid: true },
    ];
    await runNightly(1);
    assert.deepEqual(deleted, [], "retention is about the nightly task, not about backups somebody took on purpose");
  });
});
