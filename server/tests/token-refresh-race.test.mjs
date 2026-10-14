// Refreshes that race (#1062) : when an access token expires a page has several requests in
// flight, and other tabs share its tokens, so several refreshes arrive with the same single-use
// refresh token. One rotates it ; the others are told it was just replaced (409), are not logged
// as errors, and the token replaced stays refused once the grace is over.
import { describe, test, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

// the tokens table in memory : refresh token -> the time it was replaced (null while current),
// with a clock the tests move
const db = vi.hoisted(() => ({ tokens: new Map(), now: 0, failInsert: false }));
vi.mock("../src/models/db.model.js", () => ({
  default: {
    do: async (sql, params) => {
      // a query that yields : two refreshes interleave as they would on a real database
      await new Promise((resolve) => setImmediate(resolve));
      if (/INSERT INTO AnsibleForms.`tokens`/.test(sql)) {
        if (db.failInsert) throw new Error("insert failed");
        db.tokens.set(params.refresh_token, null);
        return {};
      }
      if (/SELECT replaced_at IS NULL AS current/.test(sql)) {
        const [grace, , , token] = params;
        if (!db.tokens.has(token)) return [];
        const replaced = db.tokens.get(token);
        return [{ current: replaced === null ? 1 : 0, recent: replaced !== null && replaced > db.now - grace * 1000 ? 1 : 0 }];
      }
      if (/SET replaced_at=UTC_TIMESTAMP\(\)/.test(sql)) {
        if (db.tokens.get(params[2]) !== null) return { affectedRows: 0 };
        db.tokens.set(params[2], db.now);
        return { affectedRows: 1 };
      }
      if (/SET replaced_at=NULL/.test(sql)) {
        db.tokens.set(params[2], null);
        return { affectedRows: 1 };
      }
      if (/DELETE FROM AnsibleForms.`tokens` .*replaced_at </.test(sql)) {
        for (const [token, replaced] of db.tokens) if (replaced !== null && replaced < db.now - params[2] * 1000) db.tokens.delete(token);
        return {};
      }
      if (/DELETE FROM AnsibleForms.`tokens`/.test(sql)) {
        db.tokens.delete(params[2]);
        return {};
      }
      return [];
    },
    tryDo: async () => [],
  },
}));
vi.mock("../src/lib/tokenRevocation.js", () => ({ isRevoked: async () => false }));
vi.mock("../src/lib/i18n.js", () => ({ default: { t: (_req, key) => key } }));
vi.mock("../src/lib/userGroups.js", () => ({
  storedGroups: async () => [],
  tokenUser: (user) => ({ username: user.username, type: user.type }),
  forgetGroups: () => {},
}));
vi.mock("../src/models/user.model.js", () => ({ default: { getRolesAndOptions: async () => ({ roles: ["public"], options: {} }) } }));
// the model's logger is the shared mock (vitest.config.js), the controller's the real module : both
// the same spies
const log = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), notice: vi.fn(), warning: vi.fn(), error: vi.fn(), warn: vi.fn() }));
vi.mock("./__mocks__/logger.js", () => ({ default: log }));
vi.mock("../src/lib/logger.js", () => ({ default: log }));

const tokenController = (await import("../src/controllers/v2/token.controller.js")).default;
const authConfig = (await import("../config/auth.config.js")).default;
const Token = (await import("../src/models/token.model.js")).default;
const logger = log;

let counter = 0;
// a refresh token of bob's, stored as the login stores it
function loginToken() {
  const token = jwt.sign({ user: { username: "bob", type: "azuread" }, refresh: true, sid: "s1", n: ++counter }, authConfig.secret, {
    expiresIn: "1h",
    issuer: authConfig.jwtIssuer,
  });
  db.tokens.set(token, null);
  return token;
}

async function refresh(refreshtoken) {
  const r = { statusCode: 200, body: undefined };
  r.status = (code) => ((r.statusCode = code), r);
  r.json = (body) => ((r.body = body), r);
  await tokenController.refresh({ body: { refreshtoken } }, r);
  return r;
}

beforeEach(() => {
  db.tokens.clear();
  db.now = Date.now();
  db.failInsert = false;
  Object.values(logger).forEach((fn) => fn.mockClear());
});

describe("refreshes with the same token at once", () => {
  test("one rotates it, the others get a 409 with its code, and nothing is logged as an error", async () => {
    const token = loginToken();
    const results = await Promise.all([refresh(token), refresh(token), refresh(token), refresh(token)]);
    const ok = results.filter((r) => r.statusCode === 200);
    const replaced = results.filter((r) => r.statusCode === 409);
    expect(ok).toHaveLength(1);
    expect(replaced).toHaveLength(3);
    for (const r of replaced) expect(r.body.code).toBe("refresh_token_replaced");
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.info.mock.calls.map((c) => c[0]).join("\n")).toContain("refreshed by a concurrent request");
  });

  test("the new refresh token works, the one it replaced is marked, not deleted", async () => {
    const token = loginToken();
    const first = await refresh(token);
    expect(first.statusCode).toBe(200);
    expect(db.tokens.get(token)).not.toBeNull();
    expect((await refresh(first.body.refreshtoken)).statusCode).toBe(200);
  });
});

describe("a token used again", () => {
  test("inside the grace : 409", async () => {
    const token = loginToken();
    await refresh(token);
    db.now += (Token.REPLACED_GRACE_SECONDS - 5) * 1000;
    expect((await refresh(token)).statusCode).toBe(409);
  });

  test("after the grace : 401 as unknown, logged as a warning, not an error", async () => {
    const token = loginToken();
    await refresh(token);
    db.now += (Token.REPLACED_GRACE_SECONDS + 5) * 1000;
    const r = await refresh(token);
    expect(r.statusCode).toBe(401);
    expect(r.body.error).toBe("errors.refreshTokenUnknown");
    expect(logger.warning).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("the user's tokens replaced past the grace are removed at the next rotation", async () => {
    const old = loginToken();
    const next = (await refresh(old)).body.refreshtoken;
    db.now += (Token.REPLACED_GRACE_SECONDS + 5) * 1000;
    await refresh(next);
    expect(db.tokens.has(old)).toBe(false);
  });

  test("a token never stored : 401, a warning", async () => {
    const token = jwt.sign({ user: { username: "bob", type: "local" }, refresh: true, sid: "s1" }, authConfig.secret, { issuer: authConfig.jwtIssuer });
    const r = await refresh(token);
    expect(r.statusCode).toBe(401);
    expect(logger.warning).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });
});

test("a refresh in the same second as the token it replaces still signs a token of its own", async () => {
  const token = jwt.sign({ user: { username: "bob", type: "azuread" }, refresh: true, sid: "s1" }, authConfig.secret, { issuer: authConfig.jwtIssuer });
  db.tokens.set(token, null);
  const r = await refresh(token);
  expect(r.statusCode).toBe(200);
  expect(r.body.refreshtoken).not.toBe(token);
  // the second one carries the same user, roles and second as the first
  const again = await refresh(r.body.refreshtoken);
  expect(again.statusCode).toBe(200);
  expect(again.body.refreshtoken).not.toBe(r.body.refreshtoken);
});

test("a new token that cannot be stored gives the old one back", async () => {
  const token = loginToken();
  db.failInsert = true;
  expect((await refresh(token)).statusCode).toBe(401);
  expect(db.tokens.get(token)).toBeNull();
  db.failInsert = false;
  expect((await refresh(token)).statusCode).toBe(200);
});
