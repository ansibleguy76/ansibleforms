// The jenkins runner (server/src/runners/jenkins.js) against a fake Jenkins api : the job found by
// its name or folder path (under the runner's folder), only the parameters it declares sent, the
// queue followed, the console read on by start and X-Text-Size (whole lines, the console notes
// taken out), its result mapped onto the job's, the abort - in the queue and while it builds.
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
const { jobPath } = await import("../src/runners/jenkins.js");
const jenkins = RUNNERS.jenkins;

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
  if (sql.includes("SELECT awx_id, extravars FROM")) return [{ awx_id: jobRow.awx_id, extravars: jobRow.extravars }];
  if (sql.includes("SELECT id FROM AnsibleForms.`jobs`")) return [{ id: params[0] }];
  return [];
};
Job.sendStatusNotification = async () => {};
Job.registerOutputSecrets = async () => {};

/* the fake Jenkins : a folder "ci" holding jobs, a queue, and builds whose console follows a
   script - one chunk per read (a chunk may end mid line) - then a result */
const NOTE = "\x1b[8mha:////4FgFl1v2kma/8yGlFlt==\x1b[0m";
let jobs;
let script;
let result;
let queueWaits;
let builds;
let queue;
let requests;
let failLogReads;
let refuseBuild;
const AUTH = `Basic ${Buffer.from("admin:tok").toString("base64")}`;
const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const url = new URL(req.url, "http://x");
    requests.push({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), body: Object.fromEntries(new URLSearchParams(body)) });
    const json = (code, data, headers = {}) => {
      res.writeHead(code, { "Content-Type": "application/json", "X-Jenkins": "2.580.1", ...headers });
      res.end(JSON.stringify(data));
    };
    if (req.headers.authorization !== AUTH) return json(401, {});
    const p = url.pathname;
    let m;
    if (p === "/api/json") return json(200, { mode: "NORMAL" });
    if (p === "/me/api/json") return json(200, { id: "admin" });
    if (p === "/job/ci/api/json") return json(200, { fullName: "ci" });
    if ((m = p.match(/^\/queue\/item\/(\d+)\/api\/json$/))) {
      const q = queue.get(m[1]);
      if (q.cancelled) return json(200, { cancelled: true, why: null });
      if (q.waits-- > 0) return json(200, { cancelled: false, why: "Waiting for next available executor" });
      return json(200, { cancelled: false, why: null, executable: { number: q.number } });
    }
    if (p === "/queue/cancelItem" && req.method === "POST") {
      const q = queue.get(url.searchParams.get("id"));
      if (q) q.cancelled = true;
      return json(204, {});
    }
    // /job/ci/job/<name>[/job/<name>]... then an action
    const parts = p.split("/").filter(Boolean);
    const names = [];
    let i = 0;
    while (parts[i] === "job") { names.push(decodeURIComponent(parts[i + 1])); i += 2; }
    const rest = parts.slice(i);
    const job = jobs[names.join("/")];
    if (!job) return json(404, {});
    if (rest.join("/") === "api/json") {
      return json(200, { fullName: names.join("/"), buildable: !job.disabled, property: job.parameters.length ? [{}, { parameterDefinitions: job.parameters.map((name) => ({ name })) }] : [] });
    }
    if ((rest[0] === "build" || rest[0] === "buildWithParameters") && req.method === "POST") {
      if (refuseBuild) return json(500, {});
      const id = 40 + queue.size;
      const number = 7 + Object.keys(builds).length;
      queue.set(String(id), { waits: queueWaits, number, cancelled: false });
      builds[number] = { step: 0, text: "", aborted: false };
      res.writeHead(201, { Location: `http://jenkins/queue/item/${id}/` });
      return res.end();
    }
    const b = builds[rest[0]];
    if (b && rest.slice(1).join("/") === "logText/progressiveText") {
      if (failLogReads > 0) { failLogReads--; return json(503, {}); }
      const start = Number(url.searchParams.get("start") || 0);
      if (b.aborted && b.step < script.length) { b.text += "Aborted by admin\nFinished: ABORTED\n"; b.step = script.length; }
      else if (b.step < script.length) b.text += script[b.step++];
      const more = b.step < script.length;
      res.writeHead(200, { "Content-Type": "text/plain", "X-Text-Size": String(b.text.length), ...(more ? { "X-More-Data": "true" } : {}) });
      return res.end(b.text.slice(start));
    }
    if (b && rest.slice(1).join("/") === "api/json") return json(200, { building: false, result: b.aborted ? "ABORTED" : result });
    if (b && rest[1] === "stop" && req.method === "POST") {
      b.aborted = true;
      res.writeHead(302, { Location: "/" });
      return res.end();
    }
    return json(404, {});
  });
});
let runner;
beforeAll(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  runner = { name: "ci", type: "jenkins", uri: `http://127.0.0.1:${server.address().port}`, username: "admin", token: "tok", project: "ci" };
});
afterAll(() => server.close());

beforeEach(() => {
  jobRow = { id: 5, status: "running" };
  outputs = [];
  jobs = {
    "ci/deploy": { parameters: ["who", "count", "tags", "dry_run", "db"] },
    "ci/web/build": { parameters: [] },
    "ci/off": { parameters: [], disabled: true },
  };
  script = [`Started by user admin\n${NOTE}[Pipeline] Start of Pipeline\nHello Mi`, "rko\nstep 1\n", "step 2\nFinished: SUCCESS\n"];
  result = "SUCCESS";
  queueWaits = 1;
  builds = {};
  // a Map : the queue item ids come from the request, never used as object keys
  queue = new Map();
  requests = [];
  failLogReads = 0;
  refuseBuild = false;
});

const run = (extravars, credentialMap = {}) => jenkins.launch({ jobId: 5, jobType: "awx", extravars: { __template__: "deploy", ...extravars }, credentialMap, runner });
const text = () => outputs.map((o) => o.output).join("\n");
const built = () => requests.find((r) => r.method === "POST" && /\/(build|buildWithParameters)$/.test(r.path));

describe("a job on Jenkins", () => {
  test("found under the runner's folder, built with only the parameters it declares, followed to success", { timeout: 20000 }, async () => {
    await run({ who: "Blai", count: 2, tags: ["a", "b"], dry_run: false, secret_field: "x", __playbook__: "y" }, { db: "db" });
    assert.equal(built().path, "/job/ci/job/deploy/buildWithParameters");
    assert.equal(built().query.delay, "0sec", "no quiet period");
    assert.deepEqual(built().body, { who: "Blai", count: "2", tags: '["a","b"]', dry_run: "false", db: '{"user":"dbuser","password":"s3cret"}' },
      "strings, a list or object as its json, nothing the job does not declare");
    assert.equal(jobRow.status, "success");
    assert.equal(jobRow.awx_id, 7, "the build number is the job's external id");
    assert.match(text(), /^ok: \[Running on Jenkins ci \(http:\/\/127\.0\.0\.1:\d+\)\]/);
    assert.match(text(), /ok: \[Queued job ci\/deploy, parameters who, count, tags, dry_run, db\]/);
    assert.match(text(), /Waiting in the Jenkins queue : Waiting for next available executor/);
    assert.match(text(), /ok: \[Launched job ci\/deploy with build #7\]/);
    assert.match(text(), /ok: \[Successfully completed job ci\/deploy, build #7\]$/);
  });

  test("the console is read on from where it stopped, whole lines once each, without its notes", { timeout: 20000 }, async () => {
    await run({});
    const lines = text().split("\n");
    for (const l of ["Started by user admin", "[Pipeline] Start of Pipeline", "Hello Mirko", "step 1", "step 2", "Finished: SUCCESS"]) {
      assert.equal(lines.filter((x) => x === l).length, 1, l);
    }
    assert.ok(!text().includes("ha:////"), "the console notes are taken out");
    const reads = requests.filter((r) => /progressiveText$/.test(r.path)).map((r) => r.query.start);
    assert.equal(reads[0], "0");
    assert.equal(new Set(reads).size, reads.length, "every read starts where the last one ended");
  });

  test("a job in a sub folder, without parameters, is built with build", { timeout: 20000 }, async () => {
    await run({ __template__: "web/build", who: "x" });
    assert.equal(built().path, "/job/ci/job/web/job/build/build");
    assert.deepEqual(built().body, {});
    assert.match(text(), /ok: \[Queued job ci\/web\/build\]/);
  });

  test("a result other than SUCCESS fails the job", { timeout: 20000 }, async () => {
    for (const r of ["FAILURE", "UNSTABLE"]) {
      jobRow = { id: 5, status: "running" };
      outputs = [];
      builds = {};
      result = r;
      await run({});
      assert.equal(jobRow.status, "failed", r);
      assert.match(text(), new RegExp(`\\[ERROR\\]: Job ci/deploy completed with result ${r} \\(build #7\\)$`));
    }
  });

  test("the abort flag stops the build, and the job ends aborted", { timeout: 20000 }, async () => {
    script = ["step 1\n", "step 2\n", "step 3\n", "step 4\n", "step 5\n", "step 6\n"];
    queueWaits = 0;
    const done = run({});
    await new Promise((r) => setTimeout(r, 1500));
    jobRow.abort_requested = 1;
    await done;
    assert.ok(requests.some((r) => r.method === "POST" && r.path === "/job/ci/job/deploy/7/stop"));
    assert.equal(jobRow.status, "aborted");
    assert.equal(jobRow.abort_requested, 0);
    assert.match(text(), /Job ci\/deploy was aborted \(build #7\)$/);
  });

  test("an abort while it waits in the queue cancels the queue item", { timeout: 20000 }, async () => {
    queueWaits = 1000;
    const done = run({});
    await new Promise((r) => setTimeout(r, 1500));
    jobRow.abort_requested = 1;
    await done;
    assert.ok(requests.some((r) => r.method === "POST" && r.path === "/queue/cancelItem" && r.query.id === "40"));
    assert.equal(jobRow.status, "aborted");
    assert.match(text(), /was cancelled in the Jenkins queue$/);
  });

  test("an unknown or a disabled job fails the job before anything is built", { timeout: 20000 }, async () => {
    await assert.rejects(run({ __template__: "nope" }), (e) => e.jobEnded === true);
    assert.match(text(), /\[ERROR\]: Failed to launch job ci\/nope : No job 'ci\/nope' on Jenkins/);
    jobRow = { id: 5, status: "running" };
    outputs = [];
    await assert.rejects(run({ __template__: "off" }), (e) => e.jobEnded === true);
    assert.match(text(), /cannot be built : it is disabled, or a folder/);
    assert.equal(built(), undefined);
  });

  test("a build Jenkins refuses fails the job with its reason", { timeout: 20000 }, async () => {
    refuseBuild = true;
    await assert.rejects(run({}), (e) => e.jobEnded === true);
    assert.equal(jobRow.status, "failed");
    assert.match(text(), /Jenkins at .* answered 500/);
  });

  test("a console read that fails is retried, not the end of the job", { timeout: 20000 }, async () => {
    failLogReads = 1;
    await run({});
    assert.equal(jobRow.status, "success");
  });

  test("lost contact ends the job failed once the tolerance is spent", { timeout: 20000 }, async () => {
    giveUpAtOnce = true;
    failLogReads = 1000;
    try {
      await run({});
    } finally {
      giveUpAtOnce = false;
    }
    assert.equal(jobRow.status, "failed");
    assert.match(text(), /lost contact with Jenkins while following build #7 of ci\/deploy/);
  });
});

describe("the jenkins runner", () => {
  test("can run templates, not playbooks", () => {
    assert.deepEqual(jenkins.capabilities, { playbook: false, template: true });
  });

  test("a job's path in Jenkins' urls", () => {
    assert.equal(jobPath("ops/deploy"), "/job/ops/job/deploy");
    assert.equal(jobPath("/a b/c/"), "/job/a%20b/job/c");
    assert.equal(jobPath(""), "");
  });

  test("check reports the version, the user and the folder", async () => {
    assert.deepEqual(await jenkins.check(runner), { version: "2.580.1", user: "admin", folder: "ci" });
    assert.deepEqual(await jenkins.check({ ...runner, project: null }), { version: "2.580.1", user: "admin" });
  });

  test("check says when the token is refused, or the folder does not exist", async () => {
    await assert.rejects(jenkins.check({ ...runner, token: "bad" }), /refused the user and API token/);
    await assert.rejects(jenkins.check({ ...runner, project: "nope" }), /has no folder nope/);
  });

  test("cancel stops the job's build", async () => {
    builds[7] = { step: 0, text: "", aborted: false };
    jobRow.awx_id = 7;
    jobRow.extravars = JSON.stringify({ __template__: "deploy" });
    await jenkins.cancel({ jobId: 5, runner });
    assert.ok(requests.some((r) => r.method === "POST" && r.path === "/job/ci/job/deploy/7/stop"));
  });
});
