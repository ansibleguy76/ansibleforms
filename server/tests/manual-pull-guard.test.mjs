// A manual pull waits for the changes not pushed yet, as the scheduled pull does (cron.service.js
// skips a repository with local changes). It used to run git over them : the pull failed on a
// conflict, or merged over a designer save nobody had pushed. Now it is refused with a 409 that
// says what to do, the repository's status untouched, and Pull all skips such a repository and
// pulls the others.
import { describe, test, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

// the working trees (each with a .git folder) and the ones with changes not pushed yet
const state = vi.hoisted(() => ({ root: null, dirty: new Set(), sql: [] }));
vi.mock("../src/models/db.model.js", () => ({
  default: {
    do: async (sql) => {
      state.sql.push(sql);
      return /^\s*update/i.test(sql) ? { affectedRows: 1 } : [];
    },
  },
}));
vi.mock("../src/models/repo.model.js", () => {
  const nodePath = require("path");
  const Repo = {
    folderOf: (name) => nodePath.join(state.root, name),
    isValidName: () => true,
    hasChanges: vi.fn(async (name) => state.dirty.has(name)),
    pull: vi.fn(async () => "Already up to date."),
    clone: vi.fn(async () => "Already up to date."),
    info: async () => "abc1234",
    maskGitToken: (s) => s,
  };
  return { default: Repo, repoFolder: Repo.folderOf };
});

const { default: Repo } = await import("../src/models/repo.model.js");
const { default: Repository } = await import("../src/models/repository.model.js");
const { default: controller } = await import("../src/controllers/v2/repository.controller.js");

const message = (name) => `Repository '${name}' has changes not pushed yet: push them first (Push), or reset the repository to discard them`;

function response() {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
const req = (name) => ({ params: { name }, user: { user: { username: "admin", roles: ["admin"] } }, headers: {} });

beforeEach(() => {
  state.root = fs.mkdtempSync(path.join(os.tmpdir(), "af-pull-"));
  for (const name of ["alpha", "beta", "gamma"]) fs.mkdirSync(path.join(state.root, name, ".git"), { recursive: true });
  state.dirty = new Set();
  state.sql = [];
  Repo.pull.mockClear();
  Repo.clone.mockClear();
  // the repository's record, no credential
  vi.spyOn(Repository, "findByName").mockImplementation(async (name) => ({ name, uri: "https://git.example.com/forms.git" }));
});

describe("a manual pull", () => {
  test("is refused with a 409 while the repository has changes not pushed yet, and git never runs", async () => {
    state.dirty.add("alpha");
    const res = response();
    await controller.pull(req("alpha"), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.details).toBe(message("alpha"));
    expect(Repo.pull).not.toHaveBeenCalled();
    // refused before the claim : the repository's status is left as it was
    expect(state.sql.some((s) => /status = 'running'/.test(s))).toBe(false);
  });

  test("goes ahead when the working tree is clean", async () => {
    const res = response();
    await controller.pull(req("alpha"), res);
    expect(res.statusCode).toBe(200);
    expect(Repo.pull).toHaveBeenCalledTimes(1);
  });

  test("the settings' Pull (a clone of a repository already cloned) follows the same rule", async () => {
    state.dirty.add("beta");
    const refused = response();
    await controller.clone(req("beta"), refused);
    expect(refused.statusCode).toBe(409);
    expect(refused.body.details).toBe(message("beta"));
    expect(Repo.clone).not.toHaveBeenCalled();
    const clean = response();
    await controller.clone(req("alpha"), clean);
    expect(clean.statusCode).toBe(200);
    expect(Repo.clone).toHaveBeenCalledTimes(1);
  });

  test("a repository not cloned yet has nothing to lose : its clone is never refused", async () => {
    state.dirty.add("delta");
    const res = response();
    await controller.clone(req("delta"), res);
    expect(res.statusCode).toBe(200);
    expect(Repo.hasChanges).not.toHaveBeenCalledWith("delta");
  });
});

describe("Pull all", () => {
  test("skips a repository with changes not pushed yet, says which, and pulls the others", async () => {
    state.dirty.add("beta");
    const spy = vi.spyOn(Repository, "findPushableRepositories").mockResolvedValue([{ name: "alpha" }, { name: "beta" }, { name: "gamma" }]);
    const res = response();
    await controller.formsRepoPullAll(req(), res);
    spy.mockRestore();
    expect(res.statusCode).toBe(200);
    expect(res.body.skipped).toEqual(["beta"]);
    expect(res.body.results).toEqual([
      { name: "alpha", status: "success" },
      { name: "beta", status: "skipped", output: message("beta") },
      { name: "gamma", status: "success" },
    ]);
    expect(Repo.pull).toHaveBeenCalledTimes(2);
  });
});
