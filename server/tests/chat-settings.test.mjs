// The chat assistant's provider settings (one row, api key encrypted) and the two
// provider adapters' requests - the key only ever in a header, never in a body.
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

let row;
const updates = [];
vi.mock("../src/models/db.model.js", () => ({
  default: {
    do: async (sql, rec) => {
      if (/^UPDATE/.test(sql)) { updates.push(rec); return { affectedRows: 1 }; }
      return row ? [structuredClone(row)] : [];
    },
  },
}));

const appConfig = (await import("./__mocks__/app.config.js")).default;
appConfig.encryptionSecret ||= "0123456789abcdef0123456789abcdef";
const crypto = (await import("../src/lib/crypto.js")).default;
const ChatSettings = (await import("../src/models/chatSettings.model.js")).default;
const controller = (await import("../src/controllers/v2/chatSettings.controller.js")).default;
const anthropic = (await import("../src/chat/providers/anthropic.js")).default;
const openai = (await import("../src/chat/providers/openai.js")).default;
const { complete } = await import("../src/chat/providers/index.js");

const res = () => {
  const r = { statusCode: 200, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};

beforeEach(() => {
  updates.length = 0;
  row = { provider: "anthropic", api_key: crypto.encrypt("sk-real"), base_url: "", model: "m", max_turns: 20, max_tool_rounds: 6, timeout_seconds: 60, allow_job_status: 1, managed: 0 };
});

describe("chat settings", () => {
  test("the api key is stored encrypted, limits are clamped, an unknown provider is none", () => {
    const rec = new ChatSettings({ provider: "evil", api_key: "sk-x", max_turns: 9999, timeout_seconds: "abc" });
    expect(rec.provider).toBe("");
    expect(rec.api_key).not.toContain("sk-x");
    expect(crypto.decrypt(rec.api_key)).toBe("sk-x");
    expect(rec.max_turns).toBe(200);
    expect(rec.timeout_seconds).toBe(60);
  });

  test("the key comes back masked, and a masked key on save keeps the stored one", async () => {
    const r = res();
    await controller.find({}, r);
    expect(r.body.api_key).toBe("**********");
    await controller.update({ body: { provider: "openai", api_key: "**********", model: "gpt" } }, res());
    expect(crypto.decrypt(updates[0].api_key)).toBe("sk-real");
    expect(updates[0].provider).toBe("openai");
  });

  test("a row managed by the config seed is read only", async () => {
    row.managed = 1;
    const r = res();
    await controller.update({ body: { provider: "openai" } }, r);
    expect(r.statusCode).toBe(403);
    expect(updates).toEqual([]);
  });

  test("configured means provider, key and model", async () => {
    expect(ChatSettings.isConfigured(await ChatSettings.find())).toBe(true);
    expect(ChatSettings.isConfigured({ ...row, api_key: "" })).toBe(false);
    expect(ChatSettings.isConfigured({ ...row, provider: "" })).toBe(false);
    // a local model server or an internal proxy : a base url and no key
    expect(ChatSettings.isConfigured({ ...row, api_key: "", base_url: "http://ollama:11434/v1" })).toBe(true);
  });
});

describe("provider requests", () => {
  let calls;
  const reply = (json, status = 200) => vi.fn(async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    return { ok: status < 300, status, text: async () => JSON.stringify(json) };
  });
  const tools = [{ name: "resolve", description: "d", parameters: { type: "object", properties: {} } }];
  const history = [
    { role: "user", text: "snapshot please" },
    { role: "assistant", text: "", toolCalls: [{ id: "t1", name: "resolve", arguments: { form: "F" } }, { id: "t2", name: "catalog", arguments: {} }] },
    { role: "tool", toolCallId: "t1", text: "{\"status\":\"needs_input\"}" },
    { role: "tool", toolCallId: "t2", text: "{}" },
  ];
  beforeEach(() => { calls = []; });
  afterEach(() => { vi.unstubAllGlobals(); });

  test("anthropic : x-api-key header, tools as input_schema, tool results grouped, no sampling parameters", async () => {
    vi.stubGlobal("fetch", reply({ content: [{ type: "thinking", thinking: "hidden" }, { type: "text", text: "Which cluster?" }, { type: "tool_use", id: "t3", name: "resolve", input: { form: "F" } }] }));
    const out = await complete({ settings: { provider: "anthropic", api_key: "sk-a", model: "m", timeout_seconds: 5 }, system: "S", history, tools });
    const c = calls[0];
    expect(c.url).toBe("https://api.anthropic.com/v1/messages");
    expect(c.headers["x-api-key"]).toBe("sk-a");
    expect(JSON.stringify(c.body)).not.toContain("sk-a");
    expect(c.body.tools[0]).toEqual({ name: "resolve", description: "d", input_schema: { type: "object", properties: {} } });
    expect(c.body.messages[2]).toEqual({ role: "user", content: [
      { type: "tool_result", tool_use_id: "t1", content: "{\"status\":\"needs_input\"}" },
      { type: "tool_result", tool_use_id: "t2", content: "{}" },
    ] });
    for (const k of ["temperature", "top_p", "top_k", "thinking"]) expect(c.body[k]).toBeUndefined();
    expect(out.text).toBe("Which cluster?");
    expect(out.text).not.toContain("hidden");
    expect(out.toolCalls).toEqual([{ id: "t3", name: "resolve", arguments: { form: "F" } }]);
    expect(out.raw[0].type).toBe("thinking");
  });

  test("openai : bearer, function tools, the operator as user, assistant content a string, broken arguments flagged", async () => {
    vi.stubGlobal("fetch", reply({ choices: [{ message: { content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "resolve", arguments: "{bad" } }] } }] }));
    const out = await complete({ settings: { provider: "openai", api_key: "sk-o", model: "gpt", timeout_seconds: 5 }, system: "S", history, tools, user: "mirko" });
    const c = calls[0];
    expect(c.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(c.headers.authorization).toBe("Bearer sk-o");
    expect(JSON.stringify(c.body)).not.toContain("sk-o");
    expect(c.body.user).toBe("mirko");
    expect(c.body.tools[0].function.name).toBe("resolve");
    expect(c.body.messages[0]).toEqual({ role: "system", content: "S" });
    expect(c.body.messages[2].content).toBe("");
    expect(c.body.messages[2].tool_calls[0].function.arguments).toBe("{\"form\":\"F\"}");
    expect(out.toolCalls[0].arguments).toEqual({ __invalid_json__: true });
  });

  test("azure openai : api-key header, the path goes in front of the api-version query", async () => {
    vi.stubGlobal("fetch", reply({ choices: [{ message: { content: "OK" } }] }));
    await complete({ settings: { provider: "openai", api_key: "az", model: "gpt", base_url: "https://x.openai.azure.com/openai/deployments/gpt?api-version=2024-10-21", timeout_seconds: 5 }, system: "S", history: [{ role: "user", text: "hi" }], tools: [] });
    expect(calls[0].url).toBe("https://x.openai.azure.com/openai/deployments/gpt/chat/completions?api-version=2024-10-21");
    expect(calls[0].headers["api-key"]).toBe("az");
    expect(calls[0].headers.authorization).toBeUndefined();
    expect(calls[0].body.user).toBeUndefined();
  });

  test("a provider error is reported with its status, never the key", async () => {
    vi.stubGlobal("fetch", reply({ error: { message: "invalid x-api-key" } }, 401));
    const err = await complete({ settings: { provider: "anthropic", api_key: "sk-secret", model: "m", timeout_seconds: 5 }, system: "S", history: [{ role: "user", text: "hi" }], tools: [] }).catch((e) => e);
    expect(err).toMatchObject({ code: "provider_error", status: 502 });
    expect(err.message).toMatch(/Anthropic returned 401/);
    expect(err.message).not.toContain("sk-secret");
  });

  test("no key (Ollama, an internal proxy) : no auth header at all", async () => {
    vi.stubGlobal("fetch", reply({ choices: [{ message: { content: "OK" } }] }));
    await complete({ settings: { provider: "openai", api_key: "", model: "llama3", base_url: "http://ollama:11434/v1", timeout_seconds: 5 }, system: "S", history: [{ role: "user", text: "hi" }], tools: [] });
    expect(calls[0].url).toBe("http://ollama:11434/v1/chat/completions");
    expect(calls[0].headers.authorization).toBeUndefined();
    expect(calls[0].headers["api-key"]).toBeUndefined();
  });

  test("no provider configured", async () => {
    await expect(complete({ settings: { provider: "" }, system: "", history: [], tools: [] })).rejects.toMatchObject({ code: "chat_not_configured" });
  });

  test("the adapters are the ones the tests read", () => {
    expect(typeof anthropic.anthropicBody).toBe("function");
    expect(typeof openai.openaiBody).toBe("function");
  });
});
