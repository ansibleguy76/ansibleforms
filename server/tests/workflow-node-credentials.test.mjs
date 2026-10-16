// A workflow node's one credential, a REST login typed ssh (the upgrade to 7.0.0 typed every
// credential from 6 so), became ansible's login and never reached the playbook : the node ran
// without it. And the workflow form's credentials ({ ontap: ontap_automation }) reached no node.
import { describe, test, expect, vi } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));

const { credentialRoles, nodeForm } = await import("../src/models/workflowRun.js");
const Credential = (await import("../src/models/credential.model.v2.js")).default;

const types = new Map([
  ["ontap_automation", "userpass"],
  ["linux", "ssh"],
  ["vcenter", "api"],
]);
const cred = (name, kind = "") => ({ name, kind });

describe("a node's credentials", () => {
  test("each one reaches the playbook under its own name, the first ssh one is also the login", () => {
    // a userpass one (a REST login) is not the login
    expect(credentialRoles([cred("ontap_automation")], types)).toEqual({
      ansibleCredentials: "",
      vaultCredentials: "",
      credentials: { ontap_automation: "ontap_automation" },
    });
    // one typed ssh by the upgrade to 7.0.0 still reaches the playbook, and is the login
    expect(credentialRoles([cred("linux")], types)).toEqual({
      ansibleCredentials: "linux",
      vaultCredentials: "",
      credentials: { linux: "linux" },
    });
    expect(credentialRoles([cred("linux"), cred("ontap_automation"), cred("vcenter")], types)).toEqual({
      ansibleCredentials: "linux",
      vaultCredentials: "",
      credentials: { linux: "linux", ontap_automation: "ontap_automation", vcenter: "vcenter" },
    });
  });

  test("a vault one opens the vaults only: its password is not handed to the playbook", () => {
    expect(credentialRoles([cred("vault_pw", "vault"), cred("vcenter")], types)).toEqual({
      ansibleCredentials: "",
      vaultCredentials: "vault_pw",
      credentials: { vcenter: "vcenter" },
    });
  });
});

describe("the workflow form's credentials", () => {
  const wf = { name: "Nas Workflow", nodes: [] };
  const node = { identifier: "provision", name: "provision.yaml", credentials: [cred("vcenter")] };

  test("reach every node, under the names the form gives them", () => {
    const form = nodeForm(wf, { ...node, credentials: [] }, types, "", { ontap: "ontap_automation" });
    expect(form.credentials).toEqual({ ontap: "ontap_automation" });
  });

  test("with the node's own, which win a name both use", () => {
    const form = nodeForm(wf, node, types, "", { ontap: "ontap_automation", vcenter: "other" });
    expect(form.credentials).toEqual({ ontap: "ontap_automation", vcenter: "vcenter" });
  });

  test("none, and none from the node: the form has no credentials", () => {
    expect(nodeForm(wf, { ...node, credentials: [] }, types, "", undefined).credentials).toBeUndefined();
  });
});

describe("a credential's port", () => {
  test("empty is none: a credential without a host saves", () => {
    expect(Credential.normalizePort({ port: "" }).port).toBeNull();
    expect(Credential.normalizePort({ port: "  " }).port).toBeNull();
    expect(Credential.normalizePort({ port: null }).port).toBeNull();
    expect(Credential.normalizePort({}).port).toBeUndefined();
  });

  test("a whole number is kept, anything else is refused", () => {
    expect(Credential.normalizePort({ port: "3306" }).port).toBe(3306);
    expect(Credential.normalizePort({ port: 22 }).port).toBe(22);
    expect(() => Credential.normalizePort({ port: "ssh" })).toThrow(/whole number from 1 to 65535/);
    expect(() => Credential.normalizePort({ port: 70000 })).toThrow(/whole number/);
  });
});
