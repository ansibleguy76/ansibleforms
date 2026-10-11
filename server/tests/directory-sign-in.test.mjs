// lib/directorySignIn.js : the last check of an LDAP or SSO sign-in - refused when an admin blocked
// the user, else recorded ; a local user untouched, a block that cannot be read lets it go on.
import { test, expect, vi, beforeEach } from "vitest";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";

const state = { blocked: false, failRead: false, recorded: [] };
vi.mock("../src/models/directoryUser.model.js", () => ({
  DIRECTORY_TYPES: ["ldap", "azuread", "oidc"],
  default: {
    isBlocked: async () => {
      if (state.failRead) throw new Error("no table");
      return state.blocked;
    },
    recordSignIn: async (user) => state.recorded.push(user),
  },
}));
const { admitDirectorySignIn } = await import("../src/lib/directorySignIn.js");

beforeEach(() => {
  state.blocked = false;
  state.failRead = false;
  state.recorded = [];
});

test("an allowed directory user goes on, recorded with what the token does not carry", async () => {
  const ok = await admitDirectorySignIn({ type: "oidc", username: "kim", groups: ["oidc/x"] }, { id: "sub-1" });
  expect(ok).toBe(true);
  expect(state.recorded).toEqual([{ type: "oidc", username: "kim", groups: ["oidc/x"], id: "sub-1" }]);
});

test("a blocked directory user is refused, and not recorded", async () => {
  state.blocked = true;
  expect(await admitDirectorySignIn({ type: "ldap", username: "jsmith" })).toBe(false);
  expect(state.recorded).toEqual([]);
});

test("a local user passes untouched, even when a directory user of its name is blocked", async () => {
  state.blocked = true;
  expect(await admitDirectorySignIn({ type: "local", username: "jsmith" })).toBe(true);
  expect(state.recorded).toEqual([]);
});

test("a block that cannot be read lets the sign-in go on", async () => {
  state.failRead = true;
  expect(await admitDirectorySignIn({ type: "azuread", username: "ana@contoso.com" })).toBe(true);
  expect(state.recorded.length).toBe(1);
});
