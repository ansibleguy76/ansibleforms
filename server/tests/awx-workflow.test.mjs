// integration tests for the awx (workflow) job tracking ; run with `npm test` (node --test)
// spins up a test awx api and mocks the database, then runs the real
// Awx.trackJob / Awx.trackWorkflowJob polling loops against it (issue #420)
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import http from "http";

// minimal env so the config modules load without a real setup
process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";
process.env.DB_HOST = process.env.DB_HOST || "127.0.0.1";
process.env.DB_PORT = process.env.DB_PORT || "3306";
process.env.DB_USER = process.env.DB_USER || "test";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "test";

const { default: Job, Awx } = await import("../src/models/job.model.js");
const { default: mysql } = await import("../src/models/db.model.js");
const { default: AwxModel } = await import("../src/models/awx.model.js");
const { default: logger } = await import("../src/lib/logger.js");

/*****************************************************************/
/* test database                                                 */
/*****************************************************************/
var jobRow = {};
var outputs = [];
mysql.do = async function (sql, params) {
  if (sql.includes("INSERT INTO AnsibleForms.`job_output`")) {
    outputs.push({ ...params[0] });
    return { insertId: outputs.length };
  }
  if (sql.includes("UPDATE AnsibleForms.`jobs` set abort_requested=0")) {
    jobRow.abort_requested = 0;
    return { changedRows: 1 };
  }
  if (sql.includes("UPDATE AnsibleForms.`jobs` set ?")) {
    Object.assign(jobRow, params[0]);
    return { changedRows: 1 };
  }
  if (sql.includes("SELECT abort_requested")) {
    return [{ abort_requested: jobRow.abort_requested || 0 }];
  }
  if (sql.includes("SELECT id FROM AnsibleForms.`jobs`")) {
    return [{ id: params[0] }];
  }
  return [];
};
// no notifications during tests
Job.sendStatusNotification = async () => {};

/*****************************************************************/
/* test awx api                                                  */
/*****************************************************************/
var awxState = {};
var cancelCalls = [];

function resetState() {
  jobRow = {};
  outputs = [];
  cancelCalls = [];
  awxState = {
    wfPoll: 0, // number of times the workflow job was polled
    wfFinalStatus: "successful",
    jobPoll: 0, // number of times the regular job was polled
    abortAfterPoll: 0, // request an ansibleforms abort after this wf poll (0 = never)
  };
}

// the node statuses evolve with every workflow poll:
// poll 1 : node1 running   node2 pending  node3 pending
// poll 2 : node1 successful node2 running node3 pending
// poll >= 3 : node1 successful node2 final node3 do_not_run
function nodeSummaries() {
  const p = awxState.wfPoll;
  const node2Final = awxState.wfFinalStatus == "successful" ? "successful" : "failed";
  return {
    1: { id: 101, name: "node one", type: "job", status: p >= 2 ? "successful" : "running", elapsed: p >= 2 ? 1.5 : 0 },
    2: p >= 2 ? { id: 102, name: "node two", type: "job", status: p >= 3 ? node2Final : "running", elapsed: p >= 3 ? 2.5 : 0 } : null,
    3: null,
  };
}

function workflowNodes(page) {
  const s = nodeSummaries();
  const all = [
    {
      id: 1,
      job: 101,
      related: { job: "/api/v2/jobs/101/" },
      summary_fields: { job: s[1], unified_job_template: { name: "node one", unified_job_type: "job" } },
      success_nodes: [2],
      failure_nodes: [3],
      always_nodes: [],
      do_not_run: false,
    },
    {
      id: 2,
      job: s[2] ? 102 : null,
      related: s[2] ? { job: "/api/v2/jobs/102/" } : {},
      summary_fields: { job: s[2], unified_job_template: { name: "node two", unified_job_type: "job" } },
      success_nodes: [],
      failure_nodes: [],
      always_nodes: [],
      do_not_run: false,
    },
    {
      id: 3,
      job: null,
      related: {},
      summary_fields: { unified_job_template: { name: "node three", unified_job_type: "job" } },
      success_nodes: [],
      failure_nodes: [],
      always_nodes: [],
      do_not_run: awxState.wfPoll >= 3, // awx marks the not taken branch as do_not_run
    },
  ];
  // 2 pages, to test the pagination
  if (page == 1) return { count: 3, next: "/api/v2/workflow_jobs/1/workflow_nodes/?page=2", results: all.slice(0, 2) };
  return { count: 3, next: null, results: all.slice(2) };
}

const server = http.createServer((req, res) => {
  try {
    handleRequest(req, res);
  } catch (e) {
    // never leave a request hanging, the polling loops would wait forever
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ detail: e.message }));
  }
});

function handleRequest(req, res) {
  if (process.env.TEST_DEBUG) console.log("[test awx]", req.method, req.url);
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;
  var data = null;
  if (req.method == "POST" && path.match(/\/cancel\/$/)) {
    cancelCalls.push(path);
    res.writeHead(202, { "Content-Type": "application/json" });
    res.end("{}");
    return;
  }
  if (path == "/api/v2/workflow_jobs/1/") {
    awxState.wfPoll++;
    if (awxState.abortAfterPoll && awxState.wfPoll > awxState.abortAfterPoll) {
      jobRow.abort_requested = 1; // the user clicks abort in ansibleforms
    }
    const finished = awxState.wfPoll >= 4;
    data = {
      id: 1,
      type: "workflow_job",
      name: "my workflow",
      url: "/api/v2/workflow_jobs/1/",
      status: finished ? awxState.wfFinalStatus : "running",
      finished: finished ? "2026-01-01T10:00:00Z" : null,
      related: { workflow_nodes: "/api/v2/workflow_jobs/1/workflow_nodes/", cancel: "/api/v2/workflow_jobs/1/cancel/" },
    };
  } else if (path == "/api/v2/workflow_jobs/1/workflow_nodes/") {
    data = workflowNodes(parseInt(url.searchParams.get("page") || "1"));
  } else if (path.match(/^\/api\/v2\/jobs\/10[12]\/$/)) {
    const id = parseInt(path.match(/jobs\/(\d+)\//)[1]);
    const s = nodeSummaries()[id - 100];
    data = { id, type: "job", url: path, status: s.status, related: { stdout: `/api/v2/jobs/${id}/stdout/` } };
  } else if (path.match(/^\/api\/v2\/jobs\/10[12]\/stdout\/$/)) {
    const id = parseInt(path.match(/jobs\/(\d+)\//)[1]);
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(`PLAY [node ${id}] ${"*".repeat(40)}\nok: [localhost${id}]`);
    return;
  } else if (path == "/api/v2/jobs/55/") {
    // a regular (non workflow) job, finished on the 2nd poll
    awxState.jobPoll++;
    const finished = awxState.jobPoll >= 2;
    data = {
      id: 55,
      type: "job",
      name: "regular template",
      url: "/api/v2/jobs/55/",
      status: finished ? "successful" : "running",
      finished: finished ? "2026-01-01T10:00:00Z" : null,
      artifacts: { myfact: "myvalue" },
      related: { stdout: "/api/v2/jobs/55/stdout/" },
    };
  } else if (path == "/api/v2/jobs/55/stdout/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(awxState.jobPoll >= 2 ? "line one\nline two" : "line one");
    return;
  }
  if (data) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ detail: "Not found: " + path }));
  }
}

before(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const uri = `http://127.0.0.1:${server.address().port}`;
  // test awx config
  AwxModel.findByName = async () => ({ name: "myawx", uri });
  AwxModel.findByProperty = async () => ({ name: "myawx", uri });
  AwxModel.getAuthorization = () => ({});
});
after(() => {
  // drop keep-alive sockets and the logger file streams, so the test process can exit
  server.closeAllConnections();
  server.close();
  logger.close();
});
beforeEach(resetState);

// the launch response of a workflow job template, as trackJob receives it
function workflowLaunchJob() {
  return {
    id: 1,
    type: "workflow_job",
    url: "/api/v2/workflow_jobs/1/",
    status: "pending",
    related: { workflow_nodes: "/api/v2/workflow_jobs/1/workflow_nodes/", cancel: "/api/v2/workflow_jobs/1/cancel/" },
  };
}

function allOutput() {
  return outputs.map((o) => o.output).join("\n");
}

/*****************************************************************/
/* tests                                                         */
/*****************************************************************/

test("successful workflow job: node outputs, summary and graph json", { timeout: 30000 }, async () => {
  awxState.wfFinalStatus = "successful";
  const result = await Awx.trackJob("myawx", workflowLaunchJob(), 7, 0);
  assert.equal(result, true);
  assert.equal(jobRow.status, "success");
  const out = allOutput();
  // every node banner exactly once, with the output of the child job below it
  assert.equal(out.match(/WORKFLOW NODE \[node one\] \(successful\) \*+/g).length, 1);
  assert.equal(out.match(/WORKFLOW NODE \[node two\] \(successful\) \*+/g).length, 1);
  assert.match(out, /ok: \[localhost101\]/);
  assert.match(out, /ok: \[localhost102\]/);
  // the summary with all the nodes
  assert.match(out, /WORKFLOW \[my workflow\] \(successful\) \*+/);
  assert.match(out, /WORKFLOW NODE \[node three\] \(skipped\)/);
  assert.match(out, /Successfully completed workflow my workflow/);
  // the graph json is stored and holds the final node statuses
  const graph = JSON.parse(jobRow.awx_workflow);
  assert.equal(graph.name, "my workflow");
  assert.equal(graph.status, "successful");
  assert.equal(graph.nodes.length, 3); // pagination followed
  assert.equal(graph.nodes.find((n) => n.id == 1).status, "successful");
  assert.equal(graph.nodes.find((n) => n.id == 1).name, "node one");
  assert.deepEqual(graph.nodes.find((n) => n.id == 1).success_nodes, [2]);
  assert.equal(graph.nodes.find((n) => n.id == 3).status, "skipped");
  // the output order is strictly increasing
  const orders = outputs.map((o) => o.order);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
  assert.equal(new Set(orders).size, orders.length);
});

test("failed workflow job: failed node and failed job status", { timeout: 30000 }, async () => {
  awxState.wfFinalStatus = "failed";
  const result = await Awx.trackJob("myawx", workflowLaunchJob(), 7, 0);
  assert.match(result, /completed with status failed/);
  assert.equal(jobRow.status, "failed");
  const out = allOutput();
  assert.equal(out.match(/WORKFLOW NODE \[node two\] \(failed\) \*+/g).length, 1);
  assert.match(out, /WORKFLOW \[my workflow\] \(failed\) \*+/);
  const graph = JSON.parse(jobRow.awx_workflow);
  assert.equal(graph.status, "failed");
  assert.equal(graph.nodes.find((n) => n.id == 2).status, "failed");
});

test("aborting a workflow job cancels it on the workflow endpoint", { timeout: 30000 }, async () => {
  awxState.abortAfterPoll = 1;
  const result = await Awx.trackJob("myawx", workflowLaunchJob(), 7, 0);
  assert.equal(result, "Aborted workflow job");
  assert.equal(jobRow.status, "aborted");
  assert.deepEqual(cancelCalls, ["/api/v2/workflow_jobs/1/cancel/"]);
  assert.equal(jobRow.abort_requested, 0); // reset after the abort
});

test("regular (non workflow) job tracking is unchanged", { timeout: 30000 }, async () => {
  const launchJob = {
    id: 55,
    type: "job",
    url: "/api/v2/jobs/55/",
    status: "pending",
    related: { stdout: "/api/v2/jobs/55/stdout/" },
  };
  const result = await Awx.trackJob("myawx", launchJob, 8, 0);
  assert.equal(result, true);
  assert.equal(jobRow.status, "success");
  assert.deepEqual(JSON.parse(jobRow.awx_artifacts), { myfact: "myvalue" });
  assert.equal(jobRow.awx_workflow, undefined); // no graph for regular jobs
  const out = allOutput();
  assert.match(out, /line one/);
  assert.match(out, /line two/);
  assert.match(out, /Successfully completed template regular template/);
  // the incremental output must not duplicate lines
  assert.equal(out.match(/line one/g).length, 1);
});

test("abortJob hits the jobs endpoint by default and workflow_jobs for workflows", async () => {
  await Awx.abortJob("myawx", 55);
  await Awx.abortJob("myawx", 1, true);
  assert.deepEqual(cancelCalls, ["/api/v2/jobs/55/cancel/", "/api/v2/workflow_jobs/1/cancel/"]);
});
