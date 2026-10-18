// API tokens made from a session (#1068) : an SSO user has no password to sign in again with, so a
// signed-in user makes one from their session, with the rules of one made with a password, a
// sign-in a few minutes old at most, and never from an api token. Each one is listed for its user
// and an admin, and revoked one by one.
import { describe, test, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
process.env.API_TOKEN_MAX_DAYS = "90";

// the api_tokens table in memory, and the sessions revoked
const db = vi.hoisted(() => ({ apiTokens: new Map(), revoked: new Map(), users: new Map() }));
vi.mock("../src/models/db.model.js", () => ({
  default: {
    do: async (sql, params) => {
      if (/INSERT INTO AnsibleForms.`api_tokens`/.test(sql)) {
        const [sid, username, username_type, name, created_at, expires_at] = params;
        db.apiTokens.set(sid, { sid, username, username_type, name, created_at, expires_at, last_used_at: null });
        return {};
      }
      if (/SELECT sid, username, username_type, name/.test(sql)) {
        const [type, username] = params;
        return [...db.apiTokens.values()]
          .filter((r) => r.username_type === type && r.username === username && r.expires_at > new Date())
          .sort((a, b) => b.created_at - a.created_at);
      }
      if (/SELECT sid, expires_at FROM/.test(sql)) {
        const [sid, type, username] = params;
        const row = db.apiTokens.get(sid);
        return row && row.username_type === type && row.username === username ? [{ sid, expires_at: row.expires_at }] : [];
      }
      if (/DELETE FROM AnsibleForms.`api_tokens` WHERE sid/.test(sql)) {
        db.apiTokens.delete(params[0]);
        return {};
      }
      if (/FROM AnsibleForms.`users`/.test(sql)) {
        const user = db.users.get(String(params?.[0] ?? params));
        return user ? [user] : [];
      }
      return [];
    },
    tryDo: async () => [],
  },
}));
vi.mock("../src/lib/tokenRevocation.js", () => ({
  newSessionId: () => crypto.randomUUID(),
  isRevoked: async (p) => db.revoked.has(p.sid),
  revokeSession: async (sid, until) => db.revoked.set(sid, until),
  consumeOnce: async () => true,
}));
vi.mock("../src/models/audit.model.js", () => ({ default: { log: async () => {} } }));
vi.mock("../src/lib/i18n.js", () => ({ default: { t: (_req, key) => key } }));
vi.mock("../src/services/cron.service.js", () => ({ default: { removeSchedule: () => {}, addSchedule: () => {} } }));
vi.mock("../src/models/job.model.js", () => ({ default: { launch: async () => ({ id: 1 }) }, guardLaunch: async () => {} }));
vi.mock("../src/models/token.model.js", () => ({ default: { store: async () => {} } }));
vi.mock("../src/lib/userGroups.js", () => ({
  storedGroups: async () => [],
  withGroups: async (u) => u,
  tokenUser: (user) => ({ username: user.username, type: user.type, roles: user.roles, options: user.options }),
  forgetGroups: () => {},
}));
vi.mock("../src/lib/adminGrants.js", () => ({
  // the requests here are an admin's unless a test refuses it (refuseAdmin)
  isAdminRequest: (req) => !req.refuseAdmin,
  assertMayTouchAdmin: async (req) => {
    if (req.refuseAdmin) {
      const { default: Errors } = await import("../src/lib/errors.js");
      throw new Errors.AccessDeniedError("Only an admin can change, reset or delete an admin account");
    }
  },
}));
vi.mock("../src/models/user.model.js", () => ({
  default: {
    findById: async (id) => {
      const { default: Errors } = await import("../src/lib/errors.js");
      if (String(id) === "7") return { id: 7, username: "scripter" };
      throw new Errors.NotFoundError(`No user ${id}`);
    },
  },
}));

const { default: authConfig } = await import("../config/auth.config.js");
const { default: controller, signedInRecently, RECENT_SIGN_IN_SECONDS } = await import("../src/controllers/v2/apiToken.controller.js");

const now = () => Math.floor(Date.now() / 1000);
const sso = { username: "ana@example.com", type: "azuread", roles: ["public"], options: { extendedTokenExpiration: true } };

/** A request of a signed-in session, and its response. */
function call(handler, { user = sso, authTime = now(), api = false, body = {}, params = {}, extra = {} } = {}) {
  const req = { user: { user, access: true, sid: "browser-session", auth_time: authTime, ...(api ? { api: true } : {}) }, body, params, query: {}, headers: {}, ...extra };
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return handler(req, res).then(() => res);
}

beforeEach(() => {
  db.apiTokens.clear();
  db.revoked.clear();
});

describe("signedInRecently", () => {
  test("within the window, not before it nor without a time", () => {
    const t = Date.now();
    expect(signedInRecently(Math.floor(t / 1000) - 60, t)).toBe(true);
    expect(signedInRecently(Math.floor(t / 1000) - RECENT_SIGN_IN_SECONDS - 5, t)).toBe(false);
    expect(signedInRecently(undefined, t)).toBe(false);
    expect(signedInRecently(0, t)).toBe(false);
  });
});

describe("making a token from a session", () => {
  test("an SSO user signed in a moment ago gets one, a session of its own, listed for them", async () => {
    const res = await call(controller.create, { body: { expiryDays: 30, name: "ci" } });
    expect(res.statusCode).toBe(200);
    const payload = jwt.verify(res.body.token, authConfig.secret);
    expect(payload).toMatchObject({ access: true, api: true, user: { username: sso.username, type: "azuread" } });
    expect(payload.sid).not.toBe("browser-session");
    expect(payload.exp - payload.iat).toBe(30 * 86400);
    expect(new Date(res.body.expires_at).getTime()).toBe(payload.exp * 1000);
    expect([...db.apiTokens.values()]).toEqual([
      expect.objectContaining({ sid: payload.sid, username: sso.username, username_type: "azuread", name: "ci" }),
    ]);
  });

  test("the lifetime is capped at API_TOKEN_MAX_DAYS", async () => {
    const res = await call(controller.create, { body: { expiryDays: 3650 } });
    const payload = jwt.decode(res.body.token);
    expect(payload.exp - payload.iat).toBe(authConfig.apiTokenMaxDays * 86400);
  });

  test("a sign-in too long ago, or a session from before the sign-in time was kept: sign in again", async () => {
    for (const authTime of [now() - RECENT_SIGN_IN_SECONDS - 30, null]) {
      const res = await call(controller.create, { authTime, body: { expiryDays: 30 } });
      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe("sign_in_again");
    }
    expect(db.apiTokens.size).toBe(0);
  });

  test("an api token cannot make another", async () => {
    const res = await call(controller.create, { api: true, body: { expiryDays: 30 } });
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("api_token_session");
  });

  test("a role without extendedTokenExpiration gets none", async () => {
    const res = await call(controller.create, { user: { ...sso, options: {} }, body: { expiryDays: 30 } });
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("not_allowed");
  });

  test("a lifetime that is not a number of days is refused", async () => {
    for (const expiryDays of [undefined, "abc", 0, -3]) {
      const res = await call(controller.create, { body: { expiryDays } });
      expect(res.statusCode).toBe(400);
    }
  });
});

describe("listing and revoking", () => {
  test("a user sees and revokes their own tokens, not another's", async () => {
    const made = await call(controller.create, { body: { expiryDays: 30, name: "mine" } });
    const sid = jwt.decode(made.body.token).sid;
    const other = await call(controller.create, { user: { ...sso, username: "bob@example.com" }, body: { expiryDays: 30 } });
    const otherSid = jwt.decode(other.body.token).sid;

    const list = await call(controller.findMine);
    expect(list.body.records.map((r) => r.sid)).toEqual([sid]);

    expect((await call(controller.revokeMine, { params: { sid: otherSid } })).statusCode).toBe(404);
    expect(db.revoked.has(otherSid)).toBe(false);

    const revoked = await call(controller.revokeMine, { params: { sid } });
    expect(revoked.statusCode).toBe(200);
    // its session ends until the token would have expired anyway
    expect(db.revoked.get(sid)).toBe(jwt.decode(made.body.token).exp * 1000);
    expect((await call(controller.findMine)).body.records).toEqual([]);
  });

  test("a token ended another way (a password change, a block) is no longer listed", async () => {
    const made = await call(controller.create, { body: { expiryDays: 30 } });
    db.revoked.set(jwt.decode(made.body.token).sid, Date.now() + 1000);
    expect((await call(controller.findMine)).body.records).toEqual([]);
  });

  test("an admin lists and revokes a directory user's tokens", async () => {
    const made = await call(controller.create, { body: { expiryDays: 30 } });
    const sid = jwt.decode(made.body.token).sid;
    const params = { type: "azuread", name: sso.username };
    const list = await call(controller.findForUser, { user: { username: "admin", type: "local" }, params });
    expect(list.body.records.map((r) => r.sid)).toEqual([sid]);
    const revoked = await call(controller.revokeForUser, { user: { username: "admin", type: "local" }, params: { ...params, sid } });
    expect(revoked.statusCode).toBe(200);
    expect(db.revoked.has(sid)).toBe(true);
    expect((await call(controller.findForUser, { params: { type: "nope", name: "x" } })).statusCode).toBe(400);
  });

  test("a local user's tokens by its id: an admin account's only for an admin, an unknown id is 404", async () => {
    const made = await call(controller.create, { user: { username: "scripter", type: "local", options: { extendedTokenExpiration: true } }, body: { expiryDays: 5 } });
    const sid = jwt.decode(made.body.token).sid;
    const list = await call(controller.findForUser, { params: { id: "7" } });
    expect(list.body.records.map((r) => r.sid)).toEqual([sid]);
    expect((await call(controller.findForUser, { params: { id: "7" }, extra: { refuseAdmin: true } })).statusCode).toBe(403);
    expect((await call(controller.findForUser, { params: { id: "99" } })).statusCode).toBe(404);
  });
});
