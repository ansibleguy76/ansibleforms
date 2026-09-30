// The chat assistant's contracts, ported from the msaf-chat prototype's tests : the model
// has no launch tool, a target must come from the operator, a summary launches exactly its
// payload once and only from the operator's click, a claimed launch that never happened is
// replaced, and the limits hold. The chat service and the MCP handlers are the real ones ;
// the models are fakes and the model is scripted.
import { describe, test, expect, vi, beforeEach } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));

const { createChatService } = await import("../src/chat/service.js");
const { clearSessions } = await import("../src/chat/sessions.js");
const { clearPlans } = await import("../src/chat/plans.js");
const { TOOLS } = await import("../src/chat/tools.js");

const user = { username: "alice", type: "local", roles: ["public"], options: { allowJobRelaunch: true } };
const other = { username: "bob", type: "local", roles: ["public"], options: {} };

const FORMS = {
  "Create a snapshot": {
    name: "Create a snapshot", type: "ansible", playbook: "snap.yml", roles: ["public"], enableForChat: true, chatRisk: "change",
    description: "Take a snapshot of volumes",
    fields: [
      { name: "cluster", type: "enum", values: ["bb8", "r2d2"], default: "__auto__", required: true, label: "Cluster" },
      { name: "svm", type: "enum", runLocal: true, expression: "({bb8:['svm_test','svm_prod'], r2d2:['svm_x']})['$(cluster)']", required: true, label: "SVM" },
      { name: "snapshot_name", type: "text", required: true, label: "Snapshot name", regex: { expression: "^[a-z_]+$", description: "lowercase" } },
      { name: "api_token", type: "text", default: "t0k3n" },
      { name: "ticket", type: "expression", expression: "fn.fnTicket()" },
      { name: "add_expiry", type: "checkbox", label: "Add expiry" },
      { name: "expiry", type: "text", dependencies: [{ name: "add_expiry", values: [true] }] },
    ],
  },
  "Health report": {
    name: "Health report", type: "ansible", playbook: "health.yml", roles: ["public"], enableForChat: true, chatRisk: "read",
    description: "Report the health of the clusters",
    fields: [{ name: "scope", type: "text", default: "all" }],
  },
  "Delete everything": {
    name: "Delete everything", type: "ansible", playbook: "rm.yml", roles: ["public"],
    fields: [{ name: "target", type: "text", required: true }],
  },
};

let deps, model, ticket;
function scripted(results) {
  const m = { calls: 0, toolNames: [], histories: [] };
  m.complete = vi.fn(async ({ tools, history }) => {
    m.calls++;
    m.toolNames = tools.map((t) => t.name);
    m.histories.push(structuredClone(history));
    return results.length ? results.shift() : { text: "ok", toolCalls: [] };
  });
  return m;
}
const say = (text) => ({ text, toolCalls: [] });
let n = 0;
const call = (name, args) => ({ text: "", toolCalls: [{ id: `c${++n}`, name, arguments: args }] });

function service(results, settings = {}) {
  model = scripted(results);
  return createChatService({
    deps,
    complete: model.complete,
    loadSettings: async () => ({ provider: "anthropic", api_key: "k", model: "m", max_turns: 20, max_tool_rounds: 6, allow_job_status: 1, ...settings }),
    audit: vi.fn(),
    enabled: () => true,
  });
}

beforeEach(() => {
  clearSessions();
  clearPlans();
  ticket = "T-1";
  deps = {
    Form: {
      load: vi.fn(async (roles, name) => {
        if (!name) return { forms: Object.values(FORMS).map((f) => structuredClone(f)) };
        if (!FORMS[name]) { const e = new Error(`No form ${name}`); e.name = "NotFoundError"; throw e; }
        return { constants: {}, forms: [structuredClone(FORMS[name])], errors: [], warnings: [] };
      }),
    },
    Job: {
      launch: vi.fn(async () => ({ id: 77 })),
      findById: vi.fn(async () => ({ id: 42, form: "Create a snapshot", status: "success", start: "s", end: "e", user: "alice", extravars: "{\"secret\":\"x\"}", output: "line" })),
      relaunchWithValues: vi.fn(async ({ preview }) => (preview
        ? { form: "Create a snapshot", extravars: { snapshot: "old", password: "********" }, credentials: {}, payloadHash: "sha256:r", warnings: [] }
        : { id: 88, payloadHash: "sha256:r", warnings: [] })),
    },
    Expression: { execute: vi.fn(async () => ticket) },
    Query: { findAll: vi.fn(async () => []) },
    resolveFormQuery: vi.fn(),
  };
});

const allToolText = (history) => history.filter((m) => m.role === "tool").map((m) => m.text).join("\n");

describe("the model cannot launch", () => {
  test("its tools are catalog, resolve, plan, relaunch and job - no launch, no execute", () => {
    expect(TOOLS.map((t) => t.name)).toEqual(["catalog", "resolve", "plan", "relaunch", "job"]);
  });

  test("a tool it invents never reaches AnsibleForms", async () => {
    const chat = service([call("launch_job", { form: "Create a snapshot" }), call("execute", {}), say("I cannot launch it.")]);
    const { sessionId } = await chat.openSession(user);
    const out = await chat.message(user, { sessionId, message: "launch it" });
    expect(out.reply).toBe("I cannot launch it.");
    expect(model.toolNames).toEqual(["catalog", "resolve", "plan", "relaunch", "job"]);
    expect(deps.Job.launch).not.toHaveBeenCalled();
    expect(allToolText(model.histories.at(-1)).match(/unknown_tool/g)).toHaveLength(2);
  });

  test("a form without enableForChat is refused, even though the user may open it", async () => {
    const chat = service([call("resolve", { form: "Delete everything", answers: { target: "x" } }), say("no")]);
    const { sessionId } = await chat.openSession(user);
    await chat.message(user, { sessionId, message: "delete everything on x" });
    expect(allToolText(model.histories.at(-1))).toMatch(/unsupported_form/);
  });

  test("catalog lists only the chat forms, ranked", async () => {
    const chat = service([call("catalog", { query: "snapshot of volumes" }), say("You can take a snapshot.")]);
    const { sessionId } = await chat.openSession(user);
    await chat.message(user, { sessionId, message: "what can I run for snapshots?" });
    const payload = JSON.parse(model.histories.at(-1).find((m) => m.role === "tool").text);
    expect(payload.forms.map((f) => f.form)).toEqual(["Create a snapshot", "Health report"]);
    expect(payload.forms[0].risk).toBe("change");
  });
});

describe("the operator chooses the targets", () => {
  test("resolve asks the missing fields and offers the choices", async () => {
    const chat = service([call("resolve", { form: "Create a snapshot", answers: {} }), say("Which cluster?")]);
    const { sessionId } = await chat.openSession(user);
    const out = await chat.message(user, { sessionId, message: "take a snapshot" });
    expect(out.choices).toEqual([{ slot: "cluster", options: [{ value: "bb8" }, { value: "r2d2" }] }]);
    const payload = JSON.parse(model.histories.at(-1).find((m) => m.role === "tool").text);
    expect(payload.status).toBe("needs_input");
    expect(payload.missing_fields.map((f) => f.slot)).toEqual(["cluster", "snapshot_name", "svm"].filter((s) => payload.missing_fields.some((f) => f.slot === s)));
  });

  test("a cluster the operator never named is refused, and __auto__ always", async () => {
    const chat = service([
      call("resolve", { form: "Create a snapshot", answers: { cluster: "r2d2" } }),
      call("resolve", { form: "Create a snapshot", answers: { cluster: "__auto__" } }),
      say("Which cluster?"),
    ]);
    const { sessionId } = await chat.openSession(user);
    await chat.message(user, { sessionId, message: "take a snapshot on bb8" });
    const text = allToolText(model.histories.at(-1));
    expect(text).toMatch(/operator_choice_required/);
    expect(text).toMatch(/auto_rejected/);
  });

  test("a clicked choice counts - but only a value the page offered", async () => {
    const chat = service([
      call("resolve", { form: "Create a snapshot", answers: {} }), say("Which cluster?"),
      call("resolve", { form: "Create a snapshot", answers: { cluster: "r2d2" } }), say("Which SVM?"),
      call("resolve", { form: "Create a snapshot", answers: { cluster: "evil" } }), say("?"),
    ]);
    const { sessionId } = await chat.openSession(user);
    await chat.message(user, { sessionId, message: "snapshot please" });
    await chat.message(user, { sessionId, message: "r2d2", selection: { slot: "cluster", value: "r2d2" } });
    expect(allToolText(model.histories.at(-1))).not.toMatch(/operator_choice_required/);
    await chat.message(user, { sessionId, message: "the other one", selection: { slot: "cluster", value: "evil" } });
    expect(allToolText(model.histories.at(-1).slice(-3))).toMatch(/operator_choice_required/);
  });

  test("an unknown slot is refused before AnsibleForms is asked, naming the real ones", async () => {
    const chat = service([call("resolve", { form: "Create a snapshot", answers: { volume: "v1" } }), say("?")]);
    const { sessionId } = await chat.openSession(user);
    await chat.message(user, { sessionId, message: "snapshot of v1" });
    expect(allToolText(model.histories.at(-1))).toMatch(/unknown_answer.*cluster, svm, snapshot_name/);
  });
});

describe("a summary launches exactly its payload, once, from the click", () => {
  const ready = { form: "Create a snapshot", answers: { cluster: "bb8", svm: "svm_test", snapshot_name: "daily" } };
  const planned = async (chat) => {
    const { sessionId } = await chat.openSession(user);
    const out = await chat.message(user, { sessionId, message: "snapshot daily of svm_test on bb8" });
    return { sessionId, out };
  };

  test("a complete form becomes an Approve summary ; nothing is launched ; secrets masked ; switches listed", async () => {
    const chat = service([call("resolve", ready), say("Click Approve.")]);
    const { out } = await planned(chat);
    expect(out.proposals).toHaveLength(1);
    const p = out.proposals[0];
    expect(p).toMatchObject({ label: "Approve", risk: "change", form: "Create a snapshot" });
    expect(p.summary).toMatch(/Cluster bb8/);
    expect(p.extravars.api_token).toBe("********");
    expect(p.optionalSwitches.map((s) => s.slot)).toEqual(["add_expiry"]);
    expect(deps.Job.launch).not.toHaveBeenCalled();
    expect(allToolText(model.histories.at(-1))).toMatch(/"status":"planned"/);
    expect(allToolText(model.histories.at(-1))).not.toContain("t0k3n");
  });

  test("the click launches it once ; a second click is plan_used ; another conversation is refused", async () => {
    const chat = service([call("resolve", ready), say("Click Approve.")]);
    const { sessionId, out } = await planned(chat);
    const planId = out.proposals[0].planId;
    const other = await chat.openSession(user);
    await expect(chat.approve(user, { sessionId: other.sessionId, planId })).rejects.toMatchObject({ code: "plan_wrong_session" });
    const done = await chat.approve(user, { sessionId, planId });
    expect(done.job.id).toBe(77);
    // the conversation knows the job now : the next question can be about it
    await chat.message(user, { sessionId, message: "did it work?" });
    expect(model.histories.at(-1).some((m) => m.role === "user" && /job 77 was launched/.test(m.text))).toBe(true);
    expect(deps.Job.launch).toHaveBeenCalledTimes(1);
    expect(deps.Job.launch.mock.calls[0][0]).toMatchObject({ form: "Create a snapshot", fromClient: true, validated: true });
    await expect(chat.approve(user, { sessionId, planId })).rejects.toMatchObject({ code: "plan_used" });
    expect(deps.Job.launch).toHaveBeenCalledTimes(1);
  });

  test("another user cannot even reach the conversation", async () => {
    const chat = service([call("resolve", ready), say("Click Approve.")]);
    const { sessionId, out } = await planned(chat);
    await expect(chat.approve(other, { sessionId, planId: out.proposals[0].planId })).rejects.toMatchObject({ code: "session_not_found" });
    expect(deps.Job.launch).not.toHaveBeenCalled();
  });

  test("a payload that moved since the summary is refused (plan_stale), nothing launched", async () => {
    const chat = service([call("resolve", ready), say("Click Approve.")]);
    const { sessionId, out } = await planned(chat);
    ticket = "T-2"; // the server expression now answers differently
    await expect(chat.approve(user, { sessionId, planId: out.proposals[0].planId })).rejects.toMatchObject({ code: "plan_stale" });
    expect(deps.Job.launch).not.toHaveBeenCalled();
  });

  test("a read form gets a Launch button - it still waits for the click", async () => {
    const chat = service([call("resolve", { form: "Health report", answers: {} }), say("Click Launch.")]);
    const { out } = await planned(chat);
    expect(out.proposals[0].label).toBe("Launch");
    expect(deps.Job.launch).not.toHaveBeenCalled();
  });
});

describe("relaunch", () => {
  test("previews, the Relaunch button launches once with the previewed hash, credentials stay off the page", async () => {
    const chat = service([call("relaunch", { job_id: 42 }), say("Click Relaunch.")]);
    const { sessionId } = await chat.openSession(user);
    const out = await chat.message(user, { sessionId, message: "run job 42 again" });
    const p = out.proposals[0];
    expect(p).toMatchObject({ label: "Relaunch", sourceJobId: 42 });
    expect(p.extravars.password).toBe("********");
    expect(deps.Job.relaunchWithValues).toHaveBeenCalledTimes(1);
    const done = await chat.approve(user, { sessionId, planId: p.planId });
    expect(done.job.id).toBe(88);
    const last = deps.Job.relaunchWithValues.mock.calls.at(-1)[0];
    expect(last).toMatchObject({ id: 42, preview: false, expectedPayloadHash: "sha256:r" });
    await expect(chat.approve(user, { sessionId, planId: p.planId })).rejects.toMatchObject({ code: "plan_used" });
  });

  test("the job id must be typed by the operator", async () => {
    const chat = service([call("relaunch", { job_id: 42 }), say("Which job?")]);
    const { sessionId } = await chat.openSession(user);
    const out = await chat.message(user, { sessionId, message: "run my last job again" });
    expect(allToolText(model.histories.at(-1))).toMatch(/operator_choice_required/);
    expect(out.proposals).toEqual([]);
    expect(deps.Job.relaunchWithValues).not.toHaveBeenCalled();
  });
});

describe("the conversation loop", () => {
  test("a claimed launch that did not happen is nudged once, then replaced by the truth", async () => {
    const chat = service([say("The job has been launched."), say("The job has been launched.")]);
    const { sessionId } = await chat.openSession(user);
    const out = await chat.message(user, { sessionId, message: "go" });
    expect(out.reply).toMatch(/Nothing was launched/);
    expect(out.proposals).toEqual([]);
    expect(model.calls).toBe(2);
    expect(deps.Job.launch).not.toHaveBeenCalled();
  });

  test("an empty reply is retried once", async () => {
    const chat = service([say(""), say("Hello")]);
    const { sessionId } = await chat.openSession(user);
    expect((await chat.message(user, { sessionId, message: "hi" })).reply).toBe("Hello");
  });

  test("the message limit of a conversation refuses without calling the model", async () => {
    const chat = service([say("1"), say("2"), say("3")], { max_turns: 2 });
    const { sessionId } = await chat.openSession(user);
    await chat.message(user, { sessionId, message: "a" });
    await chat.message(user, { sessionId, message: "b" });
    await expect(chat.message(user, { sessionId, message: "c" })).rejects.toMatchObject({ code: "turn_limit", status: 429 });
    expect(model.calls).toBe(2);
  });

  test("too many tool rounds in one message stop", async () => {
    const chat = service(Array.from({ length: 10 }, () => call("catalog", { query: "x" })), { max_tool_rounds: 3 });
    const { sessionId } = await chat.openSession(user);
    await expect(chat.message(user, { sessionId, message: "loop" })).rejects.toMatchObject({ code: "tool_round_limit" });
  });

  test("job status only when the settings allow it, and never the extravars or the output", async () => {
    let chat = service([call("job", { job_id: 42 }), say("It succeeded.")]);
    let { sessionId } = await chat.openSession(user);
    const out = await chat.message(user, { sessionId, message: "status of job 42?" });
    expect(out.job).toEqual({ id: 42, form: "Create a snapshot", status: "success", start: "s", end: "e", user: "alice" });
    chat = service([call("job", { job_id: 42 }), say("I cannot.")], { allow_job_status: 0 });
    ({ sessionId } = await chat.openSession(user));
    await chat.message(user, { sessionId, message: "status of job 42?" });
    expect(allToolText(model.histories.at(-1))).toMatch(/not_allowed/);
  });

  test("off or unconfigured : no conversation", async () => {
    const off = createChatService({ deps, complete: vi.fn(), loadSettings: async () => ({}), enabled: () => false });
    await expect(off.openSession(user)).rejects.toMatchObject({ code: "chat_disabled" });
    expect(await off.config()).toEqual({ enabled: false });
    const unconfigured = createChatService({ deps, complete: vi.fn(), loadSettings: async () => ({ provider: "anthropic", api_key: "", model: "m" }), enabled: () => true });
    await expect(unconfigured.openSession(user)).rejects.toMatchObject({ code: "chat_not_configured", status: 503 });
    const on = service([]);
    expect(await on.config()).toEqual({ enabled: true, provider: "anthropic", model: "m", maxTurns: 20 });
  });
});

describe("the real form list carries the chat flags", () => {
  // Regression : Form.load without a form name trims every form to its tile info, and the
  // flags were not part of it - the catalog was always empty on a real instance while the
  // tests above (whose fake Form.load returns whole forms) passed.
  test("getFormInfo's list mode keeps enableForChat and chatRisk", async () => {
    const { readFileSync } = await import("fs");
    const src = readFileSync(new URL("../src/models/form.model.js", import.meta.url), "latin1");
    const list = src.slice(src.indexOf("function getFormInfo"), src.indexOf("else if(form.name == formName)"));
    expect(list).toMatch(/enableForChat: form\.enableForChat === true/);
    expect(list).toMatch(/chatRisk: form\.chatRisk === 'read' \? 'read' : 'change'/);
  });
});
