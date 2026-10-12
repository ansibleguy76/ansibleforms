// What a workflow node can do since multistep is to go (models/workflowRun.js) : run a template or
// job on a runner (runner: <name>), run only on a condition (if_extra_var), get one key of the
// extravars (extra_vars_key) - each as a multistep's step - and a skipped node lets what follows
// it run, as a success.
import { describe, test, expect, vi } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));

const { workflowsOf, nextStep, workflowFailed } = await import("../src/lib/workflowDefs.js");
const { nodeForm, nodeExtravars, nodeRuns } = await import("../src/models/workflowRun.js");

const FILE = `
workflow_job_templates:
  - name: mixed
    workflow_nodes:
      - identifier: provision
        unified_job_template: { name: Create VM, type: job_template }
        runner: aap-prod
        inventory: vmware
        limit: web
        credentials: [vcenter]
        verbosity: 2
        related: { success_nodes: [{ identifier: configure }] }
      - identifier: configure
        unified_job_template: { name: configure.yaml, type: job_template }
        if_extra_var: configure
        extra_vars_key: vm
        related: { success_nodes: [{ identifier: notify }] }
      - identifier: notify
        unified_job_template: { name: ops/notify, type: job_template }
        runner: rundeck-ops
        credentials: [smtp]
`;
const [wf] = workflowsOf(FILE);
const node = (id) => wf.nodes.find((n) => n.identifier === id);

describe("a node's own keys are read", () => {
  test("runner, if_extra_var and extra_vars_key", () => {
    expect(node("provision").runner).toBe("aap-prod");
    expect(node("configure").if_extra_var).toBe("configure");
    expect(node("configure").extra_vars_key).toBe("vm");
    expect(node("notify").runner).toBe("rundeck-ops");
  });
});

describe("a node on a runner", () => {
  test("an awx runner's node is an awx form with the template, the inventory and AWX's credentials", () => {
    expect(nodeForm(wf, node("provision"), new Map(), "awx")).toEqual({
      type: "awx", name: "mixed - provision", template: "Create VM", runner: "aap-prod",
      inventory: "vmware", awxCredentials: ["vcenter"], limit: "web", verbose: true,
    });
  });

  test("a rundeck runner's node is a rundeck form with the job, its credentials as a form's", () => {
    expect(nodeForm(wf, node("notify"), new Map(), "rundeck")).toEqual({
      type: "rundeck", name: "mixed - notify", template: "ops/notify", runner: "rundeck-ops", credentials: { smtp: "smtp" },
    });
  });

  test("a node without a runner is a designer playbook on the RTE, as before", () => {
    const f = nodeForm(wf, node("configure"), new Map());
    expect(f.type).toBe("ansible");
    expect(f.playbook).toBe("configure.yaml");
    expect(f.runner).toBeUndefined();
  });

  test("a node naming an RTE runner runs its playbook there", () => {
    const f = nodeForm(wf, { ...node("configure"), runner: "rte-vmware" }, new Map(), "rte");
    expect(f).toMatchObject({ type: "ansible", playbook: "configure.yaml", runner: "rte-vmware" });
  });

  test("a runner of no known type is refused", () => {
    expect(() => nodeForm(wf, node("notify"), new Map(), "")).toThrow(/no runner a node can run on/);
  });
});

describe("a node's condition and its values", () => {
  test("it runs only when its extravar is true, exactly, as a multistep step", () => {
    expect(nodeRuns({ configure: true }, node("configure"))).toBe(true);
    expect(nodeRuns({ configure: "true" }, node("configure"))).toBe(false);
    expect(nodeRuns({}, node("configure"))).toBe(false);
    expect(nodeRuns({}, node("provision"))).toBe(true, "no condition : always");
  });

  test("extra_vars_key gives it that key's value, the user copied in ; the __x__ keys never", () => {
    const parent = { vm: { name: "web1", cpu: 2 }, other: 1, ansibleforms_user: { username: "bob" }, __playbook__: "x" };
    expect(nodeExtravars(parent, wf, node("configure"))).toEqual({ name: "web1", cpu: 2, ansibleforms_user: { username: "bob" } });
  });

  test("without the key in the extravars it gets them all, as a multistep step", () => {
    expect(nodeExtravars({ other: 1 }, wf, node("configure"))).toEqual({ other: 1 });
  });
});

describe("a skipped node", () => {
  const stateOf = (statuses) => new Map(wf.nodes.map((n) => [n.identifier, { status: statuses[n.identifier] || "pending", doNotRun: false }]));

  test("lets what follows it on success run", () => {
    expect(nextStep(wf.nodes, stateOf({ provision: "successful", configure: "skipped" })).start).toEqual(["notify"]);
  });

  test("is no failure of the workflow", () => {
    expect(workflowFailed(wf.nodes, stateOf({ provision: "successful", configure: "skipped", notify: "successful" }))).toBe(false);
  });
});
