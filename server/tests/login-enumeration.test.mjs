// The login response used to carry the internal reason for the failure.
//
// passport's local strategy says "user not found" for an unknown name and something else
// for a wrong password, and that string was handed straight back to the caller - so the
// login form answered "does this username exist?" to anyone who asked. The ldap branch
// was worse: its message can carry bind failures and server names.
//
// The reason is still logged and still recorded in the audit trail. Only the HTTP
// response is generic.
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, "../src/controllers/v2/login.controller.js"), "utf8");

// the two places that answer a failed credential check
const localBranch = src.slice(src.indexOf("auditLogin(req, 'failure', 'local'"), src.indexOf("// we found a user"));
const ldapBranch = src.slice(src.indexOf("auditLogin(req, 'failure', 'ldap'"), src.indexOf("// we found a user", src.indexOf("auditLogin(req, 'failure', 'ldap'")));

describe.each([
  ["local", () => localBranch],
  ["ldap", () => ldapBranch],
])("the %s failure answer is generic", (name, get) => {
  const branch = get();

  test("the branch was found, so these assertions are not vacuous", () => {
    assert.ok(branch.length > 80, `${name} branch not located`);
    assert.match(branch, /res\.status\(401\)/);
  });

  test("the response body is the translated generic message only", () => {
    const answer = branch.slice(branch.indexOf("res.status(401)"));
    assert.match(answer, /RestResult\.error\(\s*i18n\.t\(req, 'auth\.authFailed'\),\s*i18n\.t\(req, 'auth\.invalidCredentials'\)\s*\)/,
      "a raw reason string in the detail is the enumeration oracle");
  });

  test("no internal reason variable reaches the response", () => {
    const answer = branch.slice(branch.indexOf("res.status(401)"));
    for (const leak of ["errorMessage", "reason", " e "]) {
      assert.ok(!answer.includes(leak), `'${leak}' must not be sent to the caller`);
    }
  });

  test("the reason is still kept server side", () => {
    // it must not simply be discarded : an operator has to be able to tell an unknown
    // user from a wrong password, and from an ldap that is misconfigured
    assert.match(branch, /logger\.debug\(/, "the reason must still be logged");
    assert.match(branch, /auditLogin\(/, "and still recorded in the audit trail");
  });
});

describe("401 is correct here", () => {
  test("a failed credential check is an authentication failure, not a permission one", () => {
    // the opposite of the 403 rule : this really is "I could not establish who you are",
    // so the global axios interceptor clearing the session is the right behaviour
    assert.match(localBranch, /res\.status\(401\)/);
    assert.match(ldapBranch, /res\.status\(401\)/);
  });
});
