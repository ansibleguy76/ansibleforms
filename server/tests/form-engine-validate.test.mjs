// Field validation shared with the browser (lib/formEngine/validate.js, values.js). The
// golden fixtures pin the messages against the browser ; these cover the edges.
import { describe, test, expect } from "vitest";
import { req, requiredReq, isEmptyValue, humanFileSize } from "../src/lib/formEngine/values.js";
import { compileFieldRules, validateField } from "../src/lib/formEngine/validate.js";

const ctxOf = (values = {}) => ({ values, fieldOptions: {}, isReady: () => true });
const types = (r) => r.errors.map((e) => e.type);

describe("req and requiredReq (vuelidate parity)", () => {
  test.each([
    ["   ", true, false],
    ["", false, false],
    [0, true, true],
    [false, true, true],
    [[], false, false],
    [["a"], true, true],
    [{}, false, false],
    [{ a: 1 }, true, true],
    [null, false, false],
    [undefined, false, false],
    [new Date("nope"), false, false],
  ])("%j : req %s, requiredReq %s", (value, r, rr) => {
    expect(req(value)).toBe(r);
    expect(requiredReq(value)).toBe(rr);
  });

  test("isEmptyValue and humanFileSize", () => {
    expect(isEmptyValue("__auto__", "enum")).toBe(true);
    expect(isEmptyValue([], "enum")).toBe(false);
    expect(isEmptyValue(false, "checkbox")).toBe(true);
    expect(humanFileSize(1536)).toBe("1.5 kB");
    expect(humanFileSize(undefined)).toBe("Not a number");
  });
});

describe("compileFieldRules", () => {
  test("rules come in the browser's order, so the first error is the one it shows", () => {
    const field = {
      name: "f", type: "text", required: true, minLength: 1, maxLength: 9, regex: { expression: "x", description: "d" },
      validIf: { field: "a", description: "" }, validIfNot: { field: "b", description: "" },
      notIn: { field: "c", description: "" }, in: { field: "d", description: "" }, sameAs: "e",
      minValue: 0, maxValue: 1,
    };
    expect(compileFieldRules(field).rules.map((r) => r.type)).toEqual([
      "required", "minValue", "maxValue", "minLength", "maxLength", "regex", "validIf", "validIfNot", "notIn", "in", "sameAs",
    ]);
    const file = { name: "u", type: "file", minSize: 1, maxSize: 2, regex: { expression: "x", description: "" } };
    expect(compileFieldRules(file).rules.map((r) => r.type)).toEqual(["minSize", "maxSize", "regex"]);
    const yaml = { name: "y", type: "yaml", required: true };
    expect(compileFieldRules(yaml).rules.map((r) => r.type)).toEqual(["required", "validYaml"]);
  });

  test("size limits only apply to a file", () => {
    expect(compileFieldRules({ name: "t", type: "text", minSize: 10 }).rules).toEqual([]);
  });

  test("an unusable regex is reported and not enforced", () => {
    expect(compileFieldRules({ name: "r", type: "text", regex: { description: "no expression" } }).warnings)
      .toEqual([`Field 'r': regex must be given as { expression: "...", description: "..." }; the rule is ignored.`]);
    expect(validateField({ name: "r", type: "text", regex: { expression: "(" } }, "x", ctxOf()).errors).toEqual([]);
  });
});

describe("validateField", () => {
  test("every rule but required lets an empty value through", () => {
    const field = { name: "f", type: "text", minLength: 3, regex: { expression: "^a", description: "" }, sameAs: "g", in: { field: "h", description: "" } };
    expect(validateField(field, "", ctxOf()).errors).toEqual([]);
    expect(types(validateField({ ...field, required: true }, "", ctxOf()))).toEqual(["required"]);
  });

  test("a placeholder limit : resolved, unresolvable (passes), non-numeric (passes with a warning)", () => {
    const field = { name: "n", type: "number", maxValue: "$(hi)" };
    expect(types(validateField(field, 20, ctxOf({ hi: 10 })))).toEqual(["maxValue"]);
    expect(validateField(field, 20, ctxOf({})).errors).toEqual([]);
    const r = validateField(field, 20, ctxOf({ hi: "lots" }));
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual(["maxValue placeholder resolved to non-numeric value: lots"]);
  });

  test("a static non-numeric limit fails any value, as in the browser", () => {
    expect(types(validateField({ name: "n", type: "number", minValue: "ten" }, 20, ctxOf()))).toEqual(["minValue"]);
  });

  test("a placeholder in a description never prints a password", () => {
    const field = { name: "u", type: "text", regex: { expression: "^x", description: "not like $(pw)" } };
    const ctx = { ...ctxOf({ pw: "s3cr3t" }), secretNames: ["pw"] };
    const r = validateField(field, "y", ctx);
    expect(r.errors).toEqual([{ type: "regex", description: "not like ********" }]);
    expect(JSON.stringify(r)).not.toContain("s3cr3t");
  });

  test("the browser's resolver can be plugged in", () => {
    const field = { name: "n", type: "number", minValue: "$(lo)" };
    const ctx = { values: {}, resolve: () => ({ value: "7" }) };
    expect(validateField(field, 3, ctx).errors).toEqual([{ type: "minValue", description: "n must be at least 7" }]);
  });
});
