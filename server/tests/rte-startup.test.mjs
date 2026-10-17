// The RTE's start (server/src/rte/server.js startRte) next to an app that is still creating the
// schema : a fresh install with both started together (a helm sidecar, compose without
// depends_on). The jobs table is not there yet, so the first query on it fails. The RTE must
// listen anyway, say "not ready" on /ready, refuse jobs with a 503 busy, and try again until the
// schema is there - not stay up without listening until a probe kills it.
import { test, describe, beforeEach, afterEach, vi, expect } from "vitest";
import http from "http";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

// the database : reachable or not, and the jobs table there or not yet
let db;
vi.mock("../src/models/db.model.js", () => ({
  default: {
    do: async (sql) => {
      if (db.down) throw Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });
      if (sql === "SELECT 1") return [{ 1: 1 }];
      if (/information_schema\.tables/.test(sql)) return [{ n: db.schema ? 3 : 0 }];
      if (/SET status='abandoned'/.test(sql)) {
        db.abandonCalls++;
        if (!db.schema) throw Object.assign(new Error("Table 'AnsibleForms.jobs' doesn't exist"), { code: "ER_NO_SUCH_TABLE" });
        return { changedRows: 0 };
      }
      return [];
    },
    tryDo: async () => [],
    end: async () => {},
  },
}));

vi.mock("../src/rte/ansible-core.js", () => ({
  runnerIdentity: () => "rte-test-8000",
  runAnsibleJob: () => new Promise(() => {}),
  useJobIO: () => {},
}));

// what comes after the database work : only whether it ran, and when
const after = { syslog: vi.fn(async () => {}), heartbeat: vi.fn(), register: vi.fn(() => null) };
vi.mock("../src/lib/syslogServers.js", () => ({ startSyslogServers: (...a) => after.syslog(...a) }));
vi.mock("../src/lib/nodes.js", () => ({ startHeartbeat: (...a) => after.heartbeat(...a) }));
vi.mock("../src/rte/register.js", () => ({ registerSelf: (...a) => after.register(...a) }));
// the test process keeps its own handlers
vi.mock("../src/lib/fatal.js", () => ({ installFatalHandlers: () => {} }));

// the same module the RTE logs through (the logger alias of vitest.config.js)
const logger = (await import("./__mocks__/logger.js")).default;
const { startRte } = await import("../src/rte/server.js");

process.env.RTE_TOKEN = "the-rte-token-of-the-test";

// the RTE's http server, caught as it is created : startRte only resolves once the database work
// is done, and the test looks at it before
let servers;
let createServer;
beforeEach(() => {
  db = { down: false, schema: false, abandonCalls: 0 };
  servers = [];
  after.syslog.mockReset().mockImplementation(async () => {});
  after.heartbeat.mockReset();
  after.register.mockReset().mockImplementation(() => null);
  const original = http.createServer.bind(http);
  createServer = vi.spyOn(http, "createServer").mockImplementation((...a) => {
    const s = original(...a);
    servers.push(s);
    return s;
  });
});
afterEach(async () => {
  createServer.mockRestore();
  vi.restoreAllMocks();
  for (const s of servers) await new Promise((r) => s.close(() => r()));
});

async function until(check, ms = 3000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
}

async function get(path, { method = "GET", body } = {}) {
  const { port } = servers[0].address();
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { authorization: `Bearer ${process.env.RTE_TOKEN}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

describe("an RTE started before the app created the schema", () => {
  test("listens, is not ready and takes no job until the schema is there, then starts", async () => {
    const warnings = vi.spyOn(logger, "warning");
    const started = startRte({ firstDelayMs: 5, maxDelayMs: 20 });
    let settled = null;
    started.then(() => { settled = "resolved"; }, (e) => { settled = e; });

    // it listens at once : the probes see a live process
    await until(() => servers[0]?.listening);
    // and it keeps trying, with a line that says why
    await until(() => db.abandonCalls >= 3);
    expect(settled).toBe(null);
    expect(warnings.mock.calls.some(([m]) => /schema/.test(m) && /trying again/.test(m))).toBe(true);

    expect(await get("/live")).toEqual({ status: 200, data: { status: "live" } });
    expect(await get("/ready")).toEqual({ status: 503, data: { status: "not ready", reason: "starting" } });
    const refused = await get("/rte/v1/jobs", { method: "POST", body: { jobId: 11 } });
    expect(refused.status).toBe(503);
    expect(refused.data.busy).toBe(true);
    // nothing that needs the schema has started
    expect(after.heartbeat).not.toHaveBeenCalled();
    expect(after.register).not.toHaveBeenCalled();

    // the app created the schema
    db.schema = true;
    await started;
    expect(settled).toBe("resolved");
    expect(after.syslog).toHaveBeenCalledTimes(1);
    expect(after.heartbeat).toHaveBeenCalledTimes(1);
    expect(after.register).toHaveBeenCalledTimes(1);
    expect(await get("/ready")).toEqual({ status: 200, data: { status: "ready" } });
  });

  test("a database that does not answer yet is waited for the same way", async () => {
    db.down = true;
    const started = startRte({ firstDelayMs: 5, maxDelayMs: 20 });
    await until(() => servers[0]?.listening);
    await new Promise((r) => setTimeout(r, 50));
    expect((await get("/ready")).status).toBe(503);
    db.down = false;
    db.schema = true;
    await started;
    expect(db.abandonCalls).toBe(1);
    expect((await get("/ready")).status).toBe(200);
  });

  test("an error after the database work exits non-zero, it does not stay half started", async () => {
    db.schema = true;
    after.syslog.mockImplementation(async () => { throw new Error("boom"); });
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {});
    await startRte({ firstDelayMs: 5, maxDelayMs: 20 });
    expect(exit).toHaveBeenCalledWith(1);
  });
});
