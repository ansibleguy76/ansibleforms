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

  test("the expression branch uses a function replacement", () => {
    assert.match(fn, /value\?\.replace\(new RegExp\([^)]*\),\s*\(\)\s*=>\s*literal\)/);
  });

  test("the plain branch uses a function replacement", () => {
    assert.match(fn, /value\?\.replace\(foundmatch,\s*\(\)\s*=>\s*fieldvalue\)/);
  });

  test("the regex-escape above it still uses $& deliberately", () => {
    // that one IS a replacement pattern and must not be "fixed" along with the others
    assert.match(fn, /replace\(\/\[\.\*\+\?\^\$\{\}\(\)\|\[\\\]\\\\\]\/g, '\\\\\$&'\)/);
  });
});
