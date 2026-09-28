// The MCP tools (src/mcp/tools.js), driven through a real MCP client over the SDK's
// in-memory transport, with the models replaced by fakes.
import { describe, test, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createHandlers, registerTools } from "../src/mcp/tools.js";

const user = { username: "bob", type: "local", roles: ["public"], options: {} };

const volumeForm = {
  name: "Create volume",
  type: "ansible",
  playbook: "volume.yml",
  roles: ["public"],
  fields: [
    { name: "cluster", type: "enum", values: ["c1", "c2"], default: "__auto__", required: true },
    { name: "name", type: "text", required: true, model: "volume.name" },
    { name: "size", type: "number", default: 10, model: "volume.size" },
    { name: "secret", type: "password" },
    { name: "cred", type: "credential", expression: "'cluster_' + '$(cluster)'" },
    { name: "note", type: "local", expression: "'hidden helper'" },
    { name: "notused", type: "text", output: false },
  ],
};

let deps;
beforeEach(() => {
  deps = {
    Form: {
      load: vi.fn(async (roles, name) => {
        if (!name) return { forms: [{ name: "Create volume", description: "Makes a volume", categories: ["Storage"] }] };
        if (name === "Create volume") return { constants: { SITE: "gent" }, forms: [structuredClone(volumeForm)], errors: [], warnings: [] };
        const e = new Error(`Access denied to form ${name}.`);
        e.name = "AccessDeniedError";
        throw e;
      }),
    },
    Job: {
      launch: vi.fn(async () => ({ id: 42 })),
      findById: vi.fn(async () => ({
        id: 42, form: "Create volume", status: "success", start: "s", end: "e", user: "bob",
        job_type: "ansible", parent_id: null, subjobs: "",
        extravars: '{"volume":{"name":"v1"},"password":"**NOLOG**"}',
        credentials: '{"cred":"cluster_c1"}',
        output: "line1\nline2\nline3",
      })),
    },
    Expression: { execute: vi.fn(async () => "x") },
    Query: { findAll: vi.fn(async () => []) },
    resolveFormQuery: vi.fn(),
  };
});

async function connect(u = user) {
  const server = new McpServer({ name: "ansibleforms", version: "test" });
  registerTools(server, createHandlers({ user: u, deps }));
  const client = new Client({ name: "test", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

const call = async (client, name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  return { isError: !!r.isError, text: r.content[0].text, data: r.isError ? null : JSON.parse(r.content[0].text) };
};

describe("MCP tools", () => {
  test("exactly the five tools, and no expression or eval tool", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["get_form", "get_job", "launch_job", "list_forms", "resolve_field"]);
  });

  test("list_forms asks Form.load with the user's roles", async () => {
    const client = await connect();
    const r = await call(client, "list_forms");
    expect(deps.Form.load).toHaveBeenCalledWith(["public"]);
    expect(r.data.forms).toEqual([{ name: "Create volume", description: "Makes a volume", categories: ["Storage"] }]);
  });

  test("get_form normalises aliases and adds dependsOn", async () => {
    const client = await connect();
    const r = await call(client, "get_form", { name: "Create volume" });
    const cred = r.data.fields.find((f) => f.name === "cred");
    expect(cred).toMatchObject({ type: "expression", runLocal: true, asCredential: true, dynamic: true, dependsOn: ["cluster"] });
    expect(r.data.supported).toBe(true);
  });

  test("a form the roles do not grant is a tool error, not a crash", async () => {
    const client = await connect();
    const r = await call(client, "get_form", { name: "Admin only" });
    expect(r.isError).toBe(true);
    expect(r.text).toBe("Access denied to form Admin only.");
  });

  test("resolve_field never returns the internal raw values", async () => {
    const client = await connect();
    const r = await call(client, "resolve_field", { form: "Create volume", values: { secret: "pw" } });
    expect(r.data.missing).toEqual(["cluster", "name"]);
    expect(r.text).not.toContain("_values");
    expect(r.text).not.toContain('"pw"');
  });

  test("launch_job is refused while the form is incomplete", async () => {
    const client = await connect();
    const r = await call(client, "launch_job", { form: "Create volume", values: { cluster: "c1" } });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("missing input for : name");
    expect(deps.Job.launch).not.toHaveBeenCalled();
  });

  test("launch_job sends what the browser would", async () => {
    const client = await connect();
    const r = await call(client, "launch_job", { form: "Create volume", values: { cluster: "c1", name: "v1", secret: "pw", notused: "n" } });
    expect(r.data).toMatchObject({ id: 42, form: "Create volume" });
    const arg = deps.Job.launch.mock.calls[0][0];
    expect(arg).toEqual({
      form: "Create volume",
      user,
      fromClient: true,
      credentials: { cred: "cluster_c1" },
      extravars: {
        cluster: "c1",
        volume: { name: "v1", size: 10 },
        secret: "pw",
        cred: "cluster_c1",
      },
      rawFormData: { cluster: "c1", name: "v1", size: 10, cred: "cluster_c1", note: "hidden helper", notused: "n" },
    });
  });

  test("verbose needs allowVerboseMode", async () => {
    let client = await connect();
    let r = await call(client, "launch_job", { form: "Create volume", values: { cluster: "c1", name: "v1" }, verbose: true });
    expect(r.isError).toBe(true);
    client = await connect({ ...user, options: { allowVerboseMode: true } });
    r = await call(client, "launch_job", { form: "Create volume", values: { cluster: "c1", name: "v1" }, verbose: true });
    expect(r.isError).toBe(false);
    expect(deps.Job.launch.mock.calls[0][0].extravars.__verbose__).toBe(true);
  });

  test("resolving a wizard form without a step points at the steps", async () => {
    deps.Form.load.mockResolvedValueOnce({ forms: [{ name: "W", fields: [], wizard: [{ subform: "step1" }] }] });
    const client = await connect();
    const r = await call(client, "resolve_field", { form: "W" });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("step1");
  });

  test("a wizard form is refused", async () => {
    deps.Form.load.mockResolvedValueOnce({ forms: [{ ...volumeForm, wizard: [{ subform: "step1" }] }] });
    const client = await connect();
    const r = await call(client, "launch_job", { form: "Create volume", values: {} });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("wizard");
  });

  test("get_job reads the masked job, as the user, without credentials", async () => {
    const client = await connect();
    const r = await call(client, "get_job", { id: 42, tail: 2 });
    expect(deps.Job.findById).toHaveBeenCalledWith(user, 42, true, true);
    expect(r.data.extravars).toEqual({ volume: { name: "v1" }, password: "**NOLOG**" });
    expect(r.data.output).toBe("line2\nline3");
    expect(r.text).not.toContain("credentials");
    expect(r.text).not.toContain("cluster_c1");
  });
});
