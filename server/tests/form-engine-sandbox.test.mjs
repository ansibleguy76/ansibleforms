// runLocal evaluation on the server (lib/formEngine/node/sandbox.js).
import { describe, test, expect } from "vitest";
import { evalSandbox } from "../src/lib/formEngine/node/sandbox.js";

describe("evalSandbox", () => {
  test("plain expressions and the completion value of several statements", () => {
    expect(evalSandbox("1 + 2")).toBe(3);
    expect(evalSandbox("var a = 1; a + 1")).toBe(2);
    expect(evalSandbox("({ a: [1, 2] })")).toEqual({ a: [1, 2] });
    expect(evalSandbox("undefined")).toBeUndefined();
    expect(evalSandbox("")).toBeUndefined();
  });

  test("the browser helpers are available", () => {
    expect(evalSandbox("fnArray.from([{n:'b'},{n:'a'}]).sortBy('n').map(x => x.n)")).toEqual(["a", "b"]);
    expect(evalSandbox("fnArray.from([{n:'ab'},{n:'cd'}]).filterBy({n:'a*'}).length")).toBe(1);
    expect(evalSandbox("fnGetNumberedName(['vol_001','vol_002'], 'vol_###', 'x')")).toBe("vol_003");
    expect(evalSandbox("fnToTable([{a:'<b>'}])")).toBe("<table><thead><tr><th>a</th></tr></thead><tbody><tr><td>&lt;b&gt;</td></tr></tbody></table>");
  });

  test("the result is a plain host value", () => {
    const r = evalSandbox("[{ a: new Date(0) }]");
    expect(Array.isArray(r)).toBe(true);
    expect(r[0].a).toBe("1970-01-01T00:00:00.000Z");
  });

  test("a runaway expression is stopped", () => {
    expect(() => evalSandbox("while(true){}", { timeout: 50 })).toThrow(/timed out/);
  });

  test("no host access", () => {
    expect(() => evalSandbox("process.env")).toThrow(/process is not defined/);
    expect(() => evalSandbox("require('fs')")).toThrow(/require is not defined/);
    // compiling a string into code inside the context is refused, which closes the classic
    // this.constructor.constructor('return process')() escape
    expect(() => evalSandbox("this.constructor.constructor('return process')()")).toThrow(/Code generation from strings disallowed/);
    expect(() => evalSandbox("eval('1')")).toThrow(/Code generation from strings disallowed/);
  });

  test("nothing leaks between evaluations", () => {
    evalSandbox("var leaked = 1");
    expect(evalSandbox("typeof leaked")).toBe("undefined");
  });
});
