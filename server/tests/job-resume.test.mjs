// An AWX job its node stopped following (a restart, a replaced pod) is followed again instead of
// staying abandoned : issue #1084. Tested against a small test AWX with the real Awx.resume and
// the real tracker loop, and the take-over (lib/jobResume.js) against a test database.
import { test, describe, beforeAll, afterAll, beforeEach } from "vitest";
import assert from "node:assert/strict";
import http from "http";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";
process.env.DB_HOST = process.env.DB_HOST || "127.0.0.1";
process.env.DB_PORT = process.env.DB_PORT || "3306";
process.env.DB_USER = process.env.DB_USER || "test";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "test";

const { default: Job } = await import("../src/models/job.model.js");
const { Awx, printedWorkflowNodeIds } = await import("../src/runners/awx/api.js");
const { default: mysql } = await import("../src/models/db.model.js");
const { default: Runner } = await import("../src/models/runner.model.js");
const { RUNNERS } = await import("../src/runners/index.js");
const { resumeAbandoned, findResumable, resumableRunnerTypes, abandonAndResumeOnce, resetStartForTests } = await import("../src/lib/jobResume.js");

// --------------------------------------------------------------------------------------
// the test database : the jobs, and the output rows with their id, order and stream
// --------------------------------------------------------------------------------------
var jobs = {};
var rows = [];
var nextId = 1;
var candidates = [];
var lastSelect = null;
mysql.do = async function (sql, params) {
  if (sql.includes("INSERT INTO AnsibleForms.`job_output`")) {
    const row = { id: nextId++, ...params[0] };
    rows.push(row);
    return { insertId: row.id };
  }
  if (sql.includes("SELECT `order`, output_type, output FROM AnsibleForms.`job_output`")) {
    return rows.filter((r) => r.job_id == params[0]).sort((a, b) => a.order - b.order);
  }
  if (sql.includes("SELECT COALESCE(MAX(`order`),0) AS last")) {
    const own = rows.filter((r) => r.job_id == params[0]);
    return [{ last: own.length ? Math.max(...own.map((r) => r.order)) : 0 }];
  }
  if (sql.includes("DELETE FROM AnsibleForms.`job_output` WHERE job_id=? AND output_type='stdout' AND `order`>?")) {
    const before = rows.length;
    rows = rows.filter((r) => !(r.job_id == params[0] && r.output_type == "stdout" && r.order > params[1]));
    return { affectedRows: before - rows.length };
  }
  if (sql.includes("DELETE FROM AnsibleForms.`job_output` WHERE job_id=? AND output_type='stdout' AND `order`>=?")) {
    const [jobId, fromOrder, keepId] = params;
    rows = rows.filter((r) => !(r.job_id == jobId && r.output_type == "stdout" && r.order >= fromOrder && r.id != keepId));
    return { affectedRows: 1 };
  }
  // the take-over : one statement, matched on the node that followed the job
  if (sql.includes("SET status='running', tracker=? WHERE id=? AND status='abandoned'")) {
    const [self, id, tracker] = params;
    const j = jobs[id];
    if (!j || j.status !== "abandoned" || j.end || (j.tracker ?? null) !== tracker) return { affectedRows: 0 };
    Object.assign(j, { status: "running", tracker: self });
    return { affectedRows: 1 };
  }
  // given up : abandoned, with an end
  if (sql.includes("SET status='abandoned', `end`=NOW() WHERE id=? AND status='running'")) {
    const j = jobs[params[0]];
    if (j?.status === "running") Object.assign(j, { status: "abandoned", end: "now" });
    return { affectedRows: 1 };
  }
  // Job.abandonOwn : the running jobs of a tracker, and the untracked ones when asked
  if (sql.includes("set status='abandoned',abort_requested=0 where (status='running' or (status='approve' AND job_type='workflow')) and host IS NULL and (tracker=?")) {
    const untracked = sql.includes("or tracker IS NULL");
    let changedRows = 0;
    for (const j of Object.values(jobs)) {
      if (j.status !== "running") continue;
      const tracker = j.tracker ?? null;
      if ((params[0] !== null && tracker === params[0]) || (untracked && tracker === null)) {
        j.status = "abandoned";
        changedRows++;
      }
    }
    return { changedRows };
  }
  if (sql.includes("JOIN AnsibleForms.`runners` r")) {
    lastSelect = { sql, params };
    // the candidates still abandoned : a claimed one is 'running' again
    return candidates.filter((c) => jobs[c.id]?.status === "abandoned").map((c) => ({ ...c, tracker: jobs[c.id].tracker ?? null }));
  }
  if (sql.includes("UPDATE AnsibleForms.`jobs` set ? WHERE id=?")) {
    Object.assign((jobs[params[1]] ||= {}), params[0]);
    return { changedRows: 1 };
  }
  // Job.transitionStatus : only from the statuses it names
  if (sql.includes("UPDATE AnsibleForms.`jobs` SET ? WHERE id=? AND status IN (?)")) {
    const j = (jobs[params[1]] ||= { status: "running" });
    if (!params[2].includes(j.status)) return { affectedRows: 0 };
    Object.assign(j, params[0]);
    return { affectedRows: 1, changedRows: 1 };
  }
  if (sql.includes("SELECT status FROM AnsibleForms.`jobs` WHERE id=?")) return [{ status: jobs[params[0]]?.status }];
  if (sql.includes("SELECT abort_requested")) return [{ abort_requested: 0 }];
  if (sql.includes("SELECT id FROM AnsibleForms.`jobs`")) return [{ id: params[0] }];
  return [];
};
Job.sendStatusNotification = async () => {};

// --------------------------------------------------------------------------------------
// the test awx : job 88 runs for a few polls, then ends successful with three lines ; job 99
// is gone (404 on both endpoints)
// --------------------------------------------------------------------------------------
var awx = {};
const LOG = "line 1\nline 2\nline 3";
function handleRequest(req, res) {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname == "/api/v2/jobs/88/") {
    awx.poll++;
    const finished = awx.poll >= awx.polls;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        id: 88,
        type: "job",
        name: "long template",
        url: "/api/v2/jobs/88/",
        status: finished ? "successful" : "running",
        finished: finished ? "2026-01-01T10:00:00Z" : null,
        artifacts: {},
        related: { stdout: "/api/v2/jobs/88/stdout/" },
      }),
    );
    return;
  }
  if (url.pathname == "/api/v2/jobs/88/stdout/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(LOG);
    return;
  }
  res.writeHead(404);
  res.end();
}

var server;
var runner;
beforeAll(async () => {
  server = http.createServer(handleRequest);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  runner = { name: "awx-test", type: "awx", uri: `http://127.0.0.1:${server.address().port}`, token: "test-token", ignore_certs: true };
});
afterAll(() => server.close());
beforeEach(() => {
  jobs = {};
  rows = [];
  nextId = 1;
  candidates = [];
  lastSelect = null;
  awx = { poll: 0, polls: 3 };
});

// the job's output as it was when its node stopped : the launch, a chunk of stdout, a notice
function restartedJob(id) {
  jobs[id] = { status: "running" };
  rows.push(
    { id: nextId++, job_id: id, order: 1, output_type: "stdout", output: "ok: [Launched template long template with jobid 88]" },
    { id: nextId++, job_id: id, order: 2, output_type: "stdout", output: "line 1" },
    { id: nextId++, job_id: id, order: 3, output_type: "stderr", output: "a notice written meanwhile" },
  );
}
const outputOf = (id) => rows.filter((r) => r.job_id == id).sort((a, b) => a.order - b.order).map((r) => r.output);

// --------------------------------------------------------------------------------------
// the tests
// --------------------------------------------------------------------------------------
describe("Awx.resume", () => {
  test("follows the job again to its end: AWX's full stdout once, the lines around it kept", { timeout: 30000 }, async () => {
    restartedJob(5);
    const result = await Awx.resume(runner, { id: 5, awx_id: 88, awx_workflow: null });
    assert.equal(result, true);
    assert.equal(jobs[5].status, "success");
    assert.deepEqual(outputOf(5), [
      "ok: [Launched template long template with jobid 88]",
      "a notice written meanwhile",
      "ok: [Following job 88 again, after the server restarted]",
      LOG,
      "ok: [Successfully completed template long template]",
    ]);
  });

  test("a job AWX no longer knows is not resumed (null), and its output is left as it was", async () => {
    restartedJob(6);
    const result = await Awx.resume(runner, { id: 6, awx_id: 99, awx_workflow: null });
    assert.equal(result, null);
    assert.equal(outputOf(6).length, 3);
  });

  test("a workflow goes on from the nodes whose output it holds", () => {
    const banner = (name, status, id) => `WORKFLOW NODE [${name}] (${status}) #${id} ${"*".repeat(40)}`;
    const ids = printedWorkflowNodeIds([
      { output: `${banner("deploy", "successful", 12)}\nPLAY [all]` },
      { output: "ok: [Launched template wf with jobid 7]" },
      { output: `${banner("check", "failed", 15)}\nfatal: x` },
      // the summary lines have no banner : not printed nodes
      { output: "WORKFLOW [wf] (running)\nWORKFLOW NODE [later] (pending) #20" },
    ]);
    assert.deepEqual(ids.sort((a, b) => a - b), [12, 15]);
  });
});

describe("resumeAbandoned", () => {
  const realResume = RUNNERS.awx.resume;
  const realFind = Runner.findByName;
  afterAll(() => {
    RUNNERS.awx.resume = realResume;
    Runner.findByName = realFind;
  });
  beforeEach(() => {
    Runner.findByName = async (name) => (name === "awx-test" ? runner : null);
  });
  const until = async (check) => {
    for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
  };

  test("asks only for recent abandoned jobs on runners that can follow them again", async () => {
    await findResumable();
    assert.match(lastSelect.sql, /status='abandoned' AND j.`end` IS NULL/);
    assert.deepEqual(lastSelect.params[1], resumableRunnerTypes());
    assert.deepEqual(resumableRunnerTypes(), ["awx"]);
  });

  test("takes a job over once, and follows it on its runner", async () => {
    jobs[7] = { status: "abandoned", tracker: "app:old-pod" };
    candidates = [{ id: 7, tracker: "app:old-pod", runner: "awx-test", awx_id: 88 }];
    const followed = [];
    RUNNERS.awx.resume = async (ctx) => {
      followed.push(ctx.jobId);
      return true;
    };
    assert.equal(await resumeAbandoned("app:new-pod"), 1);
    assert.equal(jobs[7].status, "running");
    assert.equal(jobs[7].tracker, "app:new-pod");
    // a second node finds it taken
    assert.equal(await resumeAbandoned("app:other"), 0);
    await until(() => followed.length);
    assert.deepEqual(followed, [7]);
  });

  test("a job its runner no longer knows stays abandoned, with an end and a word why", async () => {
    jobs[8] = { status: "abandoned", tracker: null };
    candidates = [{ id: 8, tracker: null, runner: "awx-test", awx_id: 99 }];
    RUNNERS.awx.resume = async () => null;
    assert.equal(await resumeAbandoned("app:new-pod"), 1);
    await until(() => jobs[8].end);
    assert.equal(jobs[8].status, "abandoned");
    assert.equal(jobs[8].end, "now");
    assert.match(outputOf(8).at(-1), /no longer knows job 99/);
  });

  test("a resumed step ends its multistep, which says the next steps did not run", async () => {
    jobs[9] = { status: "abandoned", tracker: "app:old-pod" };
    jobs[3] = { status: "abandoned" };
    candidates = [{ id: 9, tracker: "app:old-pod", runner: "awx-test", awx_id: 88, parent_id: 3, step: "deploy" }];
    RUNNERS.awx.resume = async () => {
      jobs[9].status = "success";
      return true;
    };
    await resumeAbandoned("app:new-pod");
    await until(() => jobs[3].status === "failed");
    assert.equal(jobs[3].status, "failed");
    assert.match(outputOf(3).at(-1), /step 'deploy' ran \(job 9\): that step ended with success, the steps after it were not run/);
  });
});

describe("abandonAndResumeOnce", () => {
  const realResume = RUNNERS.awx.resume;
  const realFind = Runner.findByName;
  afterAll(() => {
    RUNNERS.awx.resume = realResume;
    Runner.findByName = realFind;
  });
  beforeEach(() => {
    Runner.findByName = async (name) => (name === "awx-test" ? runner : null);
    resetStartForTests();
  });
  // a follow that runs on : the job stays running while the next call comes
  const followInto = (followed) => (ctx) => {
    followed.push(ctx.jobId);
    return new Promise(() => {});
  };

  test("a dedicated worker's start and its bootstrap follow a resumed job with one loop only", async () => {
    // a job this worker followed before it restarted, and one from before 7 nobody follows
    jobs[11] = { status: "running", tracker: "worker:w1" };
    jobs[12] = { status: "running", tracker: null };
    candidates = [
      { id: 11, runner: "awx-test", awx_id: 88 },
      { id: 12, runner: "awx-test", awx_id: 88 },
    ];
    const followed = [];
    RUNNERS.awx.resume = followInto(followed);
    // the worker's start : its own job only
    assert.deepEqual(await abandonAndResumeOnce("worker:w1"), { abandoned: 1, resumed: 1 });
    assert.equal(jobs[11].status, "running");
    assert.equal(jobs[12].status, "running");
    // the bootstrap once the lock is held : the untracked job only, the resumed one left alone
    assert.deepEqual(await abandonAndResumeOnce("worker:w1", { untracked: true }), { abandoned: 1, resumed: 1 });
    assert.equal(jobs[11].status, "running");
    assert.equal(jobs[11].tracker, "worker:w1");
    assert.equal(jobs[12].tracker, "worker:w1");
    // a third call does nothing
    assert.deepEqual(await abandonAndResumeOnce("worker:w1", { untracked: true }), { abandoned: 0, resumed: 0 });
    await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(followed.sort(), [11, 12]);
  });

  test("an app process's bootstrap does it all in one go, and only once", async () => {
    jobs[13] = { status: "running", tracker: "app:a1" };
    jobs[14] = { status: "running", tracker: null };
    assert.deepEqual(await abandonAndResumeOnce("app:a1", { untracked: true }), { abandoned: 2, resumed: 0 });
    assert.deepEqual(await abandonAndResumeOnce("app:a1"), { abandoned: 0, resumed: 0 });
  });

  test("calls made together run one after the other, and a job gets one loop", async () => {
    jobs[15] = { status: "running", tracker: "worker:w1" };
    candidates = [{ id: 15, runner: "awx-test", awx_id: 88 }];
    const followed = [];
    RUNNERS.awx.resume = followInto(followed);
    const [a, b] = await Promise.all([abandonAndResumeOnce("worker:w1"), abandonAndResumeOnce("worker:w1", { untracked: true })]);
    assert.equal(a.resumed + b.resumed, 1);
    await new Promise((r) => setTimeout(r, 50));
    assert.deepEqual(followed, [15]);
  });
});
