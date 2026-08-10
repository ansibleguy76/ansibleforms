// The server-side expression sanitizer.
//
// `POST /api/v2/expression` evaluates its input with eval(), behind JWT auth but no role
// option, so every authenticated user reaches it. The guard is a blacklist, and it had a
// hole: the parenthesis rule only asked how the expression STARTED, so once it began with
// `fn.` every parenthesis after that was allowed - which is a route out of the eval.
//
// These tests pin the escapes closed. They deliberately do NOT execute anything: each one
// asserts the sanitizer REFUSES the string. This is a tightened blacklist rather than a
// sandbox, so the tests are about the specific ways out, not about proving safety.
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// The model imports the function libraries and the logger; the sanitizer itself is a pure
// string check, so lift it out of the source rather than dragging that in.
const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, "../src/models/expression.model.js"), "utf8");
const body = /function sanitizeExpression\(expr\)\{[\s\S]*?\n\}/.exec(src)[0];
// stub the logger the body calls
const sanitizeExpression = new Function("logger", `${body}; return sanitizeExpression;`)({
  error: () => {},
});

describe("the sanitizer refuses the ways out of eval", () => {
  test("it was extracted, so these assertions are not vacuous", () => {
    assert.equal(typeof sanitizeExpression, "function");
    assert.equal(sanitizeExpression("1 + 1"), "1 + 1");
  });

  // THE bypass: starting with `fn.` used to unlock every parenthesis after it
  test("dynamic import behind an fn. prefix is refused", () => {
    assert.throws(
      () => sanitizeExpression("fn.env || import('node:child_process').then(m=>m.execSync('id'))"),
      /not allowed|Abuse/
    );
  });

  for (const token of ["import", "require", "process", "globalThis", "constructor",
                       "__proto__", "Function", "eval", "Reflect", "Proxy", "Buffer",
                       "module", "child_process", "fetch"]) {
    test(`'${token}' is refused even after an fn. prefix`, () => {
      assert.throws(() => sanitizeExpression(`fn.x() + ${token}`), /not allowed|Abuse/);
    });
  }

  // the pre-existing rules must keep working
  test("multiline is refused", () => {
    assert.throws(() => sanitizeExpression("fn.a()\nfn.b()"), /multiline|Abuse/);
  });

  test("a second statement is refused", () => {
    assert.throws(() => sanitizeExpression("fn.a(); fn.b()"), /multi expression|Abuse/);
  });

  test("process.env is refused", () => {
    assert.throws(() => sanitizeExpression("process.env.SECRET"), /Abuse|not allowed/);
  });

  test("a call that does not start with fn. is refused", () => {
    assert.throws(() => sanitizeExpression("alert('x')"), /custom functions|Abuse|not allowed/);
  });
});

describe("ordinary expressions still work", () => {
  // the blacklist must not break the documented usage, or every form using a server
  // expression breaks at once
  for (const expr of [
    "fn.now()",
    "fn.upper('hello')",
    "fnc.myCustomFunction('a','b')",
    "1 + 2 * 3",
    "'a' + 'b'",
    "fn.len('abc') > 2",
    "fn.a() ? 'yes' : 'no'",
  ]) {
    test(`accepts ${expr}`, () => {
      assert.equal(sanitizeExpression(expr), expr);
    });
  }

  // quoted strings are stripped before the check, so an innocent word in a literal is fine
  test("a banned word inside a string literal is not a refusal", () => {
    const e = "fn.echo('please import the licence')";
    assert.equal(sanitizeExpression(e), e);
  });
});

// ─── a banned name reached through a STRING property key ──────
//
// The blacklist runs on the literal-stripped text, which is what lets an innocent
// `fn.echo('please import the licence')` through. But a string used as a PROPERTY KEY is
// stripped just the same, so `fn.upper['constructor']('return 1')()` left `fn.upper[]()()`
// - nothing forbidden, starts with `fn.`, both checks satisfied - and the ORIGINAL string
// is what gets evaluated. That is arbitrary code execution behind an endpoint every
// authenticated user can reach.
//
// As everywhere in this file, nothing is executed: each case asserts the sanitizer REFUSES.
describe("property access by string key", () => {
  for (const expr of [
    "fn.upper['constructor']('return 1')()",
    "fn.a() + this['constructor']['constructor']('return 1')()",
    'fn.a()["constructor"]',
    "fn.a()['__proto__']",
    "fn.a()['prototype']['constructor']",
  ]) {
    test(`refuses ${expr}`, () => {
      assert.throws(() => sanitizeExpression(expr), /not allowed|Abuse/);
    });
  }

  test("an ordinary bracket key still works", () => {
    const e = "fn.get('x')['name']";
    assert.equal(sanitizeExpression(e), e);
  });

  test("a banned word inside a DATA string is still fine", () => {
    // the whole reason the blacklist reads the stripped text
    const e = "fn.echo('please import the licence')";
    assert.equal(sanitizeExpression(e), e);
  });
});

describe("every call must be an fn. call, wherever it sits", () => {
  // the old test asked only how the expression STARTED
  for (const expr of [
    "fn.a() + alert('x')",
    "1 + Date.now()",
    "fn.a()()",
    "fn.a()[0]()",
  ]) {
    test(`refuses ${expr}`, () => {
      assert.throws(() => sanitizeExpression(expr), /custom functions|Abuse|not allowed/);
    });
  }

  // ...and stops refusing these, which were always legitimate
  for (const expr of [
    " fn.upper('a')",
    "'x' + fn.upper('a')",
    "fn.a(fn.b(1))",
    "(1 + 2) * 3",
  ]) {
    test(`accepts ${expr}`, () => {
      assert.equal(sanitizeExpression(expr), expr);
    });
  }
});

// ─── template literals / tagged templates ─────────────────────────
//
// The "harmless strings" strip only handled " and ' - it never touched a BACKTICK, so a
// template literal survived into every later check as live code. Two holes, both verified
// against the live endpoint before the fix:
//
//   - `${fn.fnLs}` coerced the function to its SOURCE and returned it (info disclosure);
//   - a TAGGED template is a call WITHOUT a parenthesis, so (s=>s)`x` and [].concat`` ran
//     while the call check - which only looks for `(` - saw nothing, defeating the
//     "every call must be fn./fnc." rule the whole sanitizer exists to enforce.
//
// Template literals are not part of the documented syntax (fn.<name>(...), arithmetic and
// " / ' strings), so they are refused outright. Nothing is executed here - each case
// asserts a refusal, like the rest of this file.
describe("template literals are refused", () => {
  for (const expr of [
    "`${fn.fnLs}`",                 // source disclosure via string coercion
    "`${[].concat``}`",             // a call reached through interpolation
    "(s=>s)`x`",                    // a tagged call on an arbitrary arrow, no parenthesis
    "fn.fnTime`x`",                 // a tagged call on a real function, no parenthesis
    "`plain backtick string`",      // even an innocent one - simpler to forbid the class
    "fn.a() + `${1}`",              // one anywhere in the expression
    "`${this.constructor.constructor('return process')()}`",  // the full escape it enabled
  ]) {
    test(`refuses ${JSON.stringify(expr)}`, () => {
      assert.throws(() => sanitizeExpression(expr), /template literal|Abuse|not allowed/);
    });
  }

  // the refusal comes BEFORE the string strip, so a banned word is not what trips it -
  // the backtick itself is
  test("it is the backtick, not the contents, that is refused", () => {
    assert.throws(() => sanitizeExpression("`hello world`"), /template literal/);
  });

  // and the documented ways of writing a string are untouched
  test("single and double quoted strings still work", () => {
    assert.equal(sanitizeExpression("fn.echo('a') + fn.echo(\"b\")"), "fn.echo('a') + fn.echo(\"b\")");
  });
});
