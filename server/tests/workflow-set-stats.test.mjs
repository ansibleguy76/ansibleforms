// What a workflow node's playbook gathers with set_stats (its job's artifacts) goes to the nodes
// after it, AWX's way : from the parents whose link fired, a node's own over what came to it,
// over the node's extra_data and under the workflow's extra_vars and the form's values. On the
// RTE, a callback plugin writes it to a file the job then stores.
import { describe, test, expect, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));

const { ancestorArtifacts, workflowsOf } = await import("../src/lib/workflowDefs.js");
const { nodeExtravars } = await import("../src/models/workflowRun.js");
const { artifactsEnv, takeArtifacts } = await import("../src/rte/ansible-core.js");

const WF = `
workflow_job_templates:
  - name: release
    extra_vars: "---\\nenv: prod\\n"
    related:
      workflow_nodes:
        - identifier: build
          unified_job_template: { name: build.yaml, type: job_template }
          related: { success_nodes: [{ identifier: deploy }], failure_nodes: [{ identifier: notify }] }
        - identifier: test
          unified_job_template: { name: test.yaml, type: job_template }
          related: { success_nodes: [{ identifier: deploy }] }
        - identifier: deploy
          unified_job_template: { name: deploy.yaml, type: job_template }
          all_parents_must_converge: true
        - identifier: notify
          unified_job_template: { name: notify.yaml, type: job_template }
`;
const nodes = workflowsOf(WF)[0].nodes;
const stateOf = (entries) =>
  new Map(nodes.map((n) => [n.identifier, { status: "pending", doNotRun: false, artifacts: {}, ...(entries[n.identifier] || {}) }]));

describe("the artifacts a node gets", () => {
  test("from every parent whose link fired, merged in the order the parents are written", () => {
    const state = stateOf({
      build: { status: "successful", artifacts: { version: "1.2", from: "build" } },
      test: { status: "successful", artifacts: { coverage: 91, from: "test" } },
    });
    expect(ancestorArtifacts(nodes, state, "deploy")).toEqual({ version: "1.2", coverage: 91, from: "test" });
  });

  test("not from a parent whose link did not fire : a failure link after a success", () => {
    const state = stateOf({ build: { status: "successful", artifacts: { version: "1.2" } } });
    expect(ancestorArtifacts(nodes, state, "notify")).toEqual({});
    state.get("build").status = "failed";
    expect(ancestorArtifacts(nodes, state, "notify")).toEqual({ version: "1.2" });
  });

  test("a node without parents gets none", () => {
    expect(ancestorArtifacts(nodes, stateOf({}), "build")).toEqual({});
  });
});

describe("where they sit in a node's extravars", () => {
  const wf = { extra_vars: { env: "prod", version: "from-workflow" } };
  const node = { identifier: "deploy", extra_data: { version: "from-node", region: "eu", note: "node" } };

  test("over the node's extra_data, under the workflow's extra_vars and the form's values", () => {
    const artifacts = { version: "1.2", region: "us", build_id: 7 };
    expect(nodeExtravars({ note: "form" }, { extra_vars: {} }, node, artifacts)).toEqual({ version: "1.2", region: "us", note: "form", build_id: 7 });
    expect(nodeExtravars({}, wf, node, artifacts)).toEqual({ version: "from-workflow", region: "us", note: "node", build_id: 7, env: "prod" });
  });

  test("none : as before", () => {
    expect(nodeExtravars({ a: 1 }, { extra_vars: {} }, { extra_data: { b: 2 } })).toEqual({ a: 1, b: 2 });
  });
});

describe("the RTE's artifacts plugin", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "af-artifacts-"));

  test("the plugin's folder first, then the folders the environment names", () => {
    const env = artifactsEnv({ PATH: "/bin", ANSIBLE_CALLBACK_PLUGINS: "/opt/cb:/srv/cb" }, tmp, "/tmp/a.json");
    const paths = env.ANSIBLE_CALLBACK_PLUGINS.split(":");
    expect(paths[0]).toMatch(/src[/\\]rte[/\\]callback_plugins$/);
    expect(paths.slice(1)).toEqual(["/opt/cb", "/srv/cb"]);
    expect(env.AF_ARTIFACTS_FILE).toBe("/tmp/a.json");
    expect(env.PATH).toBe("/bin");
  });

  test("the folders the playbook folder's ansible.cfg names are kept, relative ones resolved", () => {
    fs.writeFileSync(path.join(tmp, "ansible.cfg"), "[defaults]\ncallback_result_format = yaml\ncallback_plugins = ./my_callbacks:/abs/cb\n");
    const env = artifactsEnv({ HOME: tmp }, tmp, "/tmp/a.json");
    expect(env.ANSIBLE_CALLBACK_PLUGINS.split(":").slice(1)).toEqual([path.join(tmp, "my_callbacks"), "/abs/cb"]);
    fs.unlinkSync(path.join(tmp, "ansible.cfg"));
  });

  test("an ansible.cfg that names none : ansible's own folders after the plugin's", () => {
    fs.writeFileSync(path.join(tmp, "ansible.cfg"), "[defaults]\ncallback_result_format = yaml\n");
    const env = artifactsEnv({ HOME: tmp }, tmp, "/tmp/a.json");
    expect(env.ANSIBLE_CALLBACK_PLUGINS.split(":").slice(1)).toEqual(["~/.ansible/plugins/callback", "/usr/share/ansible/plugins/callback"]);
    fs.unlinkSync(path.join(tmp, "ansible.cfg"));
  });

  test("the file read and removed ; none, or not a map, is {}", () => {
    const file = path.join(tmp, "a.json");
    fs.writeFileSync(file, JSON.stringify({ version: "1.2", hosts: ["a", "b"] }));
    expect(takeArtifacts(file)).toEqual({ version: "1.2", hosts: ["a", "b"] });
    expect(fs.existsSync(file)).toBe(false);
    expect(takeArtifacts(file)).toEqual({});
    fs.writeFileSync(file, "[1,2]");
    expect(takeArtifacts(file)).toEqual({});
    fs.writeFileSync(file, "{broken");
    expect(takeArtifacts(file)).toEqual({});
    expect(takeArtifacts(undefined)).toEqual({});
  });
});
