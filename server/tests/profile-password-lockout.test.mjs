// A wrong current password on the password change counts as a failed login : a session cannot be
// used to guess it past the account lockout (lib/loginThrottle.js), and a locked account is
// refused before the password is checked.
import { describe, test, expect, vi, beforeEach } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

const state = vi.hoisted(() => ({ blocked: false, failed: [], succeeded: [], checked: 0, updated: 0 }));
vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [], tryDo: async () => [] } }));
vi.mock("../src/lib/loginThrottle.js", () => ({
  loginBlocked: async () => (state.blocked ? { blocked: true, minutes: 3 } : { blocked: false }),
  loginFailed: async (username, ip) => state.failed.push([username, ip]),
  loginSucceeded: async (username) => state.succeeded.push(username),
  unlockAccount: async () => {},
}));
vi.mock("../src/models/user.model.js", () => ({
  default: {
    authenticate: async (_username, password) => {
      state.checked++;
      return { isValid: password === "Right-Password-1" };
    },
    update: async () => {
      state.updated++;
    },
  },
}));
vi.mock("../src/models/audit.model.js", () => ({ default: { log: () => {} } }));
vi.mock("../src/lib/i18n.js", () => ({ default: { t: (_req, key) => key } }));
vi.mock("../src/lib/tokenRevocation.js", () => ({ revokeUser: async () => {} }));
vi.mock("../src/models/token.model.js", () => ({ default: { deleteAllForUser: async () => {} } }));

const { default: controller } = await import("../src/controllers/v2/user.controller.js");

/** A password change by the signed-in local user ann, and its response. */
async function change(currentPassword) {
  const req = {
    ip: "10.0.0.9",
    user: { user: { id: 3, username: "ann", type: "local" } },
    body: { password: "A-New-Password-2026", currentPassword },
    headers: {},
  };
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  await controller.changePassword(req, res);
  return res;
}

beforeEach(() => {
  Object.assign(state, { blocked: false, failed: [], succeeded: [], checked: 0, updated: 0 });
});

describe("the current password on a password change", () => {
  test("a wrong one is a failed login of the account, from its address", async () => {
    const res = await change("wrong");
    expect(res.statusCode).toBe(403);
    expect(state.failed).toEqual([["ann", "10.0.0.9"]]);
    expect(state.updated).toBe(0);
  });

  test("a locked account is refused before the password is checked, with when to try again", async () => {
    state.blocked = true;
    const res = await change("Right-Password-1");
    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBe("180");
    expect(state.checked).toBe(0);
    expect(state.updated).toBe(0);
  });

  test("the right one clears the count and changes the password", async () => {
    const res = await change("Right-Password-1");
    expect(res.statusCode).toBe(200);
    expect(state.succeeded).toEqual(["ann"]);
    expect(state.failed).toEqual([]);
    expect(state.updated).toBe(1);
  });
});
