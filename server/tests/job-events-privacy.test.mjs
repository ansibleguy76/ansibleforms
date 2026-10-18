// A playbook's structured events (rte/callback_plugins/af_events.py) are stored on the job and read
// back by everyone who may see it. They kept a host's whole result (its invocation, the module's
// arguments, a response's body and headers) even when the job did not run verbose, and escaped its
// non-ASCII texts so the app's mask missed a secret with an accent. These pin the rules : the whole
// result only for a job that runs verbose, never its invocation, its secret keys masked (by the
// plugin and again when stored), and non-ASCII kept.
import { describe, test, expect, vi } from "vitest";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
process.env.LOG_PATH ||= "/tmp/ansibleforms-test-logs";

// what the events model was asked to insert
const inserts = [];
vi.mock("../src/models/db.model.js", () => ({
  default: { do: async (sql, params) => { inserts.push(params); return { affectedRows: 1 }; } },
}));

const { artifactsEnv } = await import("../src/rte/ansible-core.js");
const { default: JobEvent, redactResult } = await import("../src/models/jobEvent.model.js");

const PLUGIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/rte/callback_plugins/af_events.py");

// ---------------------------------------------------------------------------------------------
// What the playbook is told
// ---------------------------------------------------------------------------------------------

describe("the playbook's environment", () => {
  const tmp = os.tmpdir();

  test("asks for the whole result only when the job runs verbose", () => {
    expect(artifactsEnv({}, tmp, "/x/a.json", "/x/e.jsonl", true).AF_EVENTS_FULL).toBe("1");
    expect(artifactsEnv({}, tmp, "/x/a.json", "/x/e.jsonl", false).AF_EVENTS_FULL).toBeUndefined();
  });

  test("never takes it from the RTE's own environment", () => {
    expect(artifactsEnv({ AF_EVENTS_FULL: "1" }, tmp, "/x/a.json", "/x/e.jsonl", false).AF_EVENTS_FULL).toBeUndefined();
  });

  test("passes the app's secret keys pattern with the events file", () => {
    expect(artifactsEnv({}, tmp, "/x/a.json", "/x/e.jsonl").AF_EVENTS_MASK_REGEX).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------------------
// What is stored
// ---------------------------------------------------------------------------------------------

describe("a stored result", () => {
  test("loses its invocation at any depth, its secret keys masked", () => {
    const out = redactResult({
      changed: true,
      invocation: { module_args: { password: "p" } },
      json: { access_token: "abc", name: "x", api_key: "k" },
      headers: { Authorization: "Bearer t", "set-cookie": "s=1", server: "nginx" },
      results: [{ item: "a", invocation: { module_args: {} }, secret: "" }],
    });
    expect(out.invocation).toBeUndefined();
    expect(out.results[0].invocation).toBeUndefined();
    expect(out.json).toEqual({ access_token: "********", name: "x", api_key: "********" });
    expect(out.headers).toEqual({ Authorization: "********", "set-cookie": "********", server: "nginx" });
    // an empty one has nothing to hide, a flag stays one
    expect(out.results[0].secret).toBe("");
    expect(out.changed).toBe(true);
  });

  test("is redacted again when the events are stored", async () => {
    inserts.length = 0;
    await JobEvent.create(7, [{ order: 1, type: "ok", host: "h", data: { msg: "hi" }, result: { invocation: { module_args: { password: "p" } }, token: "t", msg: "hi" } }]);
    const row = inserts[0][0][0];
    const stored = JSON.parse(row[9]);
    expect(stored).toEqual({ token: "********", msg: "hi" });
  });

  test("an event without one stores none", async () => {
    inserts.length = 0;
    await JobEvent.create(7, [{ order: 1, type: "ok", host: "h", data: { msg: "hi" } }]);
    expect(inserts[0][0][0][9]).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// The plugin itself (when ansible is installed where the tests run)
// ---------------------------------------------------------------------------------------------

// a host's result, as ansible hands it to the plugin : what its _fields keeps of it, as JSON
const PROBE = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("af_events", sys.argv[1])
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
class R: pass
r = R()
r._task = None
data = {"msg": "café", "changed": True, "invocation": {"module_args": {"password": "p"}},
        "json": {"token": "t", "name": "n"}, "item": {"user": "zoë", "password": "pw"}}
fields = mod.CallbackModule._fields(None, r, data)
print(json.dumps(fields, ensure_ascii=False))
`;
const hasAnsible = spawnSync("python3", ["-c", "import ansible"]).status === 0;

/**
 * Runs the probe on the plugin with the given environment.
 *
 * Args:
 *   env (object): the variables added (AF_EVENTS_FULL).
 *
 * Returns:
 *   object: what the plugin keeps of the result.
 */
function probe(env) {
  const run = spawnSync("python3", ["-c", PROBE, PLUGIN], { env: { ...process.env, AF_EVENTS_FULL: "", ...env }, encoding: "utf8" });
  if (run.status !== 0) throw new Error(run.stderr);
  return JSON.parse(run.stdout);
}

describe.skipIf(!hasAnsible)("the af_events plugin", () => {
  test("keeps only the summary when the job does not run verbose", () => {
    const fields = probe({});
    expect(fields.result).toBeNull();
    expect(fields.data).toEqual({ msg: "café", changed: true });
  });

  test("keeps the whole result when it does, without its invocation, its secrets masked", () => {
    const fields = probe({ AF_EVENTS_FULL: "1" });
    expect(fields.result.invocation).toBeUndefined();
    expect(fields.result.json).toEqual({ token: "********", name: "n" });
  });

  test("a dictionary item is JSON with its non-ASCII kept and its secrets masked", () => {
    const item = JSON.parse(probe({}).item);
    expect(item).toEqual({ user: "zoë", password: "********" });
    expect(probe({}).item).toContain("zoë");
  });
});
