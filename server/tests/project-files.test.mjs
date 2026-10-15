// The designer's playbooks and vars files : the paths a request may name never leave their
// folder, and only text files open in the editor.
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import { safeRelativePath, isInside, isTextBuffer, textHas } from "../src/lib/projectFiles.js";

describe("safeRelativePath", () => {
  test("keeps a plain path, normalized", () => {
    assert.equal(safeRelativePath("site.yml"), "site.yml");
    assert.equal(safeRelativePath("/roles//web/tasks/main.yml"), "roles/web/tasks/main.yml");
    assert.equal(safeRelativePath("group_vars/all.yaml"), "group_vars/all.yaml");
  });
  test("refuses a way out of the folder", () => {
    for (const bad of ["../etc/passwd", "a/../../b", "a/./b", "..", "a\\b", "a\0b"]) {
      assert.throws(() => safeRelativePath(bad), /not a valid file path/, bad);
    }
  });
  test("refuses a hidden segment", () => {
    assert.throws(() => safeRelativePath(".git/config"));
    assert.throws(() => safeRelativePath("a/.env"));
  });
  test("refuses an empty or missing path", () => {
    assert.throws(() => safeRelativePath(""), /required/);
    assert.throws(() => safeRelativePath("  "), /required/);
    assert.throws(() => safeRelativePath(undefined), /required/);
  });
});

describe("isInside", () => {
  test("below the folder only", () => {
    assert.equal(isInside("/r", "/r/a/b"), true);
    assert.equal(isInside("/r", "/r"), false);
    assert.equal(isInside("/r", "/rx/a"), false);
    assert.equal(isInside("/r", "/a"), false);
  });
});

describe("isTextBuffer", () => {
  test("a NUL byte makes it binary", () => {
    assert.equal(isTextBuffer(Buffer.from("- hosts: all\n")), true);
    assert.equal(isTextBuffer(Buffer.from([0x50, 0x00, 0x51])), false);
  });
});

// the designer's search in the files' text
describe("textHas", () => {
  test("finds a term whatever its case", () => {
    assert.equal(textHas("hosts: Postgres_servers\n", "postgres"), true);
    assert.equal(textHas("- name: install", "NAME"), true);
  });
  test("finds nothing for an absent or empty term", () => {
    assert.equal(textHas("hosts: web", "db"), false);
    assert.equal(textHas("hosts: web", ""), false);
    assert.equal(textHas(null, "web"), false);
  });
});
