// The files a job runs from, packed for an RTE with RTE_FILES=transfer (lib/jobFiles.js) : a
// link that leads out of the folder is never packed (a committed link to the app's .env would
// hand the RTE ENCRYPTION_SECRET and DB_PASSWORD), two jobs packing the same folder at once
// pack it once, the old bundles are removed, and RTE_FILES_MAX_MB is read safely.
import { test, describe, beforeAll, afterAll } from "vitest";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import * as tar from "tar";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";
// a temporary folder of its own (os.tmpdir() reads TMPDIR) : the bundles pruned here are never
// those of an app running on this machine
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "af-jobfiles-tmp-"));
process.env.TMPDIR = tmp;

const { bundleOf, pruneBundles, default: jobFiles } = await import("../src/lib/jobFiles.js");
const { rteFilesMaxMb } = await import("../config/app.config.js");

// --------------------------------------------------------------------------------------
// a folder of playbooks, with links in it and out of it
// --------------------------------------------------------------------------------------
let dir;
let root;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "af-jobfiles-"));
  root = path.join(dir, "playbooks");
  const outside = path.join(dir, "app");
  fs.mkdirSync(path.join(root, "roles", "web"), { recursive: true });
  fs.mkdirSync(path.join(outside, "secrets"), { recursive: true });
  fs.writeFileSync(path.join(root, "site.yml"), "- hosts: all\n");
  fs.writeFileSync(path.join(root, "roles", "web", "main.yml"), "---\n");
  fs.writeFileSync(path.join(outside, ".env"), "ENCRYPTION_SECRET=top\n");
  fs.writeFileSync(path.join(outside, "secrets", "db.txt"), "DB_PASSWORD=top\n");
  // out of the folder : a file and a folder
  fs.symlinkSync(path.join(outside, ".env"), path.join(root, "env-link"));
  fs.symlinkSync(path.join(outside, "secrets"), path.join(root, "secrets-link"));
  fs.symlinkSync("../app/.env", path.join(root, "roles", "relative-env"));
  // in the folder : a file, a folder, and a loop back to the top
  fs.symlinkSync("site.yml", path.join(root, "main.yml"));
  fs.symlinkSync("roles/web", path.join(root, "web"));
  fs.symlinkSync("..", path.join(root, "roles", "up"));
});
afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(tmp, { recursive: true, force: true });
});

// the paths a bundle holds
async function listed(file) {
  const names = [];
  await tar.t({ file, onReadEntry: (e) => names.push(e.path) });
  return names.sort();
}

// --------------------------------------------------------------------------------------
// the tests
// --------------------------------------------------------------------------------------
describe("bundleOf", () => {
  test("packs into the test's own temporary folder", () => {
    assert.ok(jobFiles.BUNDLE_DIR.startsWith(tmp));
  });


  test("a link out of the folder is never packed, a link inside it is", async () => {
    const b = await bundleOf(root);
    const names = await listed(b.file);
    assert.deepEqual(names, ["main.yml", "roles/web/main.yml", "site.yml", "web/main.yml"]);
    // and nothing of the app's files is in it
    const content = [];
    await tar.t({ file: b.file, onReadEntry: (e) => e.on("data", (c) => content.push(c.toString())) });
    assert.doesNotMatch(content.join(""), /ENCRYPTION_SECRET|DB_PASSWORD/);
  });

  test("two jobs packing the same folder at once share one bundle", async () => {
    const other = path.join(dir, "inventory");
    fs.mkdirSync(other);
    fs.writeFileSync(path.join(other, "hosts"), "localhost\n");
    const [a, b, c] = await Promise.all([bundleOf(other), bundleOf(other), bundleOf(other)]);
    assert.equal(a.hash, b.hash);
    assert.equal(a.file, c.file);
    assert.equal(a.sha256, c.sha256);
    // no part file is left behind
    assert.deepEqual(fs.readdirSync(jobFiles.BUNDLE_DIR).filter((n) => n.startsWith(a.hash) && n.endsWith(".part")), []);
    assert.deepEqual(await listed(a.file), ["hosts"]);
  });
});

describe("pruneBundles", () => {
  test("removes the bundles unused for a day and the part files left behind, keeps the rest", async () => {
    const fresh = path.join(dir, "fresh");
    fs.mkdirSync(fresh);
    fs.writeFileSync(path.join(fresh, "a.yml"), "fresh\n");
    const kept = await bundleOf(fresh);
    const old = path.join(jobFiles.BUNDLE_DIR, `${"e".repeat(64)}.tgz`);
    const leftover = path.join(jobFiles.BUNDLE_DIR, `${"f".repeat(64)}.tgz.123.abcdef.part`);
    const stranger = path.join(jobFiles.BUNDLE_DIR, "not-a-bundle.txt");
    for (const f of [old, leftover, stranger]) {
      fs.writeFileSync(f, "x");
      const twoDaysAgo = new Date(Date.now() - 2 * jobFiles.BUNDLE_MAX_AGE_MS);
      fs.utimesSync(f, twoDaysAgo, twoDaysAgo);
    }
    assert.ok(pruneBundles() >= 2);
    assert.equal(fs.existsSync(old), false);
    assert.equal(fs.existsSync(leftover), false);
    assert.equal(fs.existsSync(stranger), true);
    assert.equal(fs.existsSync(kept.file), true);
    fs.rmSync(stranger);
  });

  test("a bundle pruned is packed again when it is asked for", async () => {
    const again = path.join(dir, "again");
    fs.mkdirSync(again);
    fs.writeFileSync(path.join(again, "b.yml"), "again\n");
    const first = await bundleOf(again);
    // everything is older than -1 ms : the bundle goes
    pruneBundles(-1);
    assert.equal(fs.existsSync(first.file), false);
    const second = await bundleOf(again);
    assert.equal(second.hash, first.hash);
    assert.equal(fs.existsSync(second.file), true);
  });
});

describe("RTE_FILES_MAX_MB", () => {
  test("a number above 0 is the limit", () => {
    assert.equal(rteFilesMaxMb("100"), 100);
    assert.equal(rteFilesMaxMb("0.5"), 0.5);
  });

  test("unset, not a number, 0 or below: 512, never no limit at all", () => {
    for (const value of [undefined, null, "", " ", "abc", "Infinity", "0", "-5", "NaN"]) {
      assert.equal(rteFilesMaxMb(value), 512, String(value));
    }
  });
});
