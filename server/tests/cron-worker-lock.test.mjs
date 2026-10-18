// The background tasks run only while this process holds the worker lock. A worker that lost
// it (another took over, the database became unreachable) kept running every cron until its
// process exited : a nightly backup, a schedule or a repository pull could run twice.
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
    constructor(pattern, opts, fn) { this.pattern = pattern; this.fn = fn; if (fn) tasks.set(pattern, fn); }
    stop() {}
    resume() {}
    nextRun() { return new Date(0); }
  },
}));
vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));
vi.mock("../src/models/audit.model.js", () => ({ default: { log: async () => {} } }));
let held = true;
vi.mock("../src/lib/workerLock.js", () => ({ confirmWorkerLock: async () => held }));

const cronService = (await import("../src/services/cron.service.js")).default;

let abandoned;
let backups;
beforeEach(async () => {
  tasks.clear();
  abandoned = 0;
  backups = 0;
  held = true;
  await cronService.initializeSystemTasks(
    { abandon: async () => { abandoned++; return 0; }, removeOlderThan: async () => 0 },
    { removeExpired: async () => 0, cleanup: async () => 0 },
    { doBackup: async () => { backups++; return {}; }, listBackups: async () => [], deleteBackup: async () => {} },
    { nightlyBackupRetention: 0, auditRetentionDays: 0, jobRetentionDays: 0 }
  );
});

describe("a background tick runs only under the worker lock", () => {
  test("held : the hourly sweep and the nightly backup run", async () => {
    await tasks.get("0 * * * *")();
    await tasks.get("0 0 * * *")();
    assert.equal(abandoned, 1);
    assert.equal(backups, 1);
  });

  test("lost (or the database unreachable) : no tick does any work", async () => {
    held = false;
    for (const fn of tasks.values()) await fn();
    assert.equal(abandoned, 0);
    assert.equal(backups, 0);
  });

  test("held again : the ticks run again", async () => {
    held = false;
    await tasks.get("0 * * * *")();
    held = true;
    await tasks.get("0 * * * *")();
    assert.equal(abandoned, 1);
  });
});
