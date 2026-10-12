// An inventory named by its name (inventory: production) : its folder, in the inventories folder
// or one of the inventories repositories ; anything else goes to ansible as it is. And the
// designer's inventories files from several repositories, each under its name.
import { test, describe, beforeAll, afterAll, vi } from "vitest";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";
process.env.DB_HOST = process.env.DB_HOST || "127.0.0.1";
process.env.DB_PORT = process.env.DB_PORT || "3306";
process.env.DB_USER = process.env.DB_USER || "test";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "test";

const { resolveInventory } = await import("../src/lib/inventories.js");

describe("an inventory by its name", () => {
  const dirs = new Set(["/inv/production", "/repo-a/inventories/web", "/repo-b/web", "/repo-b/db"]);
  const isDir = (p) => dirs.has(p);
  const local = [{ repository: null, root: "/inv" }];
  const repos = [
    { repository: "repo-a", root: "/repo-a/inventories" },
    { repository: "repo-b", root: "/repo-b" },
  ];

  test("a name is its folder", () => {
    assert.equal(resolveInventory("production", local, isDir), "/inv/production");
    assert.equal(resolveInventory("db", repos, isDir), "/repo-b/db");
  });

  test("anything else goes to ansible as it is", () => {
    assert.equal(resolveInventory("hosts.yml", local, isDir), "hosts.yml");
    assert.equal(resolveInventory("inventories/production/hosts.yml", local, isDir), "inventories/production/hosts.yml");
    assert.equal(resolveInventory("staging", local, isDir), "staging", "no such inventory");
    assert.equal(resolveInventory("../etc", local, isDir), "../etc");
    assert.equal(resolveInventory(["x"], local, isDir).length, 1, "not a string : as it is");
  });

  test("a name in two repositories must say which", () => {
    assert.throws(() => resolveInventory("web", repos, isDir), /Inventory 'web' is in several repositories \(repo-a, repo-b\) : name it <repository>\/web/);
    assert.equal(resolveInventory("repo-a/web", repos, isDir), "/repo-a/inventories/web");
    assert.equal(resolveInventory("repo-b/web", repos, isDir), "/repo-b/web");
  });
});

describe("the inventories files of several repositories", () => {
  let base;
  let ProjectFiles;
  beforeAll(async () => {
    base = fs.mkdtempSync(path.join(os.tmpdir(), "af-inv-"));
    fs.mkdirSync(path.join(base, "a/inventories/production/group_vars"), { recursive: true });
    fs.writeFileSync(path.join(base, "a/inventories/production/inventory.yaml"), "all: {}\n");
    fs.writeFileSync(path.join(base, "a/inventories/production/group_vars/all.yaml"), "x: 1\n");
    fs.mkdirSync(path.join(base, "b/staging"), { recursive: true });
    fs.writeFileSync(path.join(base, "b/staging/inventory.yaml"), "all: {}\n");
    const { default: Repository } = await import("../src/models/repository.model.js");
    const { default: Repo } = await import("../src/models/repo.model.js");
    Repository.getInventoryRoots = async () => [
      { repository: "a", root: path.join(base, "a/inventories") },
      { repository: "b", root: path.join(base, "b") },
    ];
    Repository.claimForWrite = async () => undefined;
    Repo.hasChanges = vi.fn(async (name) => name === "b");
    ({ default: ProjectFiles } = await import("../src/models/projectFiles.model.js"));
  });
  afterAll(() => fs.rmSync(base, { recursive: true, force: true }));

  test("are listed under their repository's name", async () => {
    const list = await ProjectFiles.list("inventories");
    assert.deepEqual(list.files.map((f) => f.path).sort(), [
      "a/production/group_vars/all.yaml",
      "a/production/inventory.yaml",
      "b/staging/inventory.yaml",
    ]);
    assert.deepEqual(list.roots, ["a", "b"]);
    assert.equal(list.repository, "a, b");
    assert.equal(list.dirty, true, "b has changes to push");
  });

  test("are read, written and deleted in their repository", async () => {
    assert.equal((await ProjectFiles.read("inventories", "a/production/group_vars/all.yaml")).content, "x: 1\n");
    await ProjectFiles.write("inventories", "b/staging/host_vars/web1.yaml", "y: 2\n", true);
    assert.equal(fs.readFileSync(path.join(base, "b/staging/host_vars/web1.yaml"), "utf8"), "y: 2\n");
    await ProjectFiles.remove("inventories", "b/staging/host_vars/web1.yaml");
    assert.equal(fs.existsSync(path.join(base, "b/staging/host_vars")), false, "the folder it leaves empty goes too");
    await assert.rejects(ProjectFiles.read("inventories", "c/x.yaml"), /in none of the repositories/);
  });
});
