// tests for job retention. The safety property matters more than the feature: this
// deletes user data, so a missing/zero window must delete NOTHING, and a job that has
// not finished must survive however old it is.
import { test, describe, beforeEach, vi } from "vitest";
import assert from "node:assert/strict";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

let queries = [];
let selectBatches = [];
// when true, DELETE reports 0 rows affected - the pathological case the loop guard
// exists for (a select that keeps returning rows the delete cannot remove)
let deleteRemovesNothing = false;
vi.mock("../src/models/db.model.js", () => ({
  default: {
    do: async (sql, vars) => {
      queries.push({ sql, vars });
      if (/^SELECT id FROM/.test(sql.trim())) return selectBatches.length ? selectBatches.shift() : [];
      if (/^DELETE FROM/.test(sql.trim())) {
        if (deleteRemovesNothing) return { affectedRows: 0 };
        // one row per selected id, as a cascade-less parent delete would report
        const ids = vars?.[0] || [];
        return { affectedRows: Array.isArray(ids) ? ids.length : 0 };
      }
      return [];
    },
  },
}));

const Job = (await import("../src/models/job.model.js")).default;

const selects = () => queries.filter((q) => /^SELECT id FROM/.test(q.sql.trim()));
const deletes = () => queries.filter((q) => /^DELETE FROM/.test(q.sql.trim()));

beforeEach(() => {
  queries = [];
  selectBatches = [];
  deleteRemovesNothing = false;
});

describe("retention never deletes when it is not configured", () => {
  for (const value of [0, undefined, null, -1, "", "0", "not-a-number"]) {
    test(`days=${JSON.stringify(value)} issues no delete`, async () => {
      const removed = await Job.removeOlderThan(value);
      assert.equal(removed, 0);
      assert.equal(deletes().length, 0, "no DELETE may be issued");
      assert.equal(selects().length, 0, "it should not even look");
    });
  }
});

describe("retention only ever targets finished top-level jobs", () => {
  test("only WHITELISTED terminal statuses are eligible", async () => {
    selectBatches = [[{ id: 1 }]];
    await Job.removeOlderThan(30);
    const sql = selects()[0].sql;
    // A whitelist, not `status <> 'running'`. Those are NOT equivalent: every approval
    // path writes status 'approve' together with an `end` timestamp, so a job awaiting
    // approval looks finished and a blacklist would delete un-executed work.
    assert.match(sql, /status IN \(\?\)/);
    const statuses = selects()[0].vars[0];
    // 'warning' is a FINAL status too: Multistep.launch writes it through endJobStatus (which
    // sets `end` and sends the notification) when a step failed with continue:true. Leaving
    // it out meant those parents were never selected, and since children go only via
    // `OR parent_id IN (?)` every step row and all their output survived for ever - on
    // exactly the jobs that tend to be biggest.
    assert.deepEqual([...statuses].sort(), ["abandoned", "aborted", "failed", "rejected", "success", "warning"]);
    assert.equal(statuses.includes("approve"), false, "a pending approval must never be eligible");
    assert.equal(statuses.includes("warning"), true, "a multistep that finished with warnings IS finished");
    assert.equal(statuses.includes("running"), false);
    // 'abandoned' never gets an `end`, so age is measured on end-or-start
    assert.match(sql, /COALESCE\(`end`, `start`\)/);
    // children are removed with their parent, never selected on their own
    assert.match(sql, /parent_id IS NULL/);
    assert.match(sql, /INTERVAL \? DAY/);
    assert.equal(selects()[0].vars[1], 30);
  });

  test("children are deleted along with their parent", async () => {
    selectBatches = [[{ id: 7 }, { id: 8 }]];
    await Job.removeOlderThan(30);
    const del = deletes()[0];
    // job_output cascades on its own foreign key, but parent_id has none
    assert.match(del.sql, /id IN \(\?\) OR parent_id IN \(\?\)/);
    assert.deepEqual(del.vars, [[7, 8], [7, 8]]);
  });
});

describe("retention deletes in batches", () => {
  test("it loops until a batch comes back empty", async () => {
    selectBatches = [[{ id: 1 }, { id: 2 }], [{ id: 3 }], []];
    const removed = await Job.removeOlderThan(10, 2);
    assert.equal(selects().length, 3, "two full batches then the empty one that stops it");
    assert.equal(deletes().length, 2);
    assert.equal(removed, 3);
    assert.equal(selects()[0].vars[2], 2, "the batch size is passed as the LIMIT");
  });

  test("a batch that deletes nothing breaks the loop instead of spinning", async () => {
    // a select that keeps returning rows the delete cannot remove would otherwise
    // loop for ever holding a connection
    deleteRemovesNothing = true;
    selectBatches = [[{ id: 1 }], [{ id: 1 }], [{ id: 1 }], [{ id: 1 }], [{ id: 1 }]];
    const removed = await Job.removeOlderThan(10, 1);
    assert.equal(removed, 0);
    assert.equal(selects().length, 1, "it must give up after the first fruitless batch");
    assert.equal(deletes().length, 1);
  });
});
