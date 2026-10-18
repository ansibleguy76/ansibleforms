// A job's events are read by who may see the job, as the job itself (Job.findById's rule : who
// sees every job, its owner, an approver of its approval while it waits for it). Checking that read the whole
// job with its output, on every click of a host's line : Job.assertReadable answers it with one
// small query. And an event's order is a whole number from 0, else 400.
import { describe, test, expect, vi, beforeEach } from "vitest";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

// job 5 is owner's, job 6 waits for the approval of the role approvers ; the queries run, to tell
// a full read apart
const jobs = {
  5: { user: "owner", user_type: "local", status: "success" },
  6: { user: "owner", user_type: "local", status: "approve", approval: { roles: ["approvers"] } },
};
const queries = [];
vi.mock("../src/models/db.model.js", () => ({
  default: {
    do: async (sql, params) => {
      queries.push(sql);
      if (/^SELECT id FROM AnsibleForms\.`jobs` WHERE id = \?$/.test(sql)) return jobs[params[0]] ? [{ id: params[0] }] : [];
      if (/^SELECT id FROM AnsibleForms\.`jobs` WHERE id=\? AND/.test(sql)) {
        // the owner, or one of the roles after them among the approval's while it waits
        const [id, user, type, ...roles] = params;
        const j = jobs[id];
        const approver = /JSON_CONTAINS/.test(sql) && j?.status === "approve" && roles.some((r) => j.approval.roles.includes(r));
        return j && ((j.user === user && j.user_type === type) || approver) ? [{ id }] : [];
      }
      return [];
    },
  },
}));
vi.mock("../src/models/jobEvent.model.js", () => ({
  default: {
    findByJob: async () => [{ order: 0 }],
    findOne: async (_id, order) => (order === 0 ? { order: 0, result: {} } : null),
  },
}));

const { default: controller } = await import("../src/controllers/v2/job.controller.js");

function call(handler, user, params) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(data) { resolve({ status: this.statusCode, data }); return this; },
    };
    handler({ params, headers: {}, user: { user } }, res);
  });
}

const owner = { username: "owner", type: "local", roles: ["public"], options: {} };
const other = { username: "other", type: "local", roles: ["public"], options: {} };
const admin = { username: "admin", type: "local", roles: ["admin"], options: {} };
const approver = { username: "boss", type: "local", roles: ["public", "approvers"], options: {} };

beforeEach(() => { queries.length = 0; });

describe("a job's events", () => {
  test("its owner reads them, without the job's output being read", async () => {
    const r = await call(controller.getJobEvents, owner, { id: "5" });
    expect(r.status).toBe(200);
    expect(r.data.count).toBe(1);
    expect(queries.some((q) => /job_output/.test(q))).toBe(false);
  });

  test("another user may not (403), unless the job waits for their approval", async () => {
    expect((await call(controller.getJobEvents, other, { id: "5" })).status).toBe(403);
    // waiting for the approvers : not for any other user
    expect((await call(controller.getJobEvents, other, { id: "6" })).status).toBe(403);
    expect((await call(controller.getJobEvents, approver, { id: "6" })).status).toBe(200);
  });

  test("an admin reads any", async () => {
    expect((await call(controller.getJobEvent, admin, { id: "5", order: "0" })).status).toBe(200);
  });

  test("a job that is not there: 404", async () => {
    expect((await call(controller.getJobEvents, owner, { id: "99" })).status).toBe(404);
  });

  test.each(["-1", "1.5", "abc", "", "1e3"])("an order '%s' is refused: 400", async (order) => {
    const r = await call(controller.getJobEvent, owner, { id: "5", order });
    expect(r.status).toBe(400);
    expect(queries).toEqual([]);
  });

  test("an order with no event: 404", async () => {
    expect((await call(controller.getJobEvent, owner, { id: "5", order: "7" })).status).toBe(404);
  });
});
