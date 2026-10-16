// A form names its workflow as it names its playbook : by its file (wf1.yml, team/wf1.yml), or by
// the workflow's name inside it, as before. A form that named the file found nothing, the start
// crashed and the job hung.
import { describe, test, expect, vi, beforeAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));

const root = fs.mkdtempSync(path.join(os.tmpdir(), "af-wf-"));
vi.mock("../src/models/repository.model.js", () => ({ default: { getWorkflowsRoots: async () => [{ repository: null, root }] } }));

const wf = (...names) =>
  `workflow_job_templates:\n${names
    .map((n) => `  - name: ${n}\n    related:\n      workflow_nodes:\n        - identifier: a\n          unified_job_template: { name: a.yaml, type: job_template }\n`)
    .join("")}`;

beforeAll(() => {
  fs.mkdirSync(path.join(root, "team"));
  fs.mkdirSync(path.join(root, "other"));
  fs.writeFileSync(path.join(root, "wf1.yml"), wf("wf1"));
  fs.writeFileSync(path.join(root, "team", "deploy.yml"), wf("deploy"));
  fs.writeFileSync(path.join(root, "team", "both.yml"), wf("first", "second"));
  fs.writeFileSync(path.join(root, "team", "twice.yml"), wf("twice"));
  fs.writeFileSync(path.join(root, "other", "twice.yml"), wf("twice2"));
  fs.writeFileSync(path.join(root, "dup-a.yml"), wf("dup"));
  fs.writeFileSync(path.join(root, "team", "dup-b.yml"), wf("dup"));
  // a workflow whose nodes name credentials : the export's related.credentials, and the collection's
  fs.writeFileSync(
    path.join(root, "team", "creds.yml"),
    "workflow_job_templates:\n  - name: with-creds\n    description: Deploys\n    related:\n      workflow_nodes:\n" +
      "        - identifier: build\n          unified_job_template: { name: a.yaml, type: job_template }\n" +
      "          related: { credentials: [{ name: vault-prod-token }, { name: linux-root, credential_type: { kind: ssh } }] }\n" +
      "        - identifier: deploy\n          unified_job_template: { name: b.yaml, type: job_template }\n          credentials: [{ name: linux-root }]\n",
  );
});

const { findWorkflow, listWorkflows, workflowRef, sharedWorkflowNames, workflowCredentials } = await import("../src/models/workflowRun.js");
const nameOf = async (ref) => (await findWorkflow(ref)).workflow.name;

describe("a form's workflow", () => {
  test("is a file when it ends in .yml or .yaml, else a name", () => {
    expect(workflowRef("wf1.yml")).toEqual({ file: "wf1.yml", name: null });
    expect(workflowRef("./team/deploy.yaml")).toEqual({ file: "team/deploy.yaml", name: null });
    expect(workflowRef(" wf1 ")).toEqual({ file: null, name: "wf1" });
  });

  test("is found by its file, with its folder, or by its file name alone in a subfolder", async () => {
    expect(await nameOf("wf1.yml")).toBe("wf1");
    expect(await nameOf("team/deploy.yml")).toBe("deploy");
    expect(await nameOf("deploy.yml")).toBe("deploy");
  });

  test("is found by its name, as before", async () => {
    expect(await nameOf("wf1")).toBe("wf1");
    expect(await nameOf("deploy")).toBe("deploy");
  });

  test("says why when it cannot be told", async () => {
    await expect(findWorkflow("missing.yml")).rejects.toThrow(/No workflow file 'missing.yml'/);
    await expect(findWorkflow("missing")).rejects.toThrow(/No workflow 'missing'/);
    await expect(findWorkflow("twice.yml")).rejects.toThrow(/is in other\/twice.yml and team\/twice.yml: name it with its folder/);
    await expect(findWorkflow("team/both.yml")).rejects.toThrow(/holds 2 workflows \(first, second\): name the one to run/);
    expect(await nameOf("second")).toBe("second");
  });

  test("a name two files have: said on saving, and named by its file it still runs", async () => {
    expect(await sharedWorkflowNames(wf("dup", "wf1"))).toEqual(["dup"]);
    expect(await sharedWorkflowNames("not: [yaml")).toEqual([]);
    await expect(findWorkflow("dup")).rejects.toThrow(/rename one of them, or name its file/);
    expect(await nameOf("team/dup-b.yml")).toBe("dup");
  });

  test("the designer lists each workflow with its file, folder included", async () => {
    expect(await listWorkflows()).toContainEqual({ name: "deploy", file: "team/deploy.yml" });
  });
});

describe("a form's playbook", async () => {
  const { playbookFile } = await import("../src/rte/ansible-core.js");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "af-pb-"));
  fs.mkdirSync(path.join(dir, "team"));
  fs.writeFileSync(path.join(dir, "deploy.yml"), "- hosts: all\n");
  fs.writeFileSync(path.join(dir, "team", "site.yaml"), "- hosts: all\n");

  test("is its file, with its folder, as it is", () => {
    expect(playbookFile(dir, "deploy.yml")).toBe("deploy.yml");
    expect(playbookFile(dir, "team/site.yaml")).toBe("team/site.yaml");
  });

  test("or its name, the .yml or .yaml file of that name", () => {
    expect(playbookFile(dir, "deploy")).toBe("deploy.yml");
    expect(playbookFile(dir, "team/site")).toBe("team/site.yaml");
  });

  test("a name with no such file goes as it is, for ansible-playbook to say so", () => {
    expect(playbookFile(dir, "missing")).toBe("missing");
  });
});

describe("the credentials a workflow's nodes name, for a credential's Used by tab", () => {
  test("each credential with its file and node ; workflows naming none are left out", async () => {
    const found = await workflowCredentials();
    expect(found.map((w) => w.name)).toEqual(["with-creds"]);
    expect(found[0].description).toBe("Deploys");
    expect(found[0].credentials).toEqual([
      { name: "vault-prod-token", where: "team/creds.yml, node build" },
      { name: "linux-root", where: "team/creds.yml, node build" },
      { name: "linux-root", where: "team/creds.yml, node deploy" },
    ]);
  });
});
