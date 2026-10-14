// The job page links a job on an AWX, AAP or Ascender to its page in that product (issue #1065) :
// the address is built on the server from the runner's uri and flavour.
const { describe, test, expect } = await import("vitest");

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";
process.env.DB_HOST = process.env.DB_HOST || "127.0.0.1";
process.env.DB_PORT = process.env.DB_PORT || "3306";
process.env.DB_USER = process.env.DB_USER || "test";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "test";

const { uiJobUrl, addRunnerJobLinks } = await import("../src/lib/runnerJobLinks.js");

const awx = { type: "awx", uri: "https://awx.example.com", flavour: null };
const ascender = { type: "awx", uri: "https://ascender.example.com/", flavour: "ascender" };
const aap = { type: "awx", uri: "https://aap.example.com/api/controller/v2", flavour: "aap" };

describe("uiJobUrl", () => {
  test("AWX and Ascender use the hash routes", () => {
    expect(uiJobUrl(awx, 12)).toBe("https://awx.example.com/#/jobs/playbook/12/output");
    expect(uiJobUrl(ascender, 7, "workflow")).toBe("https://ascender.example.com/#/jobs/workflow/7/output");
  });

  test("an AAP gateway uses the execution routes, without the API path", () => {
    expect(uiJobUrl(aap, 12)).toBe("https://aap.example.com/execution/jobs/playbook/12/output");
    expect(uiJobUrl(aap, 9, "workflow")).toBe("https://aap.example.com/execution/jobs/workflow/9/output");
  });

  test("a path before the API stays, the API path and the credentials go", () => {
    expect(uiJobUrl({ type: "awx", uri: "https://u:secret@host.example.com/tower/api/v2/" }, 3)).toBe(
      "https://host.example.com/tower/#/jobs/playbook/3/output",
    );
    expect(uiJobUrl({ type: "awx", uri: "http://host.example.com:8052/api" }, 3)).toBe(
      "http://host.example.com:8052/#/jobs/playbook/3/output",
    );
  });

  test("nothing without an awx runner, a numeric id, a known kind or an http uri", () => {
    expect(uiJobUrl({ type: "semaphore", uri: "https://s.example.com" }, 3)).toBe("");
    expect(uiJobUrl(awx, null)).toBe("");
    expect(uiJobUrl(awx, "3/../../admin")).toBe("");
    expect(uiJobUrl(awx, 3, "project_update")).toBe("");
    expect(uiJobUrl({ type: "awx", uri: "javascript:alert(1)" }, 3)).toBe("");
    expect(uiJobUrl({ type: "awx", uri: "not a url" }, 3)).toBe("");
    expect(uiJobUrl(null, 3)).toBe("");
  });
});

describe("addRunnerJobLinks", () => {
  const runners = (map) => ({ findByName: async (name) => map[name] ?? null });

  test("a playbook job gets its address", async () => {
    const job = await addRunnerJobLinks({ id: 1, job_type: "awx", runner: "asc", awx_id: 42, awx_workflow: null }, {
      Runner: runners({ asc: ascender }),
    });
    expect(job.runner_job_url).toBe("https://ascender.example.com/#/jobs/playbook/42/output");
  });

  test("a workflow job gets the workflow address, and each node that ran a job or a workflow its own", async () => {
    const job = await addRunnerJobLinks(
      {
        id: 2,
        job_type: "awx",
        runner: "aap",
        awx_id: 50,
        awx_workflow: {
          name: "wf",
          nodes: [
            { id: 1, type: "job", job: 51 },
            { id: 2, type: "workflow_job", job: 52 },
            { id: 3, type: "workflow_approval", job: 53 },
            { id: 4, type: "job", job: null },
          ],
        },
      },
      { Runner: runners({ aap }) },
    );
    expect(job.runner_job_url).toBe("https://aap.example.com/execution/jobs/workflow/50/output");
    expect(job.awx_workflow.nodes.map((n) => n.ui_url)).toEqual([
      "https://aap.example.com/execution/jobs/playbook/51/output",
      "https://aap.example.com/execution/jobs/workflow/52/output",
      undefined,
      undefined,
    ]);
  });

  test("no links for other jobs, other runners, or a runner that is gone or cannot be read", async () => {
    const plain = await addRunnerJobLinks({ id: 3, job_type: "ansible", runner: "asc", awx_id: 4 }, { Runner: runners({ asc: ascender }) });
    expect(plain.runner_job_url).toBeUndefined();
    const sem = await addRunnerJobLinks(
      { id: 4, job_type: "awx", runner: "sem", awx_id: 4 },
      { Runner: runners({ sem: { type: "semaphore", uri: "https://s.example.com" } }) },
    );
    expect(sem.runner_job_url).toBeUndefined();
    const gone = await addRunnerJobLinks({ id: 5, job_type: "awx", runner: "old", awx_id: 4 }, { Runner: runners({}) });
    expect(gone.runner_job_url).toBeUndefined();
    const broken = await addRunnerJobLinks(
      { id: 6, job_type: "awx", runner: "asc", awx_id: 4 },
      { Runner: { findByName: async () => { throw new Error("db down"); } } },
    );
    expect(broken.runner_job_url).toBeUndefined();
  });
});
