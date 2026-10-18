// fn.fnSsh : its output is read to the end (it resolved on 'exit', before the last lines were
// read), a remote command that hangs is stopped, and a failure is an Error, not an array.
// A fake ssh on the PATH stands in for the real one.
import { test, describe, beforeAll, afterAll } from "vitest";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

const { default: fn } = await import("../src/functions/default.js");

// --------------------------------------------------------------------------------------
// a fake ssh : its last argument is what it does
// --------------------------------------------------------------------------------------
let bin;
const realPath = process.env.PATH;
beforeAll(() => {
  bin = fs.mkdtempSync(path.join(os.tmpdir(), "af-fnssh-"));
  fs.writeFileSync(
    path.join(bin, "ssh"),
    [
      "#!/bin/sh",
      'for last; do :; done',
      'case "$last" in',
      // many lines, the last one written right before it ends
      '  lines) i=0; while [ $i -lt 2000 ]; do echo "line $i"; i=$((i+1)); done; echo "the end" >&2; exit 3 ;;',
      '  hang) exec sleep 30 ;;',
      "esac",
    ].join("\n") + "\n",
    { mode: 0o755 }
  );
  process.env.PATH = `${bin}${path.delimiter}${realPath}`;
});
afterAll(() => {
  process.env.PATH = realPath;
  fs.rmSync(bin, { recursive: true, force: true });
});

// --------------------------------------------------------------------------------------
// the tests
// --------------------------------------------------------------------------------------
describe("fnSsh", () => {
  test("gives every line of the output, then its exit code", async () => {
    const out = await fn.fnSsh("bob", "host", "lines");
    assert.ok(out.includes("line 0"));
    assert.ok(out.includes("line 1999"));
    assert.ok(out.includes("the end"));
    assert.equal(out.at(-1), "exit(3)");
  });

  test("a remote command that hangs is stopped, with an Error that says so", async () => {
    const started = Date.now();
    await assert.rejects(fn.fnSsh("bob", "host", "hang", null, 1), (err) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /ssh to bob@host timed out after 1 seconds/);
      return true;
    });
    assert.ok(Date.now() - started < 10000);
  });
});
