// The job page links a job on an AWX, AAP or Ascender to its page in that product (issue #1065) :
// the address is built on the server from the runner's uri and flavour.
const { describe, test, expect } = await import("vitest");

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";
process.env.DB_HOST = process.env.DB_HOST || "127.0.0.1";
process.env.DB_PORT = process.env.DB_PORT || "3306";
process.env.DB_USER = process.env.DB_USER || "test";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "test";

const { uiJobUrl, toolJobUrl, addRunnerJobLinks, rememberRunnerJobUrl } = await import("../src/lib/runnerJobLinks.js");

// no database in these tests : what would be written is recorded
const writes = [];
const noDb = { do: async (sql, params) => (sql.startsWith("UPDATE") && writes.push(params), []) };

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

  test("an AAP before 2.5 (the controller alone, /api/v2) uses AWX's routes", () => {
    expect(uiJobUrl({ type: "awx", uri: "https://aap24.example.com/api/v2", flavour: "aap" }, 5)).toBe(
      "https://aap24.example.com/#/jobs/playbook/5/output",
    );
    expect(uiJobUrl({ type: "awx", uri: "https://aap24.example.com", flavour: "aap" }, 5)).toBe(
      "https://aap24.example.com/#/jobs/playbook/5/output",
    );
  });

  test("project and inventory updates have their pages", () => {
    expect(uiJobUrl(awx, 8, "project")).toBe("https://awx.example.com/#/jobs/project/8/output");
    expect(uiJobUrl(aap, 8, "inventory")).toBe("https://aap.example.com/execution/jobs/inventory/8/output");
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
    expect(uiJobUrl(awx, 3, "approval")).toBe("");
    expect(uiJobUrl({ type: "awx", uri: "javascript:alert(1)" }, 3)).toBe("");
    expect(uiJobUrl({ type: "awx", uri: "not a url" }, 3)).toBe("");
    expect(uiJobUrl(null, 3)).toBe("");
  });
});

describe("addRunnerJobLinks", () => {
  const runners = (map) => ({ findByName: async (name) => map[name] ?? null });

  test("a playbook job gets its address", async () => {
    const job = await addRunnerJobLinks({ id: 1, job_type: "awx", runner: "asc", awx_id: 42, awx_workflow: null }, {
      db: noDb, Runner: runners({ asc: ascender }),
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
            { id: 5, type: "project_update", job: 54 },
          ],
        },
      },
      { db: noDb, Runner: runners({ aap }) },
    );
    expect(job.runner_job_url).toBe("https://aap.example.com/execution/jobs/workflow/50/output");
    expect(job.awx_workflow.nodes.map((n) => n.ui_url)).toEqual([
      "https://aap.example.com/execution/jobs/playbook/51/output",
      "https://aap.example.com/execution/jobs/workflow/52/output",
      undefined,
      undefined,
      "https://aap.example.com/execution/jobs/project/54/output",
    ]);
  });

  test("a workflow just launched (its graph still empty) gets the workflow address", async () => {
    const job = await addRunnerJobLinks(
      { id: 7, job_type: "awx", runner: "asc", awx_id: 60, awx_workflow: { id: 60, name: "wf", nodes: [] } },
      { db: noDb, Runner: runners({ asc: ascender }) },
    );
    expect(job.runner_job_url).toBe("https://ascender.example.com/#/jobs/workflow/60/output");
  });

  test("no links for other jobs, other runners, or a runner that is gone or cannot be read", async () => {
    const plain = await addRunnerJobLinks({ id: 3, job_type: "ansible", runner: "asc", awx_id: 4 }, { db: noDb, Runner: runners({ asc: ascender }) });
    expect(plain.runner_job_url).toBeUndefined();
    // a Semaphore without its project : no page to point at
    const sem = await addRunnerJobLinks(
      { id: 4, job_type: "awx", runner: "sem", awx_id: 4 },
      { db: noDb, Runner: runners({ sem: { type: "semaphore", uri: "https://s.example.com" } }) },
    );
    expect(sem.runner_job_url).toBeUndefined();
    const gone = await addRunnerJobLinks({ id: 5, job_type: "awx", runner: "old", awx_id: 4 }, { db: noDb, Runner: runners({}) });
    expect(gone.runner_job_url).toBeUndefined();
    const broken = await addRunnerJobLinks(
      { id: 6, job_type: "awx", runner: "asc", awx_id: 4 },
      { db: noDb, Runner: { findByName: async () => { throw new Error("db down"); } } },
    );
    expect(broken.runner_job_url).toBeUndefined();
  });

  test("a Jenkins, Semaphore or Rundeck job gets its build's, task's or execution's page", async () => {
    const map = {
      jen: { type: "jenkins", uri: "https://jenkins.example.com/ci/", project: "ops" },
      sem: { type: "semaphore", uri: "https://semaphore.example.com/api", project: "3" },
      run: { type: "rundeck", uri: "https://rundeck.example.com:4440", project: "My Project" },
    };
    const jen = await addRunnerJobLinks(
      { id: 7, job_type: "awx", runner: "jen", awx_id: 12, extravars: JSON.stringify({ __template__: "web/deploy" }) },
      { db: noDb, Runner: runners(map) },
    );
    expect(jen.runner_job_url).toBe("https://jenkins.example.com/ci/job/ops/job/web/job/deploy/12/console");
    const sem = await addRunnerJobLinks({ id: 8, job_type: "awx", runner: "sem", awx_id: 42, extravars: {} }, { db: noDb, Runner: runners(map) });
    expect(sem.runner_job_url).toBe("https://semaphore.example.com/project/3/history?t=42");
    const run = await addRunnerJobLinks({ id: 9, job_type: "awx", runner: "run", awx_id: 5 }, { db: noDb, Runner: runners(map) });
    expect(run.runner_job_url).toBe("https://rundeck.example.com:4440/project/My%20Project/execution/show/5");
  });
});

describe("toolJobUrl", () => {
  test("nothing without a numeric id, an http uri, a Jenkins job or a project", () => {
    expect(toolJobUrl({ type: "jenkins", uri: "https://j.example.com" }, "x", "a")).toBe("");
    expect(toolJobUrl({ type: "jenkins", uri: "ftp://j.example.com" }, 1, "a")).toBe("");
    expect(toolJobUrl({ type: "jenkins", uri: "https://j.example.com" }, 1, "")).toBe("");
    expect(toolJobUrl({ type: "rundeck", uri: "https://r.example.com" }, 1)).toBe("");
    expect(toolJobUrl({ type: "awx", uri: "https://a.example.com", project: "p" }, 1)).toBe("");
  });
  test("a Jenkins job at the root, without the runner's folder", () => {
    expect(toolJobUrl({ type: "jenkins", uri: "https://j.example.com" }, 2, "always-fails")).toBe("https://j.example.com/job/always-fails/2/console");
  });
});

describe("the address kept on the job", () => {
  const runners = (map) => ({ findByName: async (name) => map[name] ?? null });

  test("kept, it is the link even with the runner gone ; a workflow's nodes take its product's routes", async () => {
    const job = await addRunnerJobLinks(
      {
        id: 20,
        job_type: "awx",
        runner: "awx-prod",
        awx_id: 4852,
        runner_job_url: "https://awx.example.com/#/jobs/workflow/4852/output",
        awx_workflow: { nodes: [{ type: "job", job: 4853 }, { type: "workflow_approval", job: 4854 }] },
      },
      { db: noDb, Runner: runners({}) },
    );
    expect(job.runner_job_url).toBe("https://awx.example.com/#/jobs/workflow/4852/output");
    expect(job.awx_workflow.nodes[0].ui_url).toBe("https://awx.example.com/#/jobs/playbook/4853/output");
    expect(job.awx_workflow.nodes[1].ui_url).toBeUndefined();
  });

  test("built from the runner and not kept yet, it is kept", async () => {
    writes.length = 0;
    await addRunnerJobLinks({ id: 21, job_type: "awx", runner: "asc", awx_id: 9 }, { db: noDb, Runner: runners({ asc: ascender }) });
    await new Promise((r) => setTimeout(r, 0));
    expect(writes).toEqual([["https://ascender.example.com/#/jobs/playbook/9/output", 21]]);
  });

  test("at the launch : kept once, never over one already kept", async () => {
    const row = { id: 30, job_type: "awx", runner: "jen", awx_id: 3, extravars: '{"__template__":"build"}', runner_job_url: null };
    const db = {
      calls: [],
      do: async function (sql, params) {
        this.calls.push(sql.split(" ")[0]);
        return sql.startsWith("SELECT") ? [row] : [];
      },
    };
    const map = { jen: { type: "jenkins", uri: "https://jenkins.example.com" } };
    expect(await rememberRunnerJobUrl(30, { db, Runner: runners(map) })).toBe("https://jenkins.example.com/job/build/3/console");
    expect(db.calls).toEqual(["SELECT", "UPDATE"]);
    row.runner_job_url = "https://kept.example.com/x";
    db.calls = [];
    expect(await rememberRunnerJobUrl(30, { db, Runner: runners(map) })).toBe("https://kept.example.com/x");
    expect(db.calls).toEqual(["SELECT"]);
  });
});

