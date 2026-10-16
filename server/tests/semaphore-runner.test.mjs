// The semaphore runner (server/src/runners/semaphore.js) against a fake Semaphore api : the
// template found by name or id, the task launched with the form's values as extra vars, its
// output followed into the job once per line, its status mapped onto the job's, the abort.
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
const semaphore = RUNNERS.semaphore;

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

/* the fake Semaphore : one project (7), templates, and tasks that follow a script, one step per
   status read ; each step is [status, ...output lines added] */
let templates;
let script;
let tasks;
let requests;
let refuseLaunch;
let failStatusReads;
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const url = new URL(req.url, "http://x");
    requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), auth: req.headers.authorization, body: body ? JSON.parse(body) : undefined });
    const json = (code, data) => { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.end(data === undefined ? "" : JSON.stringify(data)); };
    if (req.headers.authorization !== "Bearer tok") return json(401, { error: "unauthorized" });
    const p = url.pathname;
    let m;
    if (p === "/api/ping") return res.end("pong");
    if (p === "/api/user") return json(200, { id: 1, username: "admin" });
    if (p === "/api/project/7") return json(200, { id: 7, name: "af" });
    if (p === "/api/project/7/templates") return json(200, templates);
    if (p === "/api/project/7/inventory") return json(200, [{ id: 1, name: "localhost" }, { id: 2, name: "prod" }]);
    if ((m = p.match(/^\/api\/project\/7\/templates\/(\d+)$/))) {
      const t = templates.find((x) => x.id == m[1]);
      return t ? json(200, t) : json(404, { error: "not found" });
    }
    if (p === "/api/project/7/tasks" && req.method === "POST") {
      if (refuseLaunch) return json(400, { error: "Template has no inventory" });
      const id = 100 + Object.keys(tasks).length;
      tasks[id] = { step: 0, lines: [], status: "waiting" };
      return json(201, { id, template_id: requests.at(-1).body.template_id, status: "waiting" });
    }
    if ((m = p.match(/^\/api\/project\/7\/tasks\/(\d+)$/))) {
      if (failStatusReads > 0) { failStatusReads--; return json(503, { error: "busy" }); }
      const t = tasks[m[1]];
      const step = script[Math.min(t.step, script.length - 1)];
      if (t.step < script.length) { t.status = step[0]; t.lines.push(...step.slice(1)); t.step++; }
      if (t.stopRequested && !["success", "error", "stopped"].includes(t.status)) t.status = "stopped";
      return json(200, { id: Number(m[1]), status: t.status });
    }
    if ((m = p.match(/^\/api\/project\/7\/tasks\/(\d+)\/output$/))) {
      return json(200, tasks[m[1]].lines.map((output) => ({ task_id: Number(m[1]), time: "", output })));
    }
    if ((m = p.match(/^\/api\/project\/7\/tasks\/(\d+)\/stop$/)) && req.method === "POST") {
      tasks[m[1]].stopRequested = true;
      return json(204);
    }
    return json(404, { error: `no ${p}` });
  });
});
let runner;
beforeAll(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  runner = { name: "sem", type: "semaphore", uri: `http://127.0.0.1:${server.address().port}/`, token: "tok", project: "7" };
});
afterAll(() => server.close());

beforeEach(() => {
  jobRow = { id: 5, status: "running" };
  outputs = [];
  // af-demo : a template from before task_params, it takes every override ; strict and loose
  // say what they allow, as since Semaphore 2.10
  templates = [
    { id: 3, name: "af-demo" },
    { id: 4, name: "other" },
    { id: 5, name: "strict", task_params: null },
    { id: 6, name: "loose", task_params: { allow_override_inventory: true, allow_override_limit: true, allow_debug: true } },
  ];
  script = [["waiting"], ["running", "PLAY [localhost] ***", "\x1b[0;32mok: [localhost]\x1b[0m"], ["running", "TASK [Count] ***"], ["success", "PLAY RECAP ***"]];
  tasks = {};
  requests = [];
  refuseLaunch = false;
  failStatusReads = 0;
});

const run = (extravars, credentialMap = {}) => semaphore.launch({ jobId: 5, jobType: "awx", extravars: { __template__: "af-demo", ...extravars }, credentialMap, runner });
const text = () => outputs.map((o) => o.output).join("\n");
const launched = () => requests.find((r) => r.method === "POST" && r.path === "/api/project/7/tasks");

describe("a template on Semaphore", () => {
  test("launched by name with the form's values as extra vars, followed to success", { timeout: 20000 }, async () => {
    await run({ who: "Mirko", count: 2, __playbook__: "x.yml" }, { db: "db" });
    const body = launched().body;
    assert.equal(body.template_id, 3);
    assert.deepEqual(JSON.parse(body.environment), { who: "Mirko", count: 2, db: { user: "dbuser", password: "s3cret" } }, "no __x__ parameters, the credentials resolved");
    assert.equal(jobRow.status, "success");
    assert.equal(jobRow.awx_id, 100, "the task id is the job's external id");
    assert.match(text(), /^ok: \[Running on Semaphore sem \(http:\/\/127\.0\.0\.1:\d+\/\)\]/);
    assert.match(text(), /ok: \[Launched template af-demo with taskid 100\]/);
    assert.match(text(), /ok: \[Successfully completed template af-demo\]$/);
  });

  test("every output line is written once, without ansi colours", { timeout: 20000 }, async () => {
    await run({});
    const lines = text().split("\n");
    for (const l of ["PLAY [localhost] ***", "ok: [localhost]", "TASK [Count] ***", "PLAY RECAP ***"]) {
      assert.equal(lines.filter((x) => x === l).length, 1, l);
    }
    assert.equal(/\x1b/.test(text()), false); // eslint-disable-line no-control-regex
  });

  test("without options none are sent", { timeout: 20000 }, async () => {
    await run({});
    assert.equal("params" in launched().body, false);
    assert.equal("limit" in launched().body, false);
  });

  test("a limit of several hosts is a list", { timeout: 20000 }, async () => {
    await run({ __limit__: "web1, web2" });
    assert.deepEqual(launched().body.params.limit, ["web1", "web2"]);
    assert.equal(launched().body.limit, "web1,web2");
  });

  test("a form's inventory is the task's, by name or by id", { timeout: 20000 }, async () => {
    await run({ __template__: "loose", __inventory__: "prod" });
    assert.equal(launched().body.inventory_id, 2);
    requests = [];
    jobRow = { id: 5, status: "running" };
    await run({ __template__: "loose", __inventory__: "1" });
    assert.equal(launched().body.inventory_id, 1);
  });

  test("an unknown inventory fails the job before anything is launched", { timeout: 20000 }, async () => {
    await assert.rejects(run({ __template__: "loose", __inventory__: "nope" }), (e) => e.jobEnded === true);
    assert.equal(launched(), undefined);
    assert.match(text(), /No inventory 'nope' in Semaphore project 7/);
  });

  test("an inventory or a limit the template does not allow is refused, not silently ignored", { timeout: 20000 }, async () => {
    await assert.rejects(run({ __template__: "strict", __inventory__: "prod" }), (e) => e.jobEnded === true);
    assert.match(text(), /template strict does not allow another inventory: switch on "Allow override inventory"/);
    jobRow = { id: 5, status: "running" };
    outputs = [];
    await assert.rejects(run({ __template__: "strict", __limit__: "web1" }), (e) => e.jobEnded === true);
    assert.match(text(), /template strict does not allow a limit: switch on "Allow override limit"/);
    assert.equal(launched(), undefined, "the playbook never ran on hosts the form did not ask for");
  });

  test("verbose the template does not allow: a warning, and the job runs", { timeout: 20000 }, async () => {
    await run({ __template__: "strict", __verbose__: true });
    assert.equal(launched().body.debug, undefined);
    assert.match(text(), /\[WARNING\]: template strict does not allow debug/);
    assert.equal(jobRow.status, "success");
  });

  test("a numeric template is an id", { timeout: 20000 }, async () => {
    await run({ __template__: "4" });
    assert.equal(launched().body.template_id, 4);
  });

  test("limit, verbose, check and diff are passed on", { timeout: 20000 }, async () => {
    await run({ __limit__: "web*", __verbose__: true, __check__: true, __diff__: true });
    const b = launched().body;
    assert.deepEqual(b.params, { limit: ["web*"], debug: true, dry_run: true, diff: true }, "where Semaphore 2.10+ reads them");
    assert.equal(b.limit, "web*", "and where the versions before read them");
    assert.equal(b.dry_run, true);
  });

  test("an error ends the job failed with an [ERROR] line", { timeout: 20000 }, async () => {
    script = [["running", "fatal: [localhost]: FAILED!"], ["error", "Failed to run task: exit status 2"]];
    await run({});
    assert.equal(jobRow.status, "failed");
    assert.match(text(), /\[ERROR\]: Template af-demo completed with status error$/);
  });

  test("stopped in Semaphore ends the job aborted", { timeout: 20000 }, async () => {
    script = [["running"], ["stopped"]];
    await run({});
    assert.equal(jobRow.status, "aborted");
  });

  test("a confirmation Semaphore waits for is said once, and the job goes on", { timeout: 20000 }, async () => {
    script = [["waiting_confirmation"], ["waiting_confirmation"], ["running"], ["success"]];
    await run({});
    assert.equal(text().split("\n").filter((l) => /waits for a confirmation/.test(l)).length, 1);
    assert.equal(jobRow.status, "success");
  });

  test("the abort flag stops the task, and the job ends aborted", { timeout: 20000 }, async () => {
    script = [["running", "step 1"], ["running", "step 2"], ["running", "step 3"], ["running"], ["running"], ["success"]];
    const done = run({});
    await new Promise((r) => setTimeout(r, 1500));
    jobRow.abort_requested = 1;
    await done;
    assert.ok(requests.some((r) => r.path === "/api/project/7/tasks/100/stop" && r.body.force === false));
    assert.equal(jobRow.status, "aborted");
    assert.equal(jobRow.abort_requested, 0);
  });

  test("an unknown template fails the job once, before anything is launched", { timeout: 20000 }, async () => {
    await assert.rejects(run({ __template__: "nope" }), (e) => e.jobEnded === true);
    assert.equal(jobRow.status, "failed");
    assert.equal(launched(), undefined);
    assert.match(text(), /\[ERROR\]: Failed to launch template nope: No template 'nope' in Semaphore project 7/);
  });

  test("a launch Semaphore refuses fails the job with its reason", { timeout: 20000 }, async () => {
    refuseLaunch = true;
    await assert.rejects(run({}), (e) => e.jobEnded === true);
    assert.equal(jobRow.status, "failed");
    assert.match(text(), /answered 400: Template has no inventory/);
  });

  test("a status read that fails is retried, not the end of the job", { timeout: 20000 }, async () => {
    failStatusReads = 1;
    await run({});
    assert.equal(jobRow.status, "success");
  });

  test("lost contact ends the job failed once the tolerance is spent", { timeout: 20000 }, async () => {
    giveUpAtOnce = true;
    failStatusReads = 1000;
    try {
      await run({});
    } finally {
      giveUpAtOnce = false;
    }
    assert.equal(jobRow.status, "failed");
    assert.match(text(), /lost contact with Semaphore while following task 100/);
  });
});

describe("the semaphore runner", () => {
  test("can run templates, not playbooks", () => {
    assert.deepEqual(semaphore.capabilities, { playbook: false, template: true });
  });

  test("check reports the user and the project", async () => {
    assert.deepEqual(await semaphore.check(runner), { user: "admin", project: "af", projectId: 7 });
  });

  test("check says when the token is refused, or the project does not exist", async () => {
    await assert.rejects(semaphore.check({ ...runner, token: "bad" }), /refused the token/);
    await assert.rejects(semaphore.check({ ...runner, project: "8" }), /has no project 8/);
  });

  test("cancel stops the task with the job's task id", async () => {
    tasks[100] = { step: 0, lines: [], status: "running" };
    jobRow.awx_id = 100;
    await semaphore.cancel({ jobId: 5, runner });
    assert.ok(requests.some((r) => r.method === "POST" && r.path === "/api/project/7/tasks/100/stop"));
  });
});
