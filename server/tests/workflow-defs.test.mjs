// A workflow as the RTE engine runs it (lib/workflowDefs.js) : both AWX shapes read alike, what
// AWX refuses found, and AWX's scheduling rules - parents, convergence, do not run, and when a
// workflow failed.
import { describe, test, expect } from "vitest";
import { workflowsOf, workflowErrors, nextStep, workflowFailed, varsOf } from "../src/lib/workflowDefs.js";

const EXPORT = `
workflow_job_templates:
  - name: deploy
    extra_vars: "---\\nenv: prod\\n"
    related:
      workflow_nodes:
        - identifier: build
          unified_job_template: { name: build.yaml, type: job_template }
          inventory: { name: production }
          limit: web
          related:
            credentials:
              - name: ssh-prod
              - name: vault-prod
                credential_type: { name: Vault, kind: vault }
            success_nodes: [{ identifier: deploy }]
            failure_nodes: [{ identifier: notify }]
        - identifier: deploy
          unified_job_template: { name: deploy.yaml, type: job_template }
          related: { always_nodes: [{ identifier: notify }] }
        - identifier: notify
          unified_job_template: { name: notify.yaml, type: job_template }
`;

const COLLECTION = `
workflow_job_templates:
  - name: deploy
    workflow_nodes:
      - identifier: build
        unified_job_template: { name: build.yaml, type: job_template }
        inventory: production
        credentials: [ssh-prod]
        related: { success_nodes: [{ identifier: deploy }] }
      - identifier: deploy
        unified_job_template: { name: deploy.yaml, type: job_template }
`;

/** A state where each node has the status given (pending when not given). */
function stateOf(nodes, statuses = {}) {
  return new Map(nodes.map((n) => [n.identifier, { status: statuses[n.identifier] || "pending", doNotRun: false }]));
}

describe("reading a workflow", () => {
  test("the export's shape", () => {
    const [wf] = workflowsOf(EXPORT);
    expect(wf.name).toBe("deploy");
    expect(varsOf(wf.extra_vars)).toEqual({ env: "prod" });
    expect(wf.nodes[0]).toMatchObject({
      identifier: "build",
      type: "job_template",
      name: "build.yaml",
      inventory: "production",
      limit: "web",
      success: ["deploy"],
      failure: ["notify"],
    });
    expect(wf.nodes[0].credentials).toEqual([
      { name: "ssh-prod", kind: "" },
      { name: "vault-prod", kind: "vault" },
    ]);
    expect(workflowErrors(wf)).toEqual([]);
  });

  test("the collection's shape reads alike", () => {
    const [wf] = workflowsOf(COLLECTION);
    expect(wf.nodes[0]).toMatchObject({ inventory: "production", credentials: [{ name: "ssh-prod", kind: "" }], success: ["deploy"] });
  });

  test("what AWX refuses", () => {
    const [wf] = workflowsOf(`
workflow_job_templates:
  - name: w
    workflow_nodes:
      - { identifier: a, unified_job_template: { name: x, type: inventory_source }, related: { success_nodes: [{ identifier: b }] } }
      - { identifier: b, unified_job_template: { name: x.yaml, type: job_template }, related: { success_nodes: [{ identifier: a }, { identifier: nowhere }] } }
`);
    const errors = workflowErrors(wf).join("\n");
    expect(errors).toMatch(/runs 'inventory_source'/);
    expect(errors).toMatch(/links to 'nowhere'/);
    expect(errors).toMatch(/loop/);
  });
});

describe("AWX's scheduling rules", () => {
  const [wf] = workflowsOf(EXPORT);
  const nodes = wf.nodes;

  test("the nodes without a parent start first", () => {
    expect(nextStep(nodes, stateOf(nodes))).toEqual({ start: ["build"], skip: [] });
  });

  test("a success fires its success links ; the failure path will never run", () => {
    const step = nextStep(nodes, stateOf(nodes, { build: "successful" }));
    expect(step).toEqual({ start: ["deploy"], skip: [] });
    // notify waits : deploy's always link may still fire it
    const s = stateOf(nodes, { build: "successful", deploy: "failed" });
    expect(nextStep(nodes, s).start).toEqual(["notify"]);
  });

  test("a failure fires its failure links, and what ran on success will not run", () => {
    const s = stateOf(nodes, { build: "failed" });
    expect(nextStep(nodes, s)).toEqual({ start: ["notify"], skip: ["deploy"] });
  });

  test("all parents must converge : every link into it must fire", () => {
    const conv = nodes.map((n) => (n.identifier === "notify" ? { ...n, converge: true } : n));
    // build failed : its failure link fires, but deploy never runs - its always link never will
    const s = stateOf(conv, { build: "failed" });
    s.get("deploy").doNotRun = true;
    expect(nextStep(conv, s)).toEqual({ start: [], skip: ["notify"] });
  });

  test("a canceled node fires nothing", () => {
    const s = stateOf(nodes, { build: "canceled" });
    expect(nextStep(nodes, s)).toEqual({ start: [], skip: ["deploy"] });
    // a step later : deploy will never run, so neither will what only it could fire
    s.get("deploy").doNotRun = true;
    expect(nextStep(nodes, s)).toEqual({ start: [], skip: ["notify"] });
  });

  test("a workflow fails when a node failed with nothing to handle it", () => {
    expect(workflowFailed(nodes, stateOf(nodes, { build: "failed", notify: "successful" }))).toBe(false);
    expect(workflowFailed(nodes, stateOf(nodes, { build: "successful", deploy: "successful", notify: "failed" }))).toBe(true);
    expect(workflowFailed(nodes, stateOf(nodes, { build: "successful", deploy: "failed", notify: "successful" }))).toBe(false);
  });
});
