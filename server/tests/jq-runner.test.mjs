// The jq runner (lib/jq.js) : node-jq's results, plus a time limit and an output cap,
// and definitions joined with newlines so a '#' comment cannot swallow the filter.
import { describe, test, expect } from "vitest";

const { runJq, jqDefinitions, joinJqDefinitions } = await import("../src/lib/jq.js");

describe("runJq", () => {
  test("gives node-jq's results, with the app's definitions available", async () => {
    expect(await runJq(".a|fn2KB", { a: 2048 })).toBe(2);
    expect(await runJq(".a", { a: { b: [1, 2] } })).toEqual({ b: [1, 2] });
    expect(await runJq("empty", {})).toBeUndefined();
    // several results : the raw text, as node-jq gave it
    expect(await runJq(".[]", [1, 2])).toBe("1\n2");
  });

  test("a '#' comment in the definitions ends at its line", async () => {
    expect(jqDefinitions.endsWith("\n")).toBe(true);
    // a custom definitions file ending in a comment line, without a final newline
    const defs = joinJqDefinitions("def fnA: 1; # one", "# the admin's own\ndef fnB: 2; # two");
    expect(await runJq(defs + "fnA + fnB", null, { definitions: false })).toBe(3);
  });

  test("a runaway filter is killed after the time limit", async () => {
    await expect(runJq("[range(1e12)] | length", null, { timeoutMs: 300 })).rejects.toThrow(/timed out/);
  });

  test("an oversized output is refused", async () => {
    await expect(runJq("[range(100000)]", null, { maxOutputBytes: 1000 })).rejects.toThrow(/exceeds/);
  });

  test("a syntax error is reported with jq's message", async () => {
    await expect(runJq(".a.b(", {})).rejects.toThrow(/syntax|compile/i);
  });
});
