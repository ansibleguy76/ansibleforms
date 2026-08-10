// Renaming a repository moves its working tree, because the tree lives at
// repoPath/<name>. The move used to happen BEFORE the database write, and the database
// write is where the seed's read-only guard lives - so renaming a seed-managed repository
// moved the directory and then answered 403, leaving the row pointing at a name that no
// longer existed on disk. The repository read as 'not cloned', every pull failed, and
// seed.ensureRepositoryClones cloned it again, orphaning the moved tree for good.
//
// Two rules follow, and both are pinned here:
//   - a refused rename must not touch the disk at all ;
//   - a rename whose database write fails for any other reason must put the tree back.
import { test, describe, beforeEach, vi } from "vitest";
import assert from "node:assert/strict";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

// the moves Repo.rename was asked to perform, in order
let moves = [];
let renameThrowsOn = null;
vi.mock("../src/models/repo.model.js", () => ({
  default: {
    rename: (from, to) => {
      if (renameThrowsOn === from) throw new Error(`cannot move ${from}`);
      moves.push(`${from}->${to}`);
      return true;              // a tree was actually moved
    },
    delete: async () => {},
  },
}));

let managed = false;
let updateThrows = null;
const crudCalls = [];
vi.mock("../src/models/crud.model.js", () => {
  class CrudModel {
    static async findByName(modelName, name) {
      return { id: 7, name, status: "success" };
    }
    static async assertNotManaged(modelName, id) {
      crudCalls.push(`assertNotManaged:${id}`);
      if (managed) {
        const e = new Error("This record is managed by the config seed and is read only");
        e.name = "AccessDeniedError";
        throw e;
      }
    }
    static async update(modelName, data, id, _opts) {
      crudCalls.push(`update:${id}`);
      if (updateThrows) throw new Error(updateThrows);
      return true;
    }
    static async create() { return 1; }
    static getCache() { return null; }
  }
  return { default: CrudModel };
});

const queries = [];
vi.mock("../src/models/db.model.js", () => ({
  default: {
    do: async (sql, vars) => {
      queries.push({ sql, vars });
      // the status claim has to look like it succeeded, or update() bails early
      if (/set status = 'running'/.test(sql)) return { affectedRows: 1 };
      return { affectedRows: 1 };
    },
  },
}));

const Repository = (await import("../src/models/repository.model.js")).default;

beforeEach(() => {
  moves = []; crudCalls.length = 0; queries.length = 0;
  managed = false; updateThrows = null; renameThrowsOn = null;
});

describe("renaming a repository the seed owns", () => {
  test("is refused WITHOUT moving anything on disk", async () => {
    managed = true;
    await assert.rejects(
      () => Repository.update({ name: "after" }, "before"),
      (e) => e.name === "AccessDeniedError"
    );
    assert.deepEqual(moves, [], "the working tree must not move for a rename that is refused");
  });

  test("the guard runs before the status claim, so a refusal leaves the row alone", async () => {
    managed = true;
    await assert.rejects(() => Repository.update({ name: "after" }, "before"));
    const claimed = queries.some(q => /set status = 'running'/.test(q.sql));
    assert.equal(claimed, false, "a refused rename must not claim the repository either");
  });

  test("an allowed rename does move the tree", async () => {
    await Repository.update({ name: "after" }, "before");
    assert.deepEqual(moves, ["before->after"]);
  });
});

describe("a rename whose database write fails", () => {
  test("puts the working tree back where it was", async () => {
    updateThrows = "the database went away";
    await assert.rejects(() => Repository.update({ name: "after" }, "before"));
    assert.deepEqual(moves, ["before->after", "after->before"],
      "a tree left at the new name while the row keeps the old one is the orphaned-clone bug");
  });

  test("and still releases the claim", async () => {
    updateThrows = "the database went away";
    await assert.rejects(() => Repository.update({ name: "after" }, "before"));
    const released = queries.filter(q => /set status = \?/.test(q.sql));
    assert.ok(released.length > 0, "a failed rename must not wedge the repository at 'running'");
  });

  test("a move that never happened is not 'undone'", async () => {
    // Repo.rename returns false when there is no working tree to move (a repository whose
    // clone never ran). Reversing that would be a misleading no-op at best.
    renameThrowsOn = "before";
    await assert.rejects(() => Repository.update({ name: "after" }, "before"));
    assert.deepEqual(moves, [], "nothing moved, so nothing to move back");
  });
});

describe("an ordinary update that is not a rename", () => {
  test("never touches the disk", async () => {
    await Repository.update({ description: "just a description" }, "before");
    assert.deepEqual(moves, []);
    assert.equal(queries.some(q => /set status = 'running'/.test(q.sql)), false);
  });
});
