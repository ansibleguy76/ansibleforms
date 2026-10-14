// The MCP tools (src/mcp/tools.js), driven through a real MCP client over the SDK's
// in-memory transport, with the models replaced by fakes.
import { describe, test, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createHandlers, registerTools } from "../src/mcp/tools.js";

const user = { username: "bob", type: "local", roles: ["default"], options: {} };

const volumeForm = {
  name: "Create volume",
  type: "ansible",
  playbook: "volume.yml",
  roles: ["default"],
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

async function connect(u = user, policy = undefined) {
  const server = new McpServer({ name: "ansibleforms", version: "test" });
  registerTools(server, createHandlers({ user: u, deps, policy }), policy, u);
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
  test("exactly the six tools, and no expression or eval tool", async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["get_form", "get_job", "launch_job", "list_forms", "relaunch_job", "resolve_field"]);
  });

  test("list_forms asks Form.load with the user's roles", async () => {
    const client = await connect();
    const r = await call(client, "list_forms");
    expect(deps.Form.load).toHaveBeenCalledWith(["default"]);
    // not flagged for the chat : enableForChat false
    expect(r.data.forms).toEqual([{ name: "Create volume", description: "Makes a volume", categories: ["Storage"], enableForChat: false }]);
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
      validated: true,
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
    expect(r.data.payload).toEqual(r.data.extravars);
    expect(r.data.output).toBe("line2\nline3");
    expect(r.text).not.toContain("credentials");
    expect(r.text).not.toContain("cluster_c1");
  });

  test("resolve_field on a complete form returns the exact launch payload and its hash", async () => {
    const client = await connect();
    const values = { cluster: "c1", name: "v1", secret: "pw" };
    const r = await call(client, "resolve_field", { form: "Create volume", values });
    expect(r.data.complete).toBe(true);
    expect(r.data.modeledExtravars).toEqual({ cluster: "c1", volume: { name: "v1", size: 10 }, secret: "********", cred: "cluster_c1" });
    expect(r.data.modeledPayload).toEqual(r.data.modeledExtravars);
    expect(r.data.credentials).toEqual({ cred: "cluster_c1" });
    expect(r.data.payloadHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(r.data.formFingerprint).toMatch(/^sha256:/);

    // the same values launch, and the hash they launch with is the one that was shown
    const ok = await call(client, "launch_job", { form: "Create volume", values, expectedPayloadHash: r.data.payloadHash });
    expect(ok.isError).toBe(false);
    expect(ok.data.payloadHash).toBe(r.data.payloadHash);
    expect(deps.Job.launch.mock.calls[0][0].extravars.secret).toBe("pw");
  });

  test("a launch whose payload changed since it was resolved is refused", async () => {
    const client = await connect();
    const r = await call(client, "resolve_field", { form: "Create volume", values: { cluster: "c1", name: "v1" } });
    const res = await client.callTool({ name: "launch_job", arguments: { form: "Create volume", values: { cluster: "c1", name: "v2" }, expectedPayloadHash: r.data.payloadHash } });
    expect(res.isError).toBe(true);
    expect(res.structuredContent).toMatchObject({ code: "payload_mismatch", expectedPayloadHash: r.data.payloadHash });
    expect(deps.Job.launch).not.toHaveBeenCalled();
  });

  test("an incomplete launch carries a structured error", async () => {
    const client = await connect();
    const res = await client.callTool({ name: "launch_job", arguments: { form: "Create volume", values: { cluster: "c9" } } });
    expect(res.isError).toBe(true);
    expect(res.structuredContent).toEqual(expect.objectContaining({
      code: "form_incomplete", missing: ["name"], invalid: ["cluster"], waiting: [],
    }));
  });

  test("access errors carry their code", async () => {
    const client = await connect();
    const res = await client.callTool({ name: "get_form", arguments: { name: "Admin only" } });
    expect(res.structuredContent).toEqual({ code: "access_denied", message: "Access denied to form Admin only." });
  });

  describe("relaunch_job", () => {
    test("previews, then relaunches with the confirmed hash", async () => {
      deps.Job.relaunchWithValues = vi.fn(async ({ preview }) => (preview
        ? { form: "Create volume", extravars: { volume: { name: "v2" }, secret: "********" }, credentials: {}, payloadHash: "sha256:x", warnings: [] }
        : { id: 43, payloadHash: "sha256:x", warnings: [] }));
      const client = await connect();
      const p = await call(client, "relaunch_job", { id: 42, values: { name: "v2" }, preview: true });
      expect(p.data).toMatchObject({ job: 42, modeledExtravars: { volume: { name: "v2" }, secret: "********" }, payloadHash: "sha256:x" });
      expect(p.data.extravars).toBeUndefined();
      const r = await call(client, "relaunch_job", { id: 42, values: { name: "v2" }, expectedPayloadHash: "sha256:x" });
      expect(r.data).toEqual({ id: 43, relaunchOf: 42, payloadHash: "sha256:x", warnings: [] });
      expect(deps.Job.relaunchWithValues.mock.calls[1][0]).toMatchObject({ user, id: 42, values: { name: "v2" }, preview: false, expectedPayloadHash: "sha256:x" });
    });

    test("a refusal of the model keeps its code and details", async () => {
      deps.Job.relaunchWithValues = vi.fn(async () => {
        const e = new Error("Job 42 cannot be relaunched with these values - missing : name");
        e.name = "ValidationError";
        e.code = "form_incomplete";
        e.details = { missing: ["name"] };
        throw e;
      });
      const client = await connect();
      const r = await client.callTool({ name: "relaunch_job", arguments: { id: 42, values: { name: "" } } });
      expect(r.isError).toBe(true);
      expect(r.structuredContent).toEqual({ code: "form_incomplete", message: "Job 42 cannot be relaunched with these values - missing : name", missing: ["name"] });
    });

    test("verbose needs the permission", async () => {
      deps.Job.relaunchWithValues = vi.fn();
      const client = await connect();
      const r = await client.callTool({ name: "relaunch_job", arguments: { id: 42, verbose: true } });
      expect(r.structuredContent.code).toBe("access_denied");
      expect(deps.Job.relaunchWithValues).not.toHaveBeenCalled();
    });
  });

  describe("list rows", () => {
    const vmForm = {
      name: "Create vms",
      type: "ansible",
      playbook: "vms.yml",
      roles: ["default"],
      subforms: [
        { name: "vm", type: "subform", fields: [
          { name: "host", type: "text", required: true, regex: { expression: "^web", description: "web hosts only" } },
          { name: "disks", type: "list", subform: "vmdisk" },
        ] },
        { name: "vmdisk", type: "subform", fields: [
          { name: "path", type: "local", output: true, expression: "'/' + '$(__parent__.__parent__.site)' + '/' + '$(__parent__.host)'" },
          { name: "size", type: "number", required: true },
        ] },
      ],
      fields: [
        { name: "site", type: "text", required: true },
        { name: "vms", type: "list", subform: "vm" },
      ],
    };
    beforeEach(() => {
      deps.Form.load = vi.fn(async () => ({ constants: {}, forms: [structuredClone(vmForm)], errors: [], warnings: [] }));
    });

    test("an agent's plain rows are validated at every level", async () => {
      const client = await connect();
      const r = await client.callTool({ name: "launch_job", arguments: { form: "Create vms",
        values: { site: "gent", vms: [{ host: "db1", disks: [{ size: 10 }] }, { host: "web2", disks: [{}] }] } } });
      expect(r.isError).toBe(true);
      expect(r.structuredContent.rowErrors).toEqual({ vms: [
        { index: 0, invalid: ["host"], validationErrors: { host: [{ type: "regex", description: "web hosts only" }] } },
        { index: 1, invalid: ["disks"], rowErrors: { disks: [{ index: 0, missing: ["size"] }] } },
      ] });
      expect(r.structuredContent.message).toContain("list rows failing : vms[0].host (regex), vms[1].disks[0].size (missing)");
      expect(deps.Job.launch).not.toHaveBeenCalled();
    });

    test("a yaml field with a subform takes a plain object and models it", async () => {
      deps.Form.load = vi.fn(async () => ({ constants: {}, errors: [], warnings: [], forms: [{
        name: "Web", type: "ansible", playbook: "web.yml", roles: ["default"],
        subforms: [{ name: "cfg", type: "subform", fields: [
          { name: "port", type: "number", required: true, maxValue: 9000, model: "listen.port" },
          { name: "host", type: "text", required: true },
        ] }],
        fields: [{ name: "config", type: "yaml", subform: "cfg" }],
      }] }));
      const client = await connect();
      const bad = await client.callTool({ name: "launch_job", arguments: { form: "Web", values: { config: { port: 99999 } } } });
      expect(bad.structuredContent.message).toContain("list rows failing : config.host (missing), config.port (maxValue)");
      const ok = await call(client, "launch_job", { form: "Web", values: { config: { port: 443, host: "web1" } } });
      expect(ok.isError).toBeFalsy();
      expect(deps.Job.launch.mock.calls[0][0].extravars).toEqual({ config: { listen: { port: 443 }, host: "web1" } });
    });

    test("valid nested rows launch with the rows the server built", async () => {
      const client = await connect();
      const r = await call(client, "launch_job", { form: "Create vms",
        values: { site: "gent", vms: [{ host: "web1", disks: [{ size: 10 }, { size: 20 }] }] } });
      expect(r.isError).toBeFalsy();
      expect(deps.Job.launch.mock.calls[0][0].extravars).toEqual({ site: "gent",
        vms: [{ host: "web1", disks: [{ path: "/gent/web1", size: 10 }, { path: "/gent/web1", size: 20 }] }] });
    });
  });

  describe("validation", () => {
    const hostForm = {
      name: "Create host",
      type: "ansible",
      playbook: "host.yml",
      roles: ["default"],
      fields: [
        { name: "host", type: "text", required: true, regex: { expression: "^prod-", description: "Must start with prod-" } },
        { name: "pw", type: "password", label: "Password" },
        { name: "pw2", type: "password", sameAs: "pw" },
      ],
    };
    beforeEach(() => {
      deps.Form.load = vi.fn(async () => ({ constants: {}, forms: [structuredClone(hostForm)], errors: [], warnings: [] }));
    });

    test("resolve_field reports the failing rules with the browser's messages", async () => {
      const client = await connect();
      const r = await call(client, "resolve_field", { form: "Create host", values: { host: "test-1", pw: "a", pw2: "b" } });
      expect(r.data.complete).toBe(false);
      expect(r.data.invalid).toEqual(["host", "pw2"]);
      expect(r.data.validationErrors).toEqual({
        host: [{ type: "regex", description: "Must start with prod-" }],
        pw2: [{ type: "sameAs", description: "Must match the field 'Password'" }],
      });
      expect(r.data.modeledExtravars).toBeUndefined();
      // the password values are nowhere in the answer
      expect(r.text).not.toMatch(/"a"|"b"/);
    });

    test("launch_job refuses a form that fails validation, and says why", async () => {
      const client = await connect();
      const r = await client.callTool({ name: "launch_job", arguments: { form: "Create host", values: { host: "test-1", pw: "a", pw2: "a" } } });
      expect(r.isError).toBe(true);
      expect(r.structuredContent.code).toBe("form_incomplete");
      expect(r.structuredContent.validationErrors).toEqual({ host: [{ type: "regex", description: "Must start with prod-" }] });
      expect(r.structuredContent.message).toContain("validation failed : host (regex: Must start with prod-)");
      expect(deps.Job.launch).not.toHaveBeenCalled();
    });

    test("a valid form launches", async () => {
      const client = await connect();
      const r = await call(client, "launch_job", { form: "Create host", values: { host: "prod-1", pw: "a", pw2: "a" } });
      expect(r.isError).toBeFalsy();
      expect(deps.Job.launch).toHaveBeenCalledTimes(1);
    });
  });

  // the MCP settings (MCP_READ_ONLY, MCP_CHAT_FORMS_ONLY), handed in by the MCP router
  describe("the MCP policy", () => {
    test("read only : no launch_job or relaunch_job tool", async () => {
      const client = await connect(user, { readOnly: true });
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual(["get_form", "get_job", "list_forms", "resolve_field"]);
    });

    test("read only : the handlers refuse a launch too", async () => {
      const handlers = createHandlers({ user, deps, policy: { readOnly: true } });
      await expect(handlers.launchJob({ form: "Create volume", values: {} })).rejects.toMatchObject({ code: "access_denied" });
      await expect(handlers.relaunchJob({ id: 42 })).rejects.toMatchObject({ code: "access_denied" });
      expect(deps.Job.launch).not.toHaveBeenCalled();
    });

    test("chat forms only : a form not offered in the chat is left out of the list", async () => {
      const client = await connect(user, { chatFormsOnly: true });
      const r = await call(client, "list_forms");
      expect(r.data.forms).toEqual([]);
    });

    test("chat forms only : a form not offered in the chat is not found, nor its jobs", async () => {
      const client = await connect(user, { chatFormsOnly: true });
      const form = await client.callTool({ name: "get_form", arguments: { name: "Create volume" } });
      expect(form.structuredContent.code).toBe("not_found");
      const job = await client.callTool({ name: "get_job", arguments: { id: 42 } });
      expect(job.structuredContent.code).toBe("not_found");
    });

    test("chat forms only : a form offered in the chat is there", async () => {
      deps.Form.load.mockImplementation(async (roles, name) => {
        if (!name) return { forms: [{ name: "Create volume", enableForChat: true }] };
        return { constants: {}, forms: [{ ...structuredClone(volumeForm), enableForChat: true }], errors: [], warnings: [] };
      });
      const client = await connect(user, { chatFormsOnly: true });
      expect((await call(client, "list_forms")).data.forms.map((f) => f.name)).toEqual(["Create volume"]);
      expect((await call(client, "get_form", { name: "Create volume" })).isError).toBe(false);
    });
  });
});

// #1069 : planning and scheduling through MCP, on the schedule model, as the role options allow
describe("MCP schedules", () => {
  const planner = { ...user, options: { allowPlannedJobs: true } };
  const manager = { ...user, username: "admin", options: { allowScheduledJobs: true, allowPlannedJobs: true } };
  const later = new Date(Date.now() + 3600e3);
  let rows;
  beforeEach(() => {
    rows = new Map([
      [1, { id: 1, name: "bob's run", form: "Create volume", one_time_run: 1, run_at: "2030-01-01T00:00:00.000Z", owner: JSON.stringify({ username: "bob", type: "local" }), extra_vars: "volume:\n  name: v1\npassword: pw\n", output: "" }],
      [2, { id: 2, name: "nightly", form: "Create volume", one_time_run: 0, cron: "0 22 * * *", owner: null, extra_vars: "size: 5\n", next_run: "2030-01-01T22:00:00.000Z" }],
      [3, { id: 3, name: "eve's run", form: "Create volume", one_time_run: 1, run_at: "2030-01-01T00:00:00.000Z", owner: JSON.stringify({ username: "eve", type: "local" }), extra_vars: "" }],
    ]);
    let next = 10;
    deps.Schedule = {
      plan: vi.fn(async (u, data) => { const id = next++; rows.set(id, { id, ...data, owner: JSON.stringify({ username: u.username, type: u.type }) }); return id; }),
      create: vi.fn(async (data) => { const id = next++; rows.set(id, { id, ...data, owner: null }); return id; }),
      findAll: vi.fn(async () => [...rows.values()]),
      findById: vi.fn(async (id) => { if (!rows.has(Number(id))) { const e = new Error(`No schedule ${id}`); e.name = "NotFoundError"; throw e; } return rows.get(Number(id)); }),
      delete: vi.fn(async (id) => rows.delete(Number(id))),
      // the model's own next run, for a row read alone (the scheduler's zone : not the point here)
      withNextRun: vi.fn((row) => ({ ...row, next_run: row.cron ? "2031-01-01T22:00:00.000Z" : row.run_at && new Date(row.run_at) > new Date() ? row.run_at : null })),
    };
    deps.cron = { addSchedule: vi.fn(), removeSchedule: vi.fn() };
    deps.appTimezone = vi.fn(async () => "Europe/Madrid");
    deps.Job.maskExtravars = vi.fn(async (_form, text) => text.replace(/"password":"[^"]*"/, '"password":"**NOLOG**"'));
  });

  test("the tools come with the role options : none without them, list and plan for a planner, all for a manager", async () => {
    const names = async (u, policy) => (await (await connect(u, policy)).listTools()).tools.map((t) => t.name);
    expect(await names(user)).not.toContain("list_schedules");
    const p = await names(planner);
    expect(p).toEqual(expect.arrayContaining(["plan_job", "list_schedules", "get_schedule", "delete_schedule"]));
    expect(p).not.toContain("create_schedule");
    expect(await names(manager)).toEqual(expect.arrayContaining(["plan_job", "create_schedule", "list_schedules"]));
    // read only : listing stays, nothing that changes
    const ro = await names(manager, { readOnly: true });
    expect(ro).toEqual(expect.arrayContaining(["list_schedules", "get_schedule"]));
    expect(ro).not.toEqual(expect.arrayContaining(["plan_job"]));
    expect(ro.some((n) => ["plan_job", "create_schedule", "delete_schedule"].includes(n))).toBe(false);
  });

  test("plan_job plans Run later as the user, with the resolved values, and answers on both clocks", async () => {
    const client = await connect(planner);
    const runAt = later.toISOString().replace("Z", "+00:00");
    const r = await call(client, "plan_job", { form: "Create volume", values: { cluster: "c1", name: "v1", secret: "pw" }, run_at: runAt, name: "tonight" });
    expect(r.isError).toBe(false);
    const [u, data] = deps.Schedule.plan.mock.calls[0];
    expect(u.username).toBe("bob");
    expect(data).toMatchObject({ name: "tonight", form: "Create volume", one_time_run: true, run_at: later.toISOString() });
    expect(data.extra_vars).toContain("name: v1");
    // the raw values for the launch validation when it fires : never the password
    expect(data.raw_form_data).toMatchObject({ cluster: "c1", name: "v1" });
    expect(data.raw_form_data.secret).toBeUndefined();
    expect(deps.cron.addSchedule).toHaveBeenCalledWith(r.data.id, "tonight", undefined, true, later.toISOString());
    expect(r.data).toMatchObject({ runAt: later.toISOString(), timezone: "Europe/Madrid" });
    expect(r.data.runAtLocal).toMatch(/ Europe\/Madrid$/);
    expect(r.data.payloadHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(deps.Job.launch).not.toHaveBeenCalled();
  });

  test("plan_job refuses a time without a zone, in the past, an incomplete form and a changed payload", async () => {
    const client = await connect(planner);
    const values = { cluster: "c1", name: "v1" };
    const noZone = await client.callTool({ name: "plan_job", arguments: { form: "Create volume", values, run_at: "2030-01-01T22:00:00", name: "x" } });
    expect(noZone.structuredContent.code).toBe("invalid_request");
    const past = await client.callTool({ name: "plan_job", arguments: { form: "Create volume", values, run_at: "2020-01-01T22:00:00Z", name: "x" } });
    expect(past.structuredContent.code).toBe("invalid_request");
    const incomplete = await client.callTool({ name: "plan_job", arguments: { form: "Create volume", values: { cluster: "c1" }, run_at: later.toISOString(), name: "x" } });
    expect(incomplete.structuredContent.code).toBe("form_incomplete");
    const changed = await client.callTool({ name: "plan_job", arguments: { form: "Create volume", values, run_at: later.toISOString(), name: "x", expectedPayloadHash: "0".repeat(64) } });
    expect(changed.structuredContent.code).toBe("payload_mismatch");
    expect(deps.Schedule.plan).not.toHaveBeenCalled();
  });

  test("without allowPlannedJobs, or read only, the handler refuses to plan", async () => {
    await expect(createHandlers({ user, deps }).planJob({ form: "Create volume", values: {}, run_at: later.toISOString(), name: "x" })).rejects.toMatchObject({ code: "access_denied" });
    await expect(createHandlers({ user: planner, deps, policy: { readOnly: true } }).planJob({ form: "Create volume", values: {}, run_at: later.toISOString(), name: "x" })).rejects.toMatchObject({ code: "access_denied" });
  });

  test("create_schedule : recurring or once, through Schedule.create ; a bad cron or both is refused ; only for allowScheduledJobs", async () => {
    const client = await connect(manager);
    const r = await call(client, "create_schedule", { form: "Create volume", name: "weekdays", cron: "0 22 * * 1-5", extraVars: { size: 5 } });
    expect(r.isError).toBe(false);
    expect(deps.Schedule.create).toHaveBeenCalledWith({ name: "weekdays", form: "Create volume", extra_vars: "size: 5\n", cron: "0 22 * * 1-5", one_time_run: false });
    expect(r.data).toMatchObject({ name: "weekdays", planned: false, runsAs: "Schedule Service", cron: "0 22 * * 1-5" });
    expect(r.data.nextRun).toBe("2031-01-01T22:00:00.000Z");
    expect(deps.Schedule.withNextRun).toHaveBeenCalled();
    expect(deps.cron.addSchedule).toHaveBeenCalled();
    const once = await call(client, "create_schedule", { form: "Create volume", name: "once", run_at: later.toISOString() });
    expect(once.data).toMatchObject({ oneTimeRun: true, runAt: later.toISOString() });
    expect((await client.callTool({ name: "create_schedule", arguments: { form: "Create volume", name: "bad", cron: "99 * * * *" } })).structuredContent.code).toBe("invalid_request");
    expect((await client.callTool({ name: "create_schedule", arguments: { form: "Create volume", name: "both", cron: "0 1 * * *", run_at: later.toISOString() } })).structuredContent.code).toBe("invalid_request");
    // a blank cron is none : with no run_at either, refused rather than a schedule that never runs
    expect((await client.callTool({ name: "create_schedule", arguments: { form: "Create volume", name: "blank", cron: "   " } })).structuredContent.code).toBe("invalid_request");
    await expect(createHandlers({ user: planner, deps }).createSchedule({ form: "Create volume", name: "x", cron: "0 1 * * *" })).rejects.toMatchObject({ code: "access_denied" });
  });

  test("a planner lists, reads and cancels their own runs only ; a manager sees all", async () => {
    const mine = await call(await connect(planner), "list_schedules");
    expect(mine.data.scope).toBe("mine");
    expect(mine.data.schedules.map((s) => s.id)).toEqual([1]);
    expect(mine.data.schedules[0]).toMatchObject({ planned: true, runsAs: "bob" });
    expect((await call(await connect(manager), "list_schedules")).data.schedules.map((s) => s.id)).toEqual([1, 2, 3]);

    const client = await connect(planner);
    const got = await call(client, "get_schedule", { id: 1 });
    expect(got.data.extravars).toEqual({ volume: { name: "v1" }, password: "**NOLOG**" });
    for (const id of [2, 3, 99]) {
      expect((await client.callTool({ name: "get_schedule", arguments: { id } })).structuredContent.code).toBe("not_found");
      expect((await client.callTool({ name: "delete_schedule", arguments: { id } })).structuredContent.code).toBe("not_found");
    }
    expect(deps.Schedule.delete).not.toHaveBeenCalled();
    const del = await call(client, "delete_schedule", { id: 1 });
    expect(del.data).toMatchObject({ id: 1, deleted: true });
    expect(deps.cron.removeSchedule).toHaveBeenCalledWith(1);
  });

  test("chat forms only : the schedules of a form MCP does not offer are left out", async () => {
    const r = await call(await connect(manager, { chatFormsOnly: true }), "list_schedules");
    expect(r.data.schedules).toEqual([]);
  });

  test("a date that does not exist is refused, an offset without a colon is read", async () => {
    const h = createHandlers({ user: planner, deps });
    const values = { cluster: "c1", name: "v1" };
    for (const runAt of ["2031-02-30T10:00:00Z", "2031-01-10T24:00:00Z", "2031-01-10T10:60:00Z"]) {
      await expect(h.planJob({ form: "Create volume", values, run_at: runAt, name: "x" })).rejects.toMatchObject({ code: "invalid_request" });
    }
    const r = await h.planJob({ form: "Create volume", values, run_at: "2031-01-10T10:00:00+0530", name: "india" });
    expect(r.runAt).toBe("2031-01-10T04:30:00.000Z");
  });

  test("a name already taken is a conflict, not an internal error", async () => {
    deps.Schedule.plan.mockRejectedValueOnce(Object.assign(new Error("Duplicate entry 'tonight' for key 'uk_schedule_natural_key'"), { code: "ER_DUP_ENTRY" }));
    const r = await (await connect(planner)).callTool({ name: "plan_job", arguments: { form: "Create volume", values: { cluster: "c1", name: "v1" }, run_at: later.toISOString(), name: "tonight" } });
    expect(r.structuredContent).toMatchObject({ code: "conflict", name: "tonight" });
  });

  test("a run planned by an ldap bob is not the local bob's", async () => {
    rows.set(4, { id: 4, name: "ldap bob", form: "Create volume", one_time_run: 1, owner: JSON.stringify({ username: "bob", type: "ldap" }), extra_vars: "" });
    const h = createHandlers({ user: planner, deps });
    expect((await h.listSchedules({})).schedules.map((x) => x.id)).toEqual([1]);
    await expect(h.getSchedule({ id: 4 })).rejects.toMatchObject({ code: "not_found" });
    await expect(h.deleteSchedule({ id: 4 })).rejects.toMatchObject({ code: "not_found" });
  });

  test("the handlers refuse too : read only, no option, a form MCP does not offer", async () => {
    const ro = createHandlers({ user: manager, deps, policy: { readOnly: true } });
    await expect(ro.createSchedule({ form: "Create volume", name: "x", cron: "0 1 * * *" })).rejects.toMatchObject({ code: "access_denied" });
    await expect(ro.deleteSchedule({ id: 1 })).rejects.toMatchObject({ code: "access_denied" });
    const none = createHandlers({ user, deps });
    for (const call of [() => none.listSchedules({}), () => none.getSchedule({ id: 1 }), () => none.deleteSchedule({ id: 1 })]) {
      await expect(call()).rejects.toMatchObject({ code: "access_denied" });
    }
    const chat = createHandlers({ user: manager, deps, policy: { chatFormsOnly: true } });
    await expect(chat.getSchedule({ id: 2 })).rejects.toMatchObject({ code: "not_found" });
    await expect(chat.deleteSchedule({ id: 2 })).rejects.toMatchObject({ code: "not_found" });
    expect(deps.Schedule.delete).not.toHaveBeenCalled();
  });
});
