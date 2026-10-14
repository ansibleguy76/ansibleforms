// A workflow launched on an AWX is known as one from its launch : its graph (empty until the
// tracker's first poll) is stored with its id, so its link (issue #1065) and its abort go to the
// workflow endpoints before that poll.
const { test, expect, beforeEach } = await import("vitest");

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";
process.env.DB_HOST = process.env.DB_HOST || "127.0.0.1";
process.env.DB_PORT = process.env.DB_PORT || "3306";
process.env.DB_USER = process.env.DB_USER || "test";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "test";

const { default: axios } = await import("axios");
const { default: Job } = await import("../src/models/job.model.js");
const { Awx } = await import("../src/runners/awx/api.js");

let updates;
let launchAnswer;
beforeEach(() => {
  updates = [];
  Job.update = async (data, id) => updates.push({ data, id });
  Job.printJobOutput = async () => {};
  Job.endJobStatus = async () => {};
  Awx.findCredentialsByTemplate = async () => [];
  Awx.findInventoryByName = async () => null;
  Awx.findExecutionEnvironmentByName = async () => null;
  Awx.findInstanceGroupByName = async () => null;
  Awx.trackJob = async () => {};
  axios.post = async () => ({ data: launchAnswer });
});

const runner = { type: "awx", uri: "https://awx.example.com", token: "t" };
const launch = (template) => Awx.launchTemplate(runner, template, {}, null, "", "", false, false, 0, {}, [], null, [], "", 99, 0);

test("a workflow template's job is stored with its id and an empty graph", async () => {
  launchAnswer = { id: 70, type: "workflow_job", name: "wf", status: "pending" };
  await launch({ id: 1, name: "wf", related: { launch: "/api/v2/workflow_job_templates/1/launch/" } });
  expect(updates).toHaveLength(1);
  expect(updates[0].id).toBe(99);
  expect(updates[0].data.awx_id).toBe(70);
  expect(JSON.parse(updates[0].data.awx_workflow)).toEqual({ id: 70, name: "wf", status: "pending", nodes: [] });
});

test("a job template's job is stored with its id only", async () => {
  launchAnswer = { id: 71, type: "job", name: "jt", status: "pending" };
  await launch({ id: 2, name: "jt", related: { launch: "/api/v2/job_templates/2/launch/" } });
  expect(updates).toEqual([{ data: { awx_id: 71 }, id: 99 }]);
});
