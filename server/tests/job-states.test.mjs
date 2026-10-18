// The states a job moves through, and who may still move it.
//
//  - The sweeps matched `(status='running' or abort_requested)`, so a job that had FINISHED with
//    its abort flag still set (an aborted workflow, a late abort on a job that succeeded, an
//    approval gate aborted and then rejected) was turned into 'abandoned' after the fact. They
//    match a job still under way only, and an end answers the abort flag in the same statement.
//  - The hourly sweep measured a job's age from its start, so a workflow approved after a day of
//    waiting was abandoned while it ran on ; its next approval then failed to hold it, and the
//    loop polled for an answer for ever.
//  - A step job (waitForCompletion) and an approved job whose run threw stayed 'running' for
//    good : only a log line said they had failed.
import { describe, test, expect, vi, beforeEach } from "vitest";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

// every statement, and an answer per test
let calls;
let answer;
vi.mock("../src/models/db.model.js", () => ({
  default: {
    do: async (sql, params) => {
      calls.push({ sql, params });
      return answer(sql, params);
    },
  },
}));

// the runner a job is handed to : its run throws, per test
let dispatchImpl;
vi.mock("../src/runners/orchestrator.js", () => ({
  dispatch: (...args) => dispatchImpl(...args),
  resolveRunner: async () => ({ row: null }),
}));

vi.mock("../src/models/form.model.js", () => ({
  default: {
    load: async () => ({ forms: [{ name: "Approved form", type: "ansible", playbook: "site.yml" }] }),
  },
}));

const { default: Job } = await import("../src/models/job.model.js");
const { runWorkflow, stillUnderWay } = await import("../src/models/workflowRun.js");

const admin = { username: "root", type: "local", roles: ["admin"], options: {} };

beforeEach(() => {
  calls = [];
  answer = () => ({ affectedRows: 0, changedRows: 0 });
  dispatchImpl = async () => true;
});

// ─── 1. the sweeps match a job still under way only ───

describe("a finished job keeps its status, whatever its abort flag says", () => {
  test("no sweep matches on abort_requested alone", async () => {
    await Job.abandon();
    await Job.abandonOwn("app-a");
    await Job.abandonDeadNodes("worker-a");
    expect(calls).toHaveLength(3);
    for (const { sql } of calls) {
      expect(sql).not.toMatch(/or (j\.)?abort_requested\)/);
      expect(sql).toMatch(/status='running'/);
      // and the flag is answered with the status
      expect(sql).toMatch(/abort_requested=0/);
    }
  });

  test("the hourly sweep never abandons a workflow waiting on an approval", async () => {
    await Job.abandon();
    expect(calls[0].sql).not.toMatch(/approve/);
  });

  test("a node's start and the dead-node sweep end the workflow jobs whose loop died waiting", async () => {
    await Job.abandonOwn("app-a");
    await Job.abandonDeadNodes("worker-a");
    expect(calls[0].sql).toMatch(/status='approve' AND job_type='workflow'/);
    expect(calls[1].sql).toMatch(/j\.status='approve' and j\.job_type='workflow'/);
  });

  test("an end clears the abort flag in the same statement", async () => {
    answer = (sql) => (/AND status IN/.test(sql) ? { affectedRows: 1 } : []);
    Job.sendStatusNotification = async () => {};
    await Job.endJobStatus(5, 9, "stdout", "success", "ok: [Playbook finished]");
    const end = calls.find((c) => /AND status IN/.test(c.sql));
    expect(end.params[0]).toMatchObject({ status: "success", abort_requested: 0 });
  });

  test("a move to a terminal status clears it ; a rejected workflow job keeps it for its loop", async () => {
    answer = () => ({ affectedRows: 1 });
    await Job.transitionStatus(5, ["approve"], { status: "aborted" });
    expect(calls[0].params[0].abort_requested).toBe(0);
    await Job.transitionStatus(5, ["approve"], { status: "rejected" });
    expect(calls[1].params[0].abort_requested.toSqlString()).toBe("IF(job_type='workflow', abort_requested, 0)");
    // a move that is no end (approve, running again) leaves the flag alone
    await Job.transitionStatus(5, ["running"], { status: "approve" });
    expect("abort_requested" in calls[2].params[0]).toBe(false);
  });
});

// ─── 2. a long approval, and a workflow that is no longer running ───

describe("the hourly sweep measures a job's age from its last activity", () => {
  test("a job with an output line in the last day is not abandoned", async () => {
    await Job.abandon();
    expect(calls[0].sql).toMatch(/NOT EXISTS \(SELECT 1 FROM AnsibleForms.`job_output` o WHERE o.job_id=j.id AND o.`timestamp` > \(NOW\(\) - INTERVAL 1 DAY\)\)/);
  });
});

describe("a workflow loop follows its job only while it is under way", () => {
  test("running, approve and aborted go on ; rejected only while waiting ; anything else stops", () => {
    expect(stillUnderWay("running")).toBe(true);
    expect(stillUnderWay("approve")).toBe(true);
    expect(stillUnderWay("aborted")).toBe(true);
    expect(stillUnderWay("rejected", true)).toBe(true);
    expect(stillUnderWay("rejected", false)).toBe(false);
    for (const status of ["abandoned", "success", "failed", undefined]) expect(stillUnderWay(status, true)).toBe(false);
  });

  test("an approval that cannot hold the job (it was abandoned) does not poll for ever", async () => {
    const fs = await import("fs");
    const os = await import("os");
    const path = await import("path");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "af-wf-states-"));
    fs.writeFileSync(
      path.join(root, "gate.yml"),
      "workflow_job_templates:\n  - name: gate\n    related:\n      workflow_nodes:\n" +
        "        - identifier: ok\n          unified_job_template: { name: Approve it, type: workflow_approval_template }\n",
    );
    const Repository = (await import("../src/models/repository.model.js")).default;
    Repository.getWorkflowsRoots = async () => [{ repository: null, root }];
    // the job : running on the first two looks (the node starts, then asks), abandoned by a sweep meanwhile
    let looks = 0;
    answer = (sql) => {
      if (/SELECT status FROM AnsibleForms.`jobs`/.test(sql)) return [{ status: looks++ < 2 ? "running" : "abandoned" }];
      return [];
    };
    const ended = [];
    const FakeJob = {
      lastOrder: async () => 0,
      printJobOutput: async () => false,
      update: async () => {},
      isAbortRequested: async () => false,
      // the job is no longer running : nothing moves it to 'approve'
      transitionStatus: vi.fn(async () => false),
      sendApprovalNotification: vi.fn(async () => {}),
      endJobStatus: async (...args) => ended.push(args),
    };
    await runWorkflow({ Job: FakeJob, form: "f", formObj: { workflow: "gate" }, user: admin, extravars: {}, credentials: {}, jobid: 77 });
    expect(FakeJob.transitionStatus).toHaveBeenCalledWith(77, ["running"], expect.objectContaining({ status: "approve" }));
    expect(FakeJob.sendApprovalNotification).not.toHaveBeenCalled();
    // given up on : the loop stops without writing an end over the sweep's
    expect(ended).toEqual([]);
  }, 10000);

  test("aborted while it waits, then rejected before the loop saw the abort : it still ends aborted", async () => {
    const fs = await import("fs");
    const os = await import("os");
    const path = await import("path");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "af-wf-states-"));
    fs.writeFileSync(
      path.join(root, "gate.yml"),
      "workflow_job_templates:\n  - name: gate\n    related:\n      workflow_nodes:\n" +
        "        - identifier: ok\n          unified_job_template: { name: Approve it, type: workflow_approval_template }\n",
    );
    const Repository = (await import("../src/models/repository.model.js")).default;
    Repository.getWorkflowsRoots = async () => [{ repository: null, root }];
    // the job's status as the database holds it ; an approver rejects it once it waits
    let status = "running";
    answer = (sql) => {
      if (/SELECT status FROM AnsibleForms.`jobs`/.test(sql)) return [{ status }];
      return [];
    };
    const ended = [];
    const FakeJob = {
      lastOrder: async () => 0,
      printJobOutput: async () => false,
      update: async () => {},
      // the abort was asked while it waited ; the rejection came in first
      isAbortRequested: async () => aborting,
      transitionStatus: vi.fn(async (id, from, to) => {
        if (!from.includes(status)) return false;
        status = to.status;
        // waiting on the approval now : rejected at once, the abort flag set meanwhile
        if (status === "approve") {
          status = "rejected";
          aborting = true;
        }
        return true;
      }),
      requestAbort: async () => {},
      sendApprovalNotification: vi.fn(async () => {}),
      endJobStatus: async (...args) => ended.push(args),
    };
    let aborting = false;
    await runWorkflow({ Job: FakeJob, form: "f", formObj: { workflow: "gate" }, user: admin, extravars: {}, credentials: {}, jobid: 78 });
    expect(FakeJob.transitionStatus).toHaveBeenCalledWith(78, ["approve", "rejected"], expect.objectContaining({ status: "running" }));
    expect(ended.length).toBe(1);
    expect(ended[0]).toContain("aborted");
  }, 10000);
});

describe("a multistep moves on to its next step only while it is still running", () => {
  test("the step is written conditionally, on this node's job", async () => {
    answer = () => ({ affectedRows: 0 });
    expect(await Job.claimNextStep(30, "two", "app-a")).toBe(false);
    expect(calls[0].sql).toMatch(/SET step=\? WHERE id=\? AND status='running' AND \(tracker IS NULL OR tracker=\?\)/);
    expect(calls[0].params).toEqual(["two", 30, "app-a"]);
    answer = () => ({ affectedRows: 1 });
    expect(await Job.claimNextStep(30, "two", "app-a")).toBe(true);
  });
});

describe("a job taken over by another node", () => {
  test("is followed elsewhere when jobs.tracker names another node", async () => {
    answer = () => [{ tracker: "app-b", host: null }];
    expect(await Job.followedElsewhere(5, "app-a")).toBe(true);
    expect(await Job.followedElsewhere(5, "app-b")).toBe(false);
    answer = () => [{ tracker: null, host: null }];
    expect(await Job.followedElsewhere(5, "app-a")).toBe(false);
    answer = () => [{ tracker: "app-b", host: "rte-1" }];
    expect(await Job.followedElsewhere(5, "app-a")).toBe(false);
  });
});

// ─── 4. a run that throws ends its job ───

describe("a job whose run throws ends as failed", () => {
  let ended;
  beforeEach(() => {
    ended = [];
    Job.endJobStatus = async (jobid, counter, stream, status, message) => { ended.push({ jobid, status, message }); };
    Job.lastOrder = async () => 3;
  });

  test("a step job (waitForCompletion) : ended failed, and the error still reaches its caller", async () => {
    answer = (sql) => (/INSERT INTO AnsibleForms.`jobs`/.test(sql) ? { insertId: 41 } : { affectedRows: 1 });
    Job.sendEventNotification = async () => {};
    dispatchImpl = async () => { throw new Error("the runner is gone"); };
    const launched = await Job.launch({
      form: "multi",
      formObj: { name: "step one", type: "ansible", playbook: "site.yml" },
      user: admin,
      parentId: 40,
      waitForCompletion: true,
    });
    await expect(launched.completionPromise).rejects.toThrow("the runner is gone");
    expect(ended).toEqual([{ jobid: 41, status: "failed", message: "[ERROR]: the runner is gone" }]);
  });

  test("an approved job : ended failed instead of left running", async () => {
    answer = (sql) => (/SET status='running', tracker=\? WHERE id=\? AND status='approve'/.test(sql) ? { affectedRows: 1 } : { affectedRows: 1 });
    Job.checkExists = async () => true;
    Job.findById = async () => ({ id: 50, step: null, counter: 4, status: "approve" });
    Job.printJobOutput = async () => false;
    dispatchImpl = async () => { throw new Error("cannot reach AWX"); };
    await Job.continue({ form: "Approved form", user: admin, jobid: 50 });
    await vi.waitFor(() => expect(ended).toHaveLength(1));
    expect(ended[0]).toEqual({ jobid: 50, status: "failed", message: "[ERROR]: cannot reach AWX" });
  });
});
