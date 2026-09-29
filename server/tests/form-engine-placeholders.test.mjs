// The server-side port of the browser's placeholder handling (lib/formEngine/placeholders.js).
// The cases are the ones the client comments document, so a drift between the two shows up
// here rather than as a job launched with different extravars through MCP.
import { describe, test, expect } from "vitest";
import {
  replacePlaceholderInString,
  getFieldValue,
  scanDependencies,
  checkDependencies,
  readPlaceholderPath,
} from "../src/lib/formEngine/placeholders.js";

const ctx = (values, fieldOptions = {}, isReady = () => true) => ({ values, fieldOptions, isReady });

describe("replacePlaceholderInString - expression mode", () => {
  test("quotes around the placeholder are replaced by a JS literal", () => {
    const r = replacePlaceholderInString("fn.fnLs('$(dir)')", ctx({ dir: "/app" }), false, "expression");
    expect(r.value).toBe('fn.fnLs("/app")');
  });

  test("a placeholder inside a longer string is spliced in as text", () => {
    const r = replacePlaceholderInString("fn.fnLs('$(dir)/vars')", ctx({ dir: "/app" }), false, "expression");
    expect(r.value).toBe("fn.fnLs('/app/vars')");
  });

  test("an apostrophe in a value cannot break out of the string", () => {
    const r = replacePlaceholderInString("'$(name)'.length", ctx({ name: "O'Brien'); process.exit(1); ('" }), false, "expression");
    expect(r.value).toBe(`${JSON.stringify("O'Brien'); process.exit(1); ('")}.length`);
  });

  test("outside a string a number stays a number", () => {
    const r = replacePlaceholderInString("$(count) + 1", ctx({ count: 2 }), false, "expression");
    expect(r.value).toBe("2 + 1");
  });

  test("a list field is serialised from its rows' __output__", () => {
    const r = replacePlaceholderInString("$(rows)", ctx(
      { rows: [{ a: 1, __output__: { x: 1 } }, { b: 2 }] },
      { rows: { type: "list" } }), false, "expression");
    expect(r.value).toBe('[{"x":1},{"b":2}]');
  });

  test("a dotted reference into an expression object", () => {
    const r = replacePlaceholderInString("$(obj.a.b)", ctx({ obj: { a: { b: "deep" } } }, { obj: { type: "expression" } }), false, "expression");
    expect(r.value).toBe('"deep"');
  });
});

describe("replacePlaceholderInString - raw mode", () => {
  test("a record picks the dotted column", () => {
    const r = replacePlaceholderInString("x='$(city.name)'", ctx({ city: { name: "Gent", zip: 9000 } }));
    expect(r.value).toBe("x='Gent'");
    expect(r.resolved).toEqual({ "city.name": "Gent" });
  });

  test("placeholderColumn makes a bare placeholder read that column", () => {
    const r = replacePlaceholderInString("$(city)", ctx({ city: { name: "Gent", zip: 9000 } }, { city: { type: "enum", placeholderColumn: "zip" } }));
    expect(r.value).toBe("9000");
  });

  test("a field that is not ready leaves the whole value undefined and is named", () => {
    const r = replacePlaceholderInString("a=$(x) b=$(y)", ctx({ x: 1, y: 2 }, {}, (n) => n !== "y"));
    expect(r.value).toBeUndefined();
    expect(r.missing).toEqual(["y"]);
  });

  test("ignoreIncomplete substitutes undefined", () => {
    const r = replacePlaceholderInString("'$(x)'", ctx({}), true);
    expect(r.value).toBe("undefined");
  });

  test("the enum sentinels read as missing", () => {
    const r = replacePlaceholderInString("$(pick)", ctx({ pick: "__auto__" }));
    expect(r.value).toBeUndefined();
  });

  test("a non-string passes through", () => {
    expect(replacePlaceholderInString(5, ctx({})).value).toBe(5);
  });
});

describe("helpers", () => {
  test("getFieldValue flattens an array of records by column", () => {
    expect(getFieldValue([{ n: "a" }, { n: "b" }], "n", true)).toEqual(["a", "b"]);
    expect(getFieldValue({ n: "a", m: 1 }, "m", false)).toBe(1);
    expect(getFieldValue({ n: "a" }, "missing", false)).toBe("a");
  });

  test("readPlaceholderPath walks without eval", () => {
    expect(readPlaceholderPath("a.b[1].c", { a: { b: [{}, { c: 3 }] } })).toBe(3);
    expect(readPlaceholderPath("a.x.y", { a: {} })).toBeUndefined();
    expect(readPlaceholderPath("a;b", {})).toBe("$(a;b)");
  });
});

describe("scanDependencies", () => {
  const fields = [
    { name: "a", type: "text" },
    { name: "b", type: "expression", expression: "'$(a)'" },
    { name: "c", type: "text", default: "$(b.x)_$(CONST)" },
    { name: "d", type: "text", dependencies: [{ name: "!a", values: ["x"] }] },
    { name: "e", type: "expression", expression: "$(nope)" },
  ];

  test("expression, default and dependencies all count", () => {
    const g = scanDependencies(fields, ["CONST"]);
    expect(g.dependsOn).toEqual({ b: ["a"], c: ["b"], d: ["a"] });
    expect(g.dependents.a).toEqual(["b", "d"]);
    expect(g.warnings).toEqual(["'e' has a reference to unknown field 'nope'"]);
  });

  test("a cycle is reported", () => {
    const g = scanDependencies([
      { name: "x", type: "expression", expression: "$(y)" },
      { name: "y", type: "expression", expression: "$(x)" },
    ]);
    expect(g.cycles.sort()).toEqual(["x", "y"]);
  });
});

describe("checkDependencies", () => {
  const f = (deps, fn) => ({ name: "t", dependencies: deps, ...(fn ? { dependencyFn: fn } : {}) });

  test("and / or / nand", () => {
    const deps = [{ name: "a", values: [1] }, { name: "b", values: [2] }];
    expect(checkDependencies(f(deps), { a: 1, b: 2 })).toBe(true);
    expect(checkDependencies(f(deps), { a: 1, b: 3 })).toBe(false);
    expect(checkDependencies(f(deps, "or"), { a: 0, b: 2 })).toBe(true);
    expect(checkDependencies(f(deps, "nand"), { a: 1, b: 2 })).toBe(false);
  });

  test("inversion and valueColumn", () => {
    const deps = [{ name: "!city", values: ["Gent"] }];
    const opts = { city: { valueColumn: "name" } };
    expect(checkDependencies(f(deps), { city: { name: "Gent" } }, opts)).toBe(false);
    expect(checkDependencies(f(deps), { city: { name: "Brugge" } }, opts)).toBe(true);
  });

  test("isValid uses the callback", () => {
    const deps = [{ name: "a", isValid: true }];
    expect(checkDependencies(f(deps), {}, {}, () => true)).toBe(true);
    expect(checkDependencies(f(deps), {}, {}, () => false)).toBe(false);
  });

  test("a field without dependencies is shown", () => {
    expect(checkDependencies({ name: "t" }, {})).toBe(true);
  });
});
