// A job waiting for an approval was readable by every signed-in user (its extra vars and output
// included) : its list, its page, the MCP and chat job tools. Now only its owner, who sees every
// job, or an approver (one of their roles among the approval's roles, the rule Job.findApprovals
// counts with) reads it. And the user who launched a job does not approve it themselves (four
// eyes), unless the form's approval says allowSelf: true ; an admin approves any job, and the
// requester may still reject (withdraw) their own.
import { describe, test, expect, vi, beforeEach } from "vitest";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

// the queries the model ran, with their values
const queries = [];
vi.mock("../src/models/db.model.js", () => ({
  default: {
    do: async (sql, params) => {
      queries.push({ sql, params });
      if (/^SELECT id FROM AnsibleForms\.`jobs` WHERE id = \?$/.test(sql)) return [{ id: params[0] }];
      return [];
    },
  },
}));

const { default: Job } = await import("../src/models/job.model.js");

const owner = { username: "owner", type: "local", roles: ["public"], options: {} };
const approver = { username: "boss", type: "local", roles: ["public", "approvers"], options: {} };
const admin = { username: "admin", type: "local", roles: ["admin"], options: {} };
const watcher = { username: "w", type: "local", roles: ["public"], options: { showAllJobLogs: true } };

beforeEach(() => {
  queries.length = 0;
  vi.restoreAllMocks();
});

describe("who reads a job waiting for an approval", () => {
  test("the list: the user's own jobs, or one of their roles among the approval's", async () => {
    await Job.findAll(approver, 50);
    const { sql, params } = queries.at(-1);
    expect(sql).not.toMatch(/OR \(status='approve'\)\)/);
    expect(sql).toMatch(/status='approve' AND JSON_VALID\(approval\) AND \(JSON_CONTAINS\(approval, JSON_QUOTE\(\?\), '\$\.roles'\) OR JSON_CONTAINS/);
    expect(params).toEqual(expect.arrayContaining(["boss", "local", "public", "approvers", 50]));
  });

  test("a single job (its page, the MCP and chat tools): the same rule", async () => {
    await Job.findById(approver, 7, true).catch(() => {});
    const read = queries.find((q) => /FROM AnsibleForms\.jobs j/.test(q.sql));
    expect(read.sql).toMatch(/j\.status='approve' AND JSON_VALID\(j\.approval\) AND \(JSON_CONTAINS\(j\.approval/);
    expect(read.params.slice(-2)).toEqual(["public", "approvers"]);
  });

  test("a job read by someone who is neither its owner nor an approver: 403", async () => {
    await expect(Job.findById(owner, 7, true)).rejects.toThrow(/do not have access/);
  });

  test("a user without roles matches no approval", async () => {
    await Job.findAll({ username: "x", type: "local", roles: [], options: {} }, 10);
    expect(queries.at(-1).sql).toMatch(/OR 0\)/);
  });

  test("an admin, and who sees every job, keep reading all", async () => {
    await Job.findAll(admin, 10);
    await Job.findAll(watcher, 10);
    for (const q of queries) expect(q.sql).not.toMatch(/JSON_CONTAINS/);
  });
});

describe("approving one's own job", () => {
  const pending = (approval) => ({ id: 7, form: "f", status: "approve", job_type: "ansible", user: "owner", user_type: "local", approval: JSON.stringify(approval) });
  const asApprover = { ...owner, roles: ["public", "approvers"] };

  beforeEach(() => {
    vi.spyOn(Job, "continue").mockResolvedValue({ id: 7 });
    vi.spyOn(Job, "sendEventNotification").mockResolvedValue();
  });

  test("the requester, though an approver: refused", async () => {
    vi.spyOn(Job, "findById").mockResolvedValue(pending({ roles: ["approvers"] }));
    await expect(Job.approve(asApprover, 7)).rejects.toMatchObject({ status: 403 });
    expect(Job.continue).not.toHaveBeenCalled();
  });

  test("allowed when the approval says allowSelf: true", async () => {
    vi.spyOn(Job, "findById").mockResolvedValue(pending({ roles: ["approvers"], allowSelf: true }));
    await expect(Job.approve(asApprover, 7)).resolves.toEqual({ id: 7 });
  });

  test("an admin approves any job, their own included", async () => {
    vi.spyOn(Job, "findById").mockResolvedValue({ ...pending({ roles: ["approvers"] }), user: "admin" });
    await expect(Job.approve(admin, 7)).resolves.toEqual({ id: 7 });
  });

  test("the same name from another directory is another user", async () => {
    vi.spyOn(Job, "findById").mockResolvedValue({ ...pending({ roles: ["approvers"] }), user_type: "ldap" });
    await expect(Job.approve(asApprover, 7)).resolves.toEqual({ id: 7 });
  });

  test("another approver may", async () => {
    vi.spyOn(Job, "findById").mockResolvedValue(pending({ roles: ["approvers"] }));
    await expect(Job.approve(approver, 7)).resolves.toEqual({ id: 7 });
  });

  test("the requester may still reject it", async () => {
    vi.spyOn(Job, "findById").mockResolvedValue({ ...pending({ roles: ["approvers"] }), counter: 1 });
    vi.spyOn(Job, "printJobOutput").mockResolvedValue();
    vi.spyOn(Job, "transitionStatus").mockResolvedValue(true);
    await expect(Job.reject(asApprover, 7)).resolves.toBe(true);
  });
});
