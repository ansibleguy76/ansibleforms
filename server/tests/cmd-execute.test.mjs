// Cmd.executeSilentCommand, run for real : the command never sees the app's own secrets, a
// timeout stops it (SIGKILL when it ignores SIGTERM) and says so only when it was the timeout,
// and an output file that cannot be written fails the command instead of the process.
import { test, describe, beforeAll, afterAll } from "vitest";
import assert from "node:assert/strict";
import fs from "fs";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";

const Cmd = (await import("../src/lib/cmd.js")).default;

// a command in the server's folder (Cmd.workingFolder)
const run = (command, options = {}, timeoutSeconds) =>
  Cmd.executeSilentCommand({ command, directory: process.cwd(), description: "test", ...options }, true, false, timeoutSeconds);

// --------------------------------------------------------------------------------------
// the tests
// --------------------------------------------------------------------------------------
describe("the environment of a command", () => {
  const saved = {};
  const SECRETS = { ENCRYPTION_SECRET: "enc-secret", DB_PASSWORD: "db-pass", ACCESS_TOKEN_SECRET: "jwt-secret", RTE_TOKEN: "rte-token" };
  beforeAll(() => {
    for (const [name, value] of Object.entries({ ...SECRETS, GIT_SSH_COMMAND: "ssh -o BatchMode=yes", HTTPS_PROXY: "http://proxy:3128" })) {
      saved[name] = process.env[name];
      process.env[name] = value;
    }
  });
  afterAll(() => {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  test("holds none of the app's secrets, and what git and a dump tool need", async () => {
    const out = await run("env", { env: { AF_DB_PASSWORD: "given" } });
    for (const [name, value] of Object.entries(SECRETS)) {
      assert.doesNotMatch(out, new RegExp(`^${name}=`, "m"), name);
      assert.ok(!out.includes(value), name);
    }
    assert.match(out, /^PATH=/m);
    assert.match(out, /^GIT_SSH_COMMAND=ssh -o BatchMode=yes$/m);
    assert.match(out, /^HTTPS_PROXY=http:\/\/proxy:3128$/m);
    // the command's own variables are added
    assert.match(out, /^AF_DB_PASSWORD=given$/m);
  });
});

describe("a command that runs too long", () => {
  const grace = Cmd.KILL_GRACE_MS;
  beforeAll(() => {
    Cmd.KILL_GRACE_MS = 300;
  });
  afterAll(() => {
    Cmd.KILL_GRACE_MS = grace;
  });

  test("is stopped, and says it timed out", async () => {
    await assert.rejects(run("sleep 30", {}, 0.3), /The command timed out/);
  });

  test("one that ignores SIGTERM is killed after the grace period", async () => {
    const started = Date.now();
    await assert.rejects(run(`sh -c "trap '' TERM; sleep 30"`, {}, 0.3), /The command timed out/);
    assert.ok(Date.now() - started < 5000, "killed after the grace period");
  });

  test("a SIGTERM from someone else is not a timeout", async () => {
    await assert.rejects(run(`sh -c 'kill -TERM $$'`, {}, 30), (err) => {
      assert.doesNotMatch(err.message, /timed out/);
      return true;
    });
  });
});

describe("an output file that cannot be written", () => {
  test("a full disk fails the command, the process goes on", { skip: !fs.existsSync("/dev/full") }, async () => {
    const started = Date.now();
    await assert.rejects(run("yes", { stdoutFile: "/dev/full" }, 30), /Writing the output to \/dev\/full failed/);
    assert.ok(Date.now() - started < 10000, "stopped at once, not at the timeout");
  });

  test("a folder that does not exist fails the command", async () => {
    await assert.rejects(run("sleep 30", { stdoutFile: "/nonexistent-af-folder/out.sql" }, 30), /Writing the output to \/nonexistent-af-folder\/out.sql failed/);
  });

  test("a file that can be written gets the whole output", async () => {
    const file = `/tmp/af-cmd-out-${process.pid}.txt`;
    try {
      await run("echo hello", { stdoutFile: file });
      assert.equal(fs.readFileSync(file, "utf8"), "hello\n");
    } finally {
      fs.rmSync(file, { force: true });
    }
  });
});
