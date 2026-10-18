// A socket-mode RTE's settings set on its runner page (rte/socket/settings.js) : read and
// checked, a variable on the RTE winning ; applied by the RTE when the app sends them
// (rte/socket/rte-socket.js) ; and the job files cache kept to its size (rte/socket/files.js).
import { test, describe, beforeEach, afterEach } from "vitest";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";

const { parseSetting, settingsOfRunner, settingsOfEnv, effectiveSettings, normalizeRunnerSettings, RTE_SETTINGS } = await import("../src/rte/socket/settings.js");
const { FileCache } = await import("../src/rte/socket/files.js");

const byKey = (key) => RTE_SETTINGS.find((s) => s.key === key);

let dir;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "af-settings-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("the settings", () => {
  test("a value is a whole number in range, or transfer or local ; anything else is not set", () => {
    assert.equal(parseSetting(byKey("maxJobs"), "4"), 4);
    assert.equal(parseSetting(byKey("maxJobs"), 0), 0);
    assert.equal(parseSetting(byKey("maxJobs"), "-1"), undefined);
    assert.equal(parseSetting(byKey("maxJobs"), "2.5"), undefined);
    assert.equal(parseSetting(byKey("maxJobs"), ""), undefined);
    assert.equal(parseSetting(byKey("files"), "LOCAL"), "local");
    assert.equal(parseSetting(byKey("files"), "shared"), undefined);
  });

  test("the runner's value wins, then the variable on the RTE, then the default", () => {
    const fromEnv = settingsOfEnv({ RTE_MAX_JOBS: "3", RTE_DRAIN_SECONDS: "60", RTE_FILES: "nonsense" });
    const fromRunner = settingsOfRunner({ rte_max_jobs: 8, rte_files: "local", rte_cache_mb: 50 });
    assert.deepEqual(fromEnv, { maxJobs: 3, drainSeconds: 60 });
    assert.deepEqual(effectiveSettings(fromEnv, fromRunner), { maxJobs: 8, cacheMb: 50, files: "local", drainSeconds: 60 });
    assert.deepEqual(effectiveSettings({}, {}), { maxJobs: 10, cacheMb: 1024, files: "transfer", drainSeconds: 25 });
  });

  test("the api's values : empty is the default, out of range refused", () => {
    const data = { rte_max_jobs: "5", rte_cache_mb: "", rte_files: "Local" };
    assert.equal(normalizeRunnerSettings(data), null);
    assert.deepEqual(data, { rte_max_jobs: 5, rte_cache_mb: null, rte_files: "local" });
    assert.match(normalizeRunnerSettings({ rte_drain_seconds: 5000 }), /rte_drain_seconds must be a whole number from 0 to 3600/);
    assert.match(normalizeRunnerSettings({ rte_files: "nfs" }), /rte_files must be one of transfer, local/);
  });
});

describe("the job files cache, kept to its size", () => {
  const bundle = (cache, hash, bytes, ageMs) => {
    const file = cache.path(hash);
    fs.writeFileSync(file, Buffer.alloc(bytes));
    const t = new Date(Date.now() - ageMs);
    fs.utimesSync(file, t, t);
  };

  test("a smaller size removes the bundles used longest ago", () => {
    const cache = new FileCache(path.join(dir, "c"), 10 * 1048576);
    bundle(cache, "a".repeat(64), 1048576, 3000);
    bundle(cache, "b".repeat(64), 1048576, 2000);
    bundle(cache, "c".repeat(64), 1048576, 1000);
    assert.equal(cache.usedBytes(), 3 * 1048576);
    cache.setMaxBytes(2 * 1048576);
    assert.equal(cache.has("a".repeat(64)), false);
    assert.equal(cache.has("b".repeat(64)), true);
    assert.equal(cache.has("c".repeat(64)), true);
    cache.setMaxBytes(0);
    assert.equal(cache.usedBytes(), 0);
  });
});

describe("the RTE applying its runner's settings", async () => {
  const { onSettings, settings } = await import("../src/rte/socket/rte-socket.js");

  afterEach(() => {
    delete process.env.RTE_MAX_JOBS;
    onSettings({ settings: {} });
  });

  test("what the app sends wins over a variable on the RTE, which fills an empty field", () => {
    process.env.RTE_MAX_JOBS = "7";
    onSettings({ settings: { maxJobs: 2, files: "local", drainSeconds: 40 } });
    assert.deepEqual(settings(), { maxJobs: 2, cacheMb: 1024, files: "local", drainSeconds: 40 });
    // a value the app should never send is ignored, never a crash : the variable, else the default
    onSettings({ settings: { maxJobs: "lots", cacheMb: -3 } });
    assert.deepEqual(settings(), { maxJobs: 7, cacheMb: 1024, files: "transfer", drainSeconds: 25 });
  });
});
