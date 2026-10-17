// lib/signInGate.js : the last check of a sign-in - refused when an admin blocked the user (a
// local one on its row, an LDAP or SSO one on its record), else an LDAP or SSO user recorded ; a
// block that cannot be read lets it go on. A local user's sign-in going on is written on its row.
import { test, expect, vi, beforeEach } from "vitest";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";

const state = { directoryBlocked: false, localBlocked: false, failRead: false, failWrite: false, recorded: [], localSignIns: [] };
vi.mock("../src/models/directoryUser.model.js", () => ({
  DIRECTORY_TYPES: ["ldap", "azuread", "oidc"],
  default: {
    isBlocked: async () => {
      if (state.failRead) throw new Error("no table");
      return state.directoryBlocked;
    },
    recordSignIn: async (user) => state.recorded.push(user),
  },
}));
vi.mock("../src/models/user.model.js", () => ({
  default: {
    isBlocked: async () => {
      if (state.failRead) throw new Error("no column");
      return state.localBlocked;
    },
    recordSignIn: async (username) => {
      if (state.failWrite) throw new Error("no column");
      state.localSignIns.push(username);
    },
  },
}));
const { admitSignIn } = await import("../src/lib/signInGate.js");

beforeEach(() => {
  Object.assign(state, { directoryBlocked: false, localBlocked: false, failRead: false, failWrite: false, recorded: [], localSignIns: [] });
});

test("an allowed directory user goes on, recorded with what the token does not carry", async () => {
  const ok = await admitSignIn({ type: "oidc", username: "kim", groups: ["oidc/x"] }, { id: "sub-1" });
  expect(ok).toBe(true);
  expect(state.recorded).toEqual([{ type: "oidc", username: "kim", groups: ["oidc/x"], id: "sub-1" }]);
});

test("a blocked directory user is refused, and not recorded", async () => {
  state.directoryBlocked = true;
  expect(await admitSignIn({ type: "ldap", username: "jsmith" })).toBe(false);
  expect(state.recorded).toEqual([]);
});

test("a local user is checked on its own row: a directory block of its name is not its", async () => {
  state.directoryBlocked = true;
  expect(await admitSignIn({ type: "local", username: "jsmith" })).toBe(true);
  state.localBlocked = true;
  expect(await admitSignIn({ type: "local", username: "jsmith" })).toBe(false);
  // a local user has no record to keep : its sign-in is written on its own row, once (not the refused one)
  expect(state.recorded).toEqual([]);
  expect(state.localSignIns).toEqual(["jsmith"]);
});

test("a local sign-in that cannot be written still goes on", async () => {
  state.failWrite = true;
  expect(await admitSignIn({ type: "local", username: "jdoe" })).toBe(true);
  expect(state.localSignIns).toEqual([]);
});

test("a block that cannot be read lets the sign-in go on", async () => {
  state.failRead = true;
  expect(await admitSignIn({ type: "azuread", username: "ana@contoso.com" })).toBe(true);
  expect(await admitSignIn({ type: "local", username: "jdoe" })).toBe(true);
});
