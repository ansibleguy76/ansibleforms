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

describe("a command never runs through a shell", () => {
  test("it is split into its program and arguments, quotes grouping as in sh", () => {
    assert.deepEqual(Cmd.splitCommand(`git -c user.name="Ansible Forms" commit -m 'a b'`), ["git", "-c", "user.name=Ansible Forms", "commit", "-m", "a b"]);
  });

  test("a shell operator is refused, so an argument can never become a second command", () => {
    for (const command of ["git pull; rm -rf /", "mysqldump db > /tmp/x", "a | b", "a && b", "a & b"]) {
      assert.throws(() => Cmd.splitCommand(command), /shell operator/, command);
    }
  });

  test("a $NAME is filled in from the command's own environment only", () => {
    assert.deepEqual(Cmd.splitCommand(`mysql -p"$AF_DB_PASSWORD" -u"$USER"`, { AF_DB_PASSWORD: "p w;$x" }), ["mysql", "-pp w;$x", "-u$USER"]);
  });

  test("a $(...) or a backquote is text, never run", () => {
    assert.deepEqual(Cmd.splitCommand("git clone 'http://h/$(id)`id`.git'"), ["git", "clone", "http://h/$(id)`id`.git"]);
  });
});
