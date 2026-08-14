// String.prototype.replace reads its REPLACEMENT for special patterns when that
// replacement is a string: $& is the matched text, $` and $' the text around it, $1 a
// capture group. So pasting user data in as a string replacement silently rewrites it.
//
// Two places did this with values that are genuinely user-controlled: the notification
// mail renderer (a job name, a message, the run details) and the client's placeholder
// substitution. A function replacement is not scanned for those patterns, which is the fix.
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("the semantics being guarded against", () => {
  // not testing our code - pinning WHY the fix is shaped the way it is, so a future
  // reader does not "simplify" the function replacements back into strings
  test("a string replacement expands $&", () => {
    assert.equal("a ${x} b".replace("${x}", "$&"), "a ${x} b");
    assert.equal("hello".replace("hello", "[$&]"), "[hello]");
  });

  test("a function replacement does not", () => {
    assert.equal("hello".replace("hello", () => "[$&]"), "[$&]");
  });

  test("$` and $' pull in the surrounding text", () => {
    assert.equal("ab".replace("b", "$`"), "aa");
    assert.equal("ab".replace("a", "$'"), "bb");
  });
});

describe("the mail template renderer inserts values verbatim", () => {
  const src = readFileSync(path.join(here, "../src/models/job.model.js"), "utf8");
  // the block that renders the notification template
  const start = src.indexOf('.replace("${message}"');
  const block = src.slice(start, src.indexOf(";", src.indexOf("${runDetails}", start)));

  test("the block was found, so these assertions are not vacuous", () => {
    assert.ok(block.includes("${buttonLabel}"), "should be the template replacement chain");
  });

  test("every placeholder replacement is a function, not a raw value", () => {
    // capture the second argument of each .replace/.replaceAll in the chain
    const args = [...block.matchAll(/\.replace(?:All)?\("\$\{[^}]+\}",\s*([^)]*)\)/g)]
      .map((m) => m[1].trim());
    assert.ok(args.length >= 12, `expected the whole chain, found ${args.length}`);
    for (const a of args) {
      assert.match(a, /^lit\(/,
        `replacement ${a} is inserted as a string, so $& in it would be re-interpreted`);
    }
  });
});

describe("the client's placeholder substitution inserts values verbatim", () => {
  const vue = readFileSync(path.join(here, "../../client/src/components/AppForm.vue"), "utf8");
  const fn = vue.slice(vue.indexOf("if (mode === 'expression'"), vue.indexOf("hasPlaceholders = true"));

  test("the block was found, so these assertions are not vacuous", () => {
    assert.ok(fn.includes("stringifyValue"), "should be the substitution branch");
  });

  test("the expression branch delegates to the helper", () => {
    // what it does with the value depends on where the placeholder sits (inside a string
    // literal, wrapped in quotes, or bare) - client/tests/expression-placeholders.test.js
    // covers that; here we only pin that this branch does not paste the value in itself
    assert.match(fn, /value\s*=\s*Helpers\.substituteExpressionPlaceholder\(/);
    assert.doesNotMatch(fn.slice(0, fn.indexOf("} else {")), /\.replace\(/,
      "the expression branch must not paste a value in through String.replace");
  });

  test("the plain branch uses a function replacement", () => {
    assert.match(fn, /value\?\.replace\(foundmatch,\s*\(\)\s*=>\s*fieldvalue\)/);
  });

  test("the helper splices by index rather than by replacement", () => {
    // slice concatenation cannot re-interpret $& , $1 or $` in a value at all, which is
    // why the regex the expression branch used to build is gone
    const helpers = readFileSync(path.join(here, "../../client/src/lib/Helpers.js"), "utf8");
    const start = helpers.indexOf("substituteExpressionPlaceholder(");
    assert.ok(start > -1, "helper not found, so this assertion would be vacuous");
    const body = helpers.slice(start, helpers.indexOf("quoteContextAt(expression, index)", start));
    assert.match(body, /expression\.slice\(0, at\)\s*\+/);
    assert.doesNotMatch(body, /expression\.replace\(/,
      "a value must never be handed to String.replace as a string replacement");
  });
});
