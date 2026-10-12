// fn.fnSort with the flat array sorting object {'':{...}} : the empty key used to become
// property 0, so strings were compared on their first character only and numbers
// (where 5[0] is undefined) were not sorted at all.
import { test, describe } from "vitest";
import assert from "node:assert/strict";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

const { default: fn } = await import("../src/functions/default.js");

describe("fnSort on a flat array", () => {
  test("strings sort on the full value, not the first character", () => {
    assert.deepEqual(fn.fnSort(["ab", "aa", "b", "ac"], { "": {} }), ["aa", "ab", "ac", "b"]);
  });

  test("the documented example sorts ascending", () => {
    assert.deepEqual(fn.fnSort(["a", "b", "z", "q", "c"], { "": { direction: "asc" } }), ["a", "b", "c", "q", "z"]);
  });

  test("numbers sort numerically", () => {
    assert.deepEqual(fn.fnSort([10, 2, 33, 1, 0], { "": {} }), [0, 1, 2, 10, 33]);
  });

  test("direction desc reverses the order", () => {
    assert.deepEqual(fn.fnSort([10, 2, 33, 1], { "": { direction: "desc" } }), [33, 10, 2, 1]);
    assert.deepEqual(fn.fnSort(["ab", "aa", "b"], { "": { direction: "desc" } }), ["b", "ab", "aa"]);
  });

  test("ignoreCase is honoured", () => {
    assert.deepEqual(fn.fnSort(["b", "C", "a"], { "": { ignoreCase: true } }), ["a", "b", "C"]);
  });
});

describe("fnSort on objects", () => {
  test("a property sort is unchanged", () => {
    const rows = [{ n: "ab", e: 2 }, { n: "aa", e: 1 }, { n: "ab", e: 1 }];
    assert.deepEqual(fn.fnSort(rows, ["n", { e: { direction: "desc" } }]), [{ n: "aa", e: 1 }, { n: "ab", e: 2 }, { n: "ab", e: 1 }]);
  });
});
