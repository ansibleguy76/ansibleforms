// Settings > Connections > SSH : a host's keys are scanned with ssh-keyscan. The host was put in a
// shell command as typed, so a role with the connections settings could run any command on the
// server through it. It is now checked, and ssh-keyscan runs without a shell.
import { test, describe } from "vitest";
import assert from "node:assert/strict";

const KnownHosts = (await import("../src/models/knownhosts.model.js")).default;

describe("a host to scan is a host name or an address, nothing more", () => {
  test("a command, an option or a space is refused before anything runs", async () => {
    for (const host of ["github.com; touch /tmp/pwned", "$(id)", "`id`", "-oProxyCommand=id", "a b", "host|id"]) {
      await assert.rejects(KnownHosts.add(host), /Invalid host/, host);
    }
  });
});
