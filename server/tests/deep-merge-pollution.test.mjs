// A wizard's step outputs merged (lib/launchValidation.js deepMerge) : a key that reaches the
// prototype - a JSON '__proto__' is an own key - is left out, so Object.prototype stays clean.
import { test, expect, vi } from "vitest";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";

vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));
const { deepMerge } = await import("../src/lib/launchValidation.js");

test("plain objects merge, arrays and scalars overwrite", () => {
  expect(deepMerge({ a: { b: 1 }, l: [1] }, { a: { c: 2 }, l: [2], s: "x" })).toEqual({ a: { b: 1, c: 2 }, l: [2], s: "x" });
});

test("a __proto__, constructor or prototype key never reaches Object.prototype", () => {
  const src = JSON.parse('{"__proto__": {"polluted": true}, "a": {"__proto__": {"polluted": true}}, "constructor": {"prototype": {"polluted": true}}}');
  const out = deepMerge({ a: {} }, src);
  expect({}.polluted).toBeUndefined();
  expect(Object.prototype.polluted).toBeUndefined();
  expect(Object.keys(out)).toEqual(["a"]);
});
