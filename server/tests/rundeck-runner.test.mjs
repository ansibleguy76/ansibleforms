// The rundeck runner (server/src/runners/rundeck.js) against a fake Rundeck api : the job found
// by group/name, name or uuid, only the options it declares sent, its output read on by offset
// and lastmod, ERROR lines as stderr, its status mapped onto the job's, the abort.
import { test, describe, beforeAll, afterAll, beforeEach, vi } from "vitest";
import assert from "node:assert/strict";
import http from "http";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";
process.env.DB_HOST = process.env.DB_HOST || "127.0.0.1";
process.env.DB_PORT = process.env.DB_PORT || "3306";
process.env.DB_USER = process.env.DB_USER || "test";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "test";

// the tolerance itself is tested in awx-transient ; here it gives up at once when a test says so
let giveUpAtOnce = false;
vi.mock("../src/runners/common.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    contactTolerance: () => {
      const real = actual.contactTolerance();
      return { ok: real.ok, failed: () => (giveUpAtOnce ? { giveUp: true, waitMs: 0, failures: 1 } : { ...real.failed(), waitMs: 50 }) };
    },
  };
});

vi.mock("../src/models/credential.model.v2.js", () => ({
  default: { resolveCredentialMap: async (map) => (map?.db ? { db: { user: "dbuser", password: "s3cret" } } : {}) },
}));

const { default: Job } = await import("../src/models/job.model.js");
const { default: mysql } = await import("../src/models/db.model.js");
const { RUNNERS } = await import("../src/runners/index.js");
const rundeck = RUNNERS.rundeck;

/* the job in the database */
let jobRow;
let outputs;
mysql.do = async function (sql, params) {
  if (sql.includes("INSERT INTO AnsibleForms.`job_output`")) {
    outputs.push({ ...params[0] });
    return { insertId: outputs.length };
  }
  if (sql.includes("MAX(`order`)")) return [{ last: outputs.reduce((m, o) => Math.max(m, o.order), 0) }];
  if (sql.includes("UPDATE AnsibleForms.`jobs` set abort_requested=0")) { jobRow.abort_requested = 0; return { changedRows: 1 }; }
  if (sql.includes("UPDATE AnsibleForms.`jobs` set ?")) { Object.assign(jobRow, params[0]); return { changedRows: 1 }; }
  if (sql.includes("UPDATE AnsibleForms.`jobs` SET ? WHERE id=? AND status IN (?)")) {
    if (!params[2].includes(jobRow.status ?? "running")) return { affectedRows: 0 };
    Object.assign(jobRow, params[0]);
    return { affectedRows: 1, changedRows: 1 };
  }
  if (sql.includes("SELECT abort_requested")) return [{ abort_requested: jobRow.abort_requested || 0 }];
  if (sql.includes("SELECT form FROM")) return [{ form: "demo" }];
  if (sql.includes("SELECT awx_id FROM")) return [{ awx_id: jobRow.awx_id }];
  if (sql.includes("SELECT id FROM AnsibleForms.`jobs`")) return [{ id: params[0] }];
  return [];
};
Job.sendStatusNotification = async () => {};
Job.registerOutputSecrets = async () => {};

/* the fake Rundeck : project "af", jobs, and executions that follow a script - one step per
   output read, each step [execState, ...entries added] with an entry "ERROR:text" at level ERROR */
const UUID = "ade6820c-6e1a-446a-9d32-71912f7d4dde";
let jobs;
let script;
let finalStatus;
let executions;
let requests;
let failOutputReads;
let refuseRun;
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const url = new URL(req.url, "http://x");
    requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body: body ? JSON.parse(body) : undefined });
    const json = (code, data) => { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(data)); };
    if (req.headers["x-rundeck-auth-token"] !== "tok") return json(403, { error: true, message: "unauthorized" });
    const p = url.pathname;
    let m;
    if (p === "/api/41/system/info") return json(200, { system: { rundeck: { version: "6.2.1", apiversion: 59 } } });
    if (p === "/api/41/project/af") return json(200, { name: "af" });
    if (p === "/api/41/project/af/jobs") {
      const q = url.searchParams;
      return json(200, jobs.filter((j) => j.name === q.get("jobExactFilter") && (!q.has("groupPathExact") || j.group === q.get("groupPathExact"))));
    }
    if (p.startsWith("/api/41/project/")) return json(404, { error: true, message: "project does not exist" });
    if ((m = p.match(/^\/api\/41\/job\/([^/]+)\/info$/))) {
      const j = jobs.find((x) => x.id === m[1]);
      return j ? json(200, j) : json(404, { error: true, message: "no such job" });
    }
    if ((m = p.match(/^\/api\/41\/job\/([^/]+)$/)) && url.searchParams.get("format") === "yaml") {
      const j = jobs.find((x) => x.id === m[1]);
      res.setHeader("Content-Type", "application/yaml");
      return res.end(`- name: ${j.name}\n  options:\n${j.options.map((o) => `  - name: ${o}\n`).join("")}`);
    }
    if ((m = p.match(/^\/api\/41\/job\/([^/]+)\/run$/)) && req.method === "POST") {
      if (refuseRun) return json(400, { error: true, message: "Option 'count' is required" });
      const id = 300 + Object.keys(executions).length;
      executions[id] = { step: 0, entries: [], state: "running", status: "running" };
      return json(200, { id, status: "running", permalink: `http://rd/execution/show/${id}` });
    }
    if ((m = p.match(/^\/api\/41\/execution\/(\d+)\/output$/))) {
      if (failOutputReads > 0) { failOutputReads--; return json(503, { error: true, message: "busy" }); }
      const e = executions[m[1]];
      const offset = Number(url.searchParams.get("offset") || 0);
      if (e.step < script.length) {
        const [state, ...lines] = script[e.step++];
        e.state = state;
        for (const l of lines) {
        // "node>text" : a line from that node, else from the one node every line comes from
        const [node, log] = l.includes(">") ? l.split(">", 2) : ["rd-host", l];
        e.entries.push(log.startsWith("ERROR:") ? { level: "ERROR", log: log.slice(6), node } : { level: "NORMAL", log, node });
      }
      }
      if (e.abortRequested && e.state === "running") e.state = "aborted";
      const done = e.state !== "running";
      if (done) e.status = e.state === "succeeded" || e.state === "aborted" ? e.state : finalStatus;
      // offset counts entries here ; Rundeck's counts bytes - the client must only carry it
      const fresh = e.entries.slice(offset);
      const reply = { offset: String(e.entries.length), completed: done, execCompleted: done, execState: e.state, unmodified: fresh.length === 0, entries: fresh };
      if (e.entries.length) reply.lastModified = String(1000 + e.entries.length);
      return json(200, reply);
    }
    if ((m = p.match(/^\/api\/41\/execution\/(\d+)$/))) return json(200, { id: Number(m[1]), status: executions[m[1]].status });
    if ((m = p.match(/^\/api\/41\/execution\/(\d+)\/abort$/))) {
      executions[m[1]].abortRequested = true;
      return json(200, { abort: { status: "pending" }, execution: { id: m[1], status: "running" } });
    }
    return json(404, { error: true, message: `no ${p}` });
  });
});
let runner;
beforeAll(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  runner = { name: "rd", type: "rundeck", uri: `http://127.0.0.1:${server.address().port}`, token: "tok", project: "af" };
});
afterAll(() => server.close());

beforeEach(() => {
  jobRow = { id: 5, status: "running" };
  outputs = [];
  jobs = [
    { id: UUID, name: "af-demo", group: "tests", options: ["who", "count", "tags", "db"] },
    { id: "11111111-2222-3333-4444-555555555555", name: "plain", group: "", options: [] },
  ];
  script = [["running"], ["running", "Hello Mirko", "step 1"], ["running", "step 2"], ["succeeded", "done"]];
  finalStatus = "failed";
  executions = {};
  requests = [];
  failOutputReads = 0;
  refuseRun = false;
});

const run = (extravars, credentialMap = {}) => rundeck.launch({ jobId: 5, jobType: "awx", extravars: { __template__: "tests/af-demo", ...extravars }, credentialMap, runner });
const text = () => outputs.map((o) => o.output).join("\n");
const ran = () => requests.find((r) => r.method === "POST" && /\/run$/.test(r.path));

describe("a job on Rundeck", () => {
  test("found by group/name, run with only the options it declares, followed to success", { timeout: 20000 }, async () => {
    await run({ who: "Mirko", count: 2, tags: ["a", "b"], secret_field: "x", __playbook__: "y" }, { db: "db" });
    assert.equal(ran().path, `/api/41/job/${UUID}/run`);
    assert.deepEqual(ran().body.options, { who: "Mirko", count: "2", tags: '["a","b"]', db: '{"user":"dbuser","password":"s3cret"}' },
      "strings, a list or object as its json, nothing the job does not declare");
    assert.equal(jobRow.status, "success");
    assert.equal(jobRow.awx_id, 300, "the execution id is the job's external id");
    assert.match(text(), /^ok: \[Running on Rundeck rd \(http:\/\/127\.0\.0\.1:\d+\)\]/);
    assert.match(text(), /ok: \[Launched job tests\/af-demo with execution id 300, options who, count, tags, db\]/);
    assert.match(text(), /ok: \[Successfully completed job tests\/af-demo\]$/);
  });

  test("the output is read on from the offset, every line once", { timeout: 20000 }, async () => {
    await run({});
    const lines = text().split("\n");
    for (const l of ["Hello Mirko", "step 1", "step 2", "done"]) assert.equal(lines.filter((x) => x === l).length, 1, l);
    const reads = requests.filter((r) => /\/output$/.test(r.path));
    assert.equal(reads[0].query.offset, "0");
    assert.equal(reads[0].query.lastmod, "0", "no lastModified before the first line");
    assert.ok(reads.some((r) => r.query.offset === "2" && r.query.lastmod === "1002"), "both cursors carried forward");
  });

  test("a job on several nodes says each line's node ; on one node the lines are as they are", { timeout: 20000 }, async () => {
    script = [["running", "web1>step 1", "web2>step 1"], ["running", "web1>ERROR:disk full"], ["succeeded", "web2>done"]];
    await run({});
    const lines = text().split("\n");
    assert.ok(lines.includes("[web1] step 1") && lines.includes("[web2] step 1") && lines.includes("[web2] done"));
    assert.ok(outputs.some((o) => o.output_type === "stderr" && o.output === "[web1] disk full"));
    jobRow = { id: 5, status: "running" };
    outputs = [];
    script = [["running", "step 1"], ["succeeded", "done"]];
    await run({});
    assert.ok(text().split("\n").includes("step 1"), "one node: no prefix");
  });

  test("a bare name and a uuid name the job too", { timeout: 20000 }, async () => {
    await run({ __template__: "plain" });
    assert.equal(ran().path, "/api/41/job/11111111-2222-3333-4444-555555555555/run");
    requests = [];
    jobRow = { id: 5, status: "running" };
    await run({ __template__: UUID });
    assert.equal(ran().path, `/api/41/job/${UUID}/run`);
  });

  test("limit becomes the node filter, verbose the DEBUG log level", { timeout: 20000 }, async () => {
    await run({ __limit__: "tags: web", __verbose__: true });
    assert.equal(ran().body.filter, "tags: web");
    assert.equal(ran().body.loglevel, "DEBUG");
  });

  test("ERROR lines are stderr, and a failed execution fails the job", { timeout: 20000 }, async () => {
    script = [["running", "Hello", "ERROR:Failing because fail=true"], ["failed", "ERROR:Result: 2"]];
    await run({});
    assert.ok(outputs.some((o) => o.output_type === "stderr" && o.output === "Failing because fail=true"));
    assert.equal(jobRow.status, "failed");
    assert.match(text(), /\[ERROR\]: Job tests\/af-demo completed with status failed$/);
  });

  test("timedout and other end the job failed", { timeout: 20000 }, async () => {
    for (const s of ["timedout", "other"]) {
      jobRow = { id: 5, status: "running" };
      outputs = [];
      script = [["running"], [s]];
      finalStatus = s;
      await run({});
      assert.equal(jobRow.status, "failed", s);
      assert.match(text(), new RegExp(`completed with status ${s}$`));
    }
  });

  test("the abort flag aborts the execution, and the job ends aborted", { timeout: 20000 }, async () => {
    script = [["running", "step 1"], ["running", "step 2"], ["running", "step 3"], ["running"], ["running"], ["succeeded"]];
    const done = run({});
    await new Promise((r) => setTimeout(r, 1500));
    jobRow.abort_requested = 1;
    await done;
    assert.ok(requests.some((r) => r.path === "/api/41/execution/300/abort"));
    assert.equal(jobRow.status, "aborted");
    assert.equal(jobRow.abort_requested, 0);
  });

  test("an unknown job, or two of one name, fail the job before anything runs", { timeout: 20000 }, async () => {
    await assert.rejects(run({ __template__: "tests/nope" }), (e) => e.jobEnded === true);
    assert.match(text(), /\[ERROR\]: Failed to launch job tests\/nope: No job 'tests\/nope' in Rundeck project af/);
    jobs.push({ id: "99999999-2222-3333-4444-555555555555", name: "af-demo", group: "other", options: [] });
    jobRow = { id: 5, status: "running" };
    outputs = [];
    await assert.rejects(run({ __template__: "af-demo" }), (e) => e.jobEnded === true);
    assert.match(text(), /Several jobs are called 'af-demo' .* name it with its group/);
    assert.equal(ran(), undefined);
  });

  test("a run Rundeck refuses fails the job with its reason", { timeout: 20000 }, async () => {
    refuseRun = true;
    await assert.rejects(run({}), (e) => e.jobEnded === true);
    assert.equal(jobRow.status, "failed");
    assert.match(text(), /answered 400: Option 'count' is required/);
  });

  test("an output read that fails is retried, not the end of the job", { timeout: 20000 }, async () => {
    failOutputReads = 1;
    await run({});
    assert.equal(jobRow.status, "success");
  });

  test("lost contact ends the job failed once the tolerance is spent", { timeout: 20000 }, async () => {
    giveUpAtOnce = true;
    failOutputReads = 1000;
    try {
      await run({});
    } finally {
      giveUpAtOnce = false;
    }
    assert.equal(jobRow.status, "failed");
    assert.match(text(), /lost contact with Rundeck while following execution 300/);
  });
});

describe("the rundeck runner", () => {
  test("can run templates, not playbooks", () => {
    assert.deepEqual(rundeck.capabilities, { playbook: false, template: true });
  });

  test("check reports the version and the project", async () => {
    assert.deepEqual(await rundeck.check(runner), { version: "6.2.1", apiVersion: 59, project: "af" });
  });

  test("check says when the token is refused, or the project does not exist", async () => {
    await assert.rejects(rundeck.check({ ...runner, token: "bad" }), /refused the token/);
    await assert.rejects(rundeck.check({ ...runner, project: "nope" }), /has no project nope/);
  });

  test("cancel aborts the job's execution", async () => {
    executions[300] = { step: 0, entries: [], state: "running" };
    jobRow.awx_id = 300;
    await rundeck.cancel({ jobId: 5, runner });
    assert.ok(requests.some((r) => r.path === "/api/41/execution/300/abort"));
  });
});
