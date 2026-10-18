// The LDAP directories : a member's qualified name, where a typed username is looked up, which
// failures pass to the next server, and a directory's server urls.
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import { DEFAULT_NAME, NAME_RULE, qualify, route, isUnreachable, urls } from "../src/lib/ldapDirectories.js";

const dirs = [
  { name: DEFAULT_NAME, domains: "" },
  { name: "corp", domains: "corp.example, Corp.Local" },
];
const asked = (list) => list.map((x) => `${x.directory.name}:${x.username}`);

describe("qualify", () => {
  test("keeps the default directory's names short", () => {
    assert.equal(qualify({ name: DEFAULT_NAME }, "jane"), "jane");
    assert.equal(qualify(undefined, "Admins"), "Admins");
  });
  test("prefixes any other directory's names", () => {
    assert.equal(qualify({ name: "corp" }, "jane"), "corp/jane");
  });
  test("a '/' in a default directory's name never reads as another directory's member", () => {
    // the default directory's group 'corp/Admins' is not the group Admins of corp
    assert.equal(qualify({ name: DEFAULT_NAME }, "corp/Admins"), "corp%2FAdmins");
    assert.notEqual(qualify({ name: DEFAULT_NAME }, "corp/jane"), qualify({ name: "corp" }, "jane"));
    // another directory's own '/' stays behind its prefix
    assert.equal(qualify({ name: "corp" }, "a/b"), "corp/a/b");
  });
});

describe("route", () => {
  test("a bare username: every directory, in order", () => {
    assert.deepEqual(asked(route("jane", dirs)), [`${DEFAULT_NAME}:jane`, "corp:jane"]);
  });
  test("a directory named first: that one only, whatever the case or the separator", () => {
    assert.deepEqual(asked(route("corp\\jane", dirs)), ["corp:jane"]);
    assert.deepEqual(asked(route("CORP/jane", dirs)), ["corp:jane"]);
  });
  test("a domain a directory owns: that one only, the username as typed", () => {
    assert.deepEqual(asked(route("jane@corp.example", dirs)), ["corp:jane@corp.example"]);
    assert.deepEqual(asked(route("jane@CORP.LOCAL", dirs)), ["corp:jane@CORP.LOCAL"]);
  });
  test("an unknown directory or domain: every directory, the name as typed", () => {
    assert.deepEqual(asked(route("other/jane", dirs)), [`${DEFAULT_NAME}:other/jane`, "corp:other/jane"]);
    assert.deepEqual(asked(route("jane@other.com", dirs)), [`${DEFAULT_NAME}:jane@other.com`, "corp:jane@other.com"]);
  });
});

describe("isUnreachable", () => {
  test("a server not reached passes to the next", () => {
    assert.equal(isUnreachable({ code: "ECONNREFUSED" }), true);
    assert.equal(isUnreachable({ admin: { code: "ENOTFOUND" } }), true);
    assert.equal(isUnreachable(new Error("Connection timeout")), true);
  });
  test("an answer from the server does not", () => {
    assert.equal(isUnreachable(new Error("Invalid Credentials")), false);
    assert.equal(isUnreachable(new Error("Authentication identity not found")), false);
  });
});

describe("urls", () => {
  test("one or more servers, each with the directory's scheme and port unless it says its own", () => {
    assert.deepEqual(urls({ server: "dc1", port: 389, enable_tls: 0 }), ["ldap://dc1:389"]);
    assert.deepEqual(urls({ server: "dc1, dc2:3269 ldaps://dc3:636", port: 636, enable_tls: 1 }), [
      "ldaps://dc1:636",
      "ldaps://dc2:3269",
      "ldaps://dc3:636",
    ]);
    assert.deepEqual(urls({ server: "", port: 389 }), []);
  });
});

describe("NAME_RULE", () => {
  test("letters, digits, - and _: nothing that would break a member's name", () => {
    assert.equal(NAME_RULE.test("corp-eu_2"), true);
    assert.equal(NAME_RULE.test("corp/eu"), false);
    assert.equal(NAME_RULE.test("corp eu"), false);
    assert.equal(NAME_RULE.test(""), false);
  });
});
