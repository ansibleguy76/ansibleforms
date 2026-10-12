// A workflow node's extravars and artifacts, for the job page's node (Show extravars, Show
// artifacts) : the RTE's node is a child job of the workflow job ; an AWX workflow's node is a
// job on that AWX, asked for them.
import { describe, test, expect, vi } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));

const { workflowNodeData } = await import("../src/lib/workflowNodeData.js");
// the masking as the job page gets it : here a mask that changes nothing, checked on its own below
const asIs = async (form, text) => text;

const graph = (nodes) => JSON.stringify({ id: 1, name: "wf", status: "successful", nodes });

describe("a workflow the RTE ran", () => {
  const job = { id: 147, job_type: "workflow", runner: "", awx_workflow: graph([{ id: 1, job: 148 }, { id: 2, job: 149 }, { id: 3, job: null }]) };

  test("its node's child job : extravars and artifacts, read by the child's id under this job", async () => {
    const mysql = { do: vi.fn(async () => [{ extravars: '{"version":"2.4.1"}', awx_artifacts: '{"build_id":42}' }]) };
    const out = await workflowNodeData(job, "2", { mysql, Runner: {}, Awx: {}, mask: asIs });
    expect(out).toEqual({ node: 2, job: 149, extravars: { version: "2.4.1" }, artifacts: { build_id: 42 } });
    // never another job's child
    expect(mysql.do).toHaveBeenCalledWith(expect.stringContaining("parent_id=?"), [149, 147]);
  });

  test("a node not run, or a child that is not this job's : {} both", async () => {
    const mysql = { do: vi.fn(async () => []) };
    expect(await workflowNodeData(job, 3, { mysql, Runner: {}, Awx: {}, mask: asIs })).toEqual({ node: 3, job: null, extravars: {}, artifacts: {} });
    expect(mysql.do).not.toHaveBeenCalled();
    expect(await workflowNodeData(job, 1, { mysql, Runner: {}, Awx: {}, mask: asIs })).toEqual({ node: 1, job: 148, extravars: {}, artifacts: {} });
  });

  test("no such node : not found", async () => {
    await expect(workflowNodeData(job, 9, { mysql: { do: vi.fn() }, Runner: {}, Awx: {}, mask: asIs })).rejects.toThrow(/no workflow node 9/);
  });
});

describe("an AWX workflow", () => {
  const job = { id: 50, job_type: "awx", runner: "awx-prod", awx_workflow: graph([{ id: 7, job: 812, job_url: "/api/v2/jobs/812/" }]) };

  test("its node's AWX job, asked to the runner the job ran on", async () => {
    const runner = { name: "awx-prod", uri: "https://awx.example.com" };
    const Runner = { findByName: vi.fn(async () => runner) };
    const Awx = { getNodeJobData: vi.fn(async () => ({ extravars: { env: "prod" }, artifacts: { ticket: "CHG1" } })) };
    const out = await workflowNodeData(job, 7, { mysql: { do: vi.fn() }, Runner, Awx, mask: asIs });
    expect(Runner.findByName).toHaveBeenCalledWith("awx-prod");
    expect(Awx.getNodeJobData).toHaveBeenCalledWith(runner, expect.objectContaining({ id: 7, job: 812 }));
    expect(out).toEqual({ node: 7, job: 812, extravars: { env: "prod" }, artifacts: { ticket: "CHG1" } });
  });

  test("the runner since removed : not found, said", async () => {
    const Runner = { findByName: vi.fn(async () => null) };
    await expect(workflowNodeData(job, 7, { mysql: { do: vi.fn() }, Runner, Awx: {}, mask: asIs })).rejects.toThrow(/runner 'awx-prod'.*gone/);
  });
});

describe("what a node's extravars may show", () => {
  // the mask the job page's parent goes through : the form's password fields and secret-like keys
  const mask = vi.fn(async (form, text) => text.replace(/"(secret|password|api_token)":"[^"]*"/g, '"$1":"**NOLOG**"'));

  test("the RTE's child job : its extravars masked for the parent's form, as the parent's are", async () => {
    const job = { id: 147, form: "deploy", job_type: "workflow", awx_workflow: graph([{ id: 1, job: 148 }]) };
    const mysql = { do: async () => [{ extravars: '{"version":"2.4.1","password":"Pa55","api_token":"t0k"}', awx_artifacts: "{}" }] };
    const out = await workflowNodeData(job, 1, { mysql, Runner: {}, Awx: {}, mask });
    expect(mask).toHaveBeenCalledWith("deploy", expect.stringContaining('"password":"Pa55"'));
    expect(out.extravars).toEqual({ version: "2.4.1", password: "**NOLOG**", api_token: "**NOLOG**" });
  });

  test("an AWX node's job : the same mask on what AWX returns", async () => {
    const job = { id: 50, form: "deploy", job_type: "awx", runner: "awx-prod", awx_workflow: graph([{ id: 7, job: 812 }]) };
    const Runner = { findByName: async () => ({ name: "awx-prod" }) };
    const Awx = { getNodeJobData: async () => ({ extravars: { env: "prod", secret: "s3" }, artifacts: {} }) };
    const out = await workflowNodeData(job, 7, { mysql: { do: vi.fn() }, Runner, Awx, mask });
    expect(out.extravars).toEqual({ env: "prod", secret: "**NOLOG**" });
  });

  test("the default mask is the job model's : secret-like keys hidden without a form to ask", async () => {
    const job = { id: 1, form: "", job_type: "workflow", awx_workflow: graph([{ id: 1, job: 2 }]) };
    const mysql = { do: async () => [{ extravars: '{"host":"h","db_password":"x"}', awx_artifacts: "{}" }] };
    const out = await workflowNodeData(job, 1, { mysql });
    expect(out.extravars).toEqual({ host: "h", db_password: "**NOLOG**" });
  });
});

describe("an AWX node job's data", async () => {
  const axios = (await import("axios")).default;
  const { Awx } = await import("../src/runners/awx/api.js");
  const runner = { uri: "https://awx.example.com", token: "t" };

  test("its extra_vars (JSON text) and artifacts, from the node's own link", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: { extra_vars: '{"env":"prod"}', artifacts: { ticket: "CHG1" } } });
    expect(await Awx.getNodeJobData(runner, { job: 812, job_url: "/api/v2/jobs/812/" })).toEqual({ extravars: { env: "prod" }, artifacts: { ticket: "CHG1" } });
    expect(get.mock.calls[0][0]).toBe("https://awx.example.com/api/v2/jobs/812/");
    get.mockRestore();
  });

  test("an approval or a project update has neither : {} ; a node not run is not asked", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: { status: "successful" } });
    expect(await Awx.getNodeJobData(runner, { job: 9, job_url: "/api/v2/workflow_approvals/9/" })).toEqual({ extravars: {}, artifacts: {} });
    expect(await Awx.getNodeJobData(runner, { job: null })).toEqual({ extravars: {}, artifacts: {} });
    expect(get).toHaveBeenCalledTimes(1);
    get.mockRestore();
  });
});
