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
const settingsModule = await import("../src/rte/socket/settings.js");
const { FileCache, OWNER_GONE_MS } = await import("../src/rte/socket/files.js");

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
    assert.match(normalizeRunnerSettings({ rte_drain_seconds: 90000 }), /rte_drain_seconds must be a whole number from 0 to 86400/);
    assert.match(normalizeRunnerSettings({ rte_files: "nfs" }), /rte_files must be one of transfer, local/);
  });
});

describe("the RTE's own variables", () => {
  test("read as before 7.3 : a number as far as it goes, out of range brought to its limit, and said", () => {
    const { parseEnvSetting, envSettingWarnings } = settingsModule;
    assert.equal(parseEnvSetting(byKey("drainSeconds"), "7200"), 7200);
    assert.equal(parseEnvSetting(byKey("drainSeconds"), "999999"), 86400);
    assert.equal(parseEnvSetting(byKey("maxJobs"), "8 jobs"), 8);
    assert.equal(parseEnvSetting(byKey("maxJobs"), "-2"), 0);
    assert.equal(parseEnvSetting(byKey("maxJobs"), "many"), undefined);
    assert.deepEqual(settingsOfEnv({ RTE_MAX_JOBS: "20000", RTE_FILES: "LOCAL" }), { maxJobs: 10000, files: "local" });
    const said = envSettingWarnings({ RTE_MAX_JOBS: "20000", RTE_DRAIN_SECONDS: "60", RTE_FILES: "nfs", RTE_CACHE_MB: "lots" });
    assert.equal(said.length, 3);
    assert.match(said.join("\n"), /RTE_MAX_JOBS=20000 is read as 10000/);
    assert.match(said.join("\n"), /RTE_FILES=nfs is not one of transfer, local: not used/);
    assert.match(said.join("\n"), /RTE_CACHE_MB=lots is not a number: not used/);
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

describe("RTEs sharing one cache", () => {
  test("each transfer writes a file of its own, so two RTEs fetching one bundle never mix", async () => {
    const one = new FileCache(path.join(dir, "shared"), 1048576, "rte-a");
    const two = new FileCache(path.join(dir, "shared"), 1048576, "rte-b");
    const hash = "f".repeat(64);
    one.ensure(hash, () => true).catch(() => {});
    two.ensure(hash, () => true).catch(() => {});
    assert.notEqual(one.pending.get(hash).file, two.pending.get(hash).file);
    // both files written to, then one RTE's socket drops
    await Promise.all([one, two].map((c) => new Promise((r) => c.pending.get(hash).stream.write("x", r))));
    one.failAll(new Error("closed"));
    // one RTE's socket dropping removes its own transfer only
    assert.ok(fs.existsSync(two.pending.get(hash).file));
    two.failAll(new Error("closed"));
  });

  test("the jobs folder of an RTE that stopped saying it runs is removed, a living one's kept", () => {
    const where = path.join(dir, "owners");
    const gone = new FileCache(where, 1048576, "rte-old-host");
    fs.mkdirSync(path.join(gone.jobsDir, "12-abc"));
    fs.writeFileSync(path.join(gone.jobsDir, "12-abc", "extravars_12.json"), "{}");
    const alive = new FileCache(where, 1048576, "rte-other");
    const later = Date.now() + OWNER_GONE_MS + 60000;
    // the living one says so again ; the old one never will
    alive.heartbeat(later);
    fs.utimesSync(path.join(alive.jobsDir, ".alive"), new Date(later), new Date(later));
    const me = new FileCache(where, 1048576, "rte-new-host");
    me.heartbeat(later);
    assert.equal(fs.existsSync(gone.jobsDir), false);
    assert.equal(fs.existsSync(alive.jobsDir), true);
    assert.equal(fs.existsSync(me.jobsDir), true);
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
