// A command's output can carry the address it was given with its user and password (git writes
// it in its errors) : lib/cmd.js masks them before the output is logged, shown or thrown.
import { test, describe } from "vitest";
import assert from "node:assert/strict";

const Cmd = (await import("../src/lib/cmd.js")).default;

describe("a command's output never carries an address's password", () => {
  test("git's error with a token in the address", () => {
    assert.equal(
      Cmd.maskUrlCredentials("fatal: unable to access 'https://bob:ghp_abc/123@github.com/x/y.git/': 403"),
      "fatal: unable to access 'https://bob:*******@github.com/x/y.git/': 403",
    );
  });

  test("every address of a text, any scheme", () => {
    assert.equal(Cmd.maskUrlCredentials("http://a:b@c and ssh://u:p@h"), "http://a:*******@c and ssh://u:*******@h");
  });

  test("addresses without a password are left as they are", () => {
    for (const text of ["git@github.com:x/y.git", "https://github.com/x", "https://user@host/x", ""]) {
      assert.equal(Cmd.maskUrlCredentials(text), text);
    }
  });
});
