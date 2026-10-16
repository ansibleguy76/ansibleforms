// The disclaimer (models/disclaimer.model.js, Middleware.disclaimerGate) : a user who has not
// accepted its current version gets 403 disclaimer_required everywhere but the disclaimer itself,
// their profile and the live events ; an api token passes ; the address is kept as people write it.
import { test, expect, vi } from "vitest";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";

let required = true;
vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));
vi.mock("../src/models/disclaimer.model.js", async (orig) => ({
  ...(await orig()),
  default: { isRequired: async () => required },
}));
const { default: Middleware } = await import("../src/lib/middleware.js");
const { plainIp } = await vi.importActual("../src/models/disclaimer.model.js");

/**
 * Runs the gate on a request.
 *
 * Args:
 *   req (object): the request : baseUrl, user.
 *
 * Returns:
 *   Promise<object>: { passed, status, body }.
 */
async function gate(req) {
  let out = { passed: false };
  const res = {
    status(code) {
      out.status = code;
      return this;
    },
    json(body) {
      out.body = body;
      return this;
    },
  };
  await Middleware.disclaimerGate({ headers: {}, ...req }, res, () => {
    out.passed = true;
  });
  return out;
}

const user = { user: { username: "jane", type: "local" } };

test("not accepted: refused with its code, but for the disclaimer, the profile and the events", async () => {
  required = true;
  const refused = await gate({ baseUrl: "/api/v2/config", user });
  expect(refused.passed).toBe(false);
  expect(refused.status).toBe(403);
  expect(refused.body.code).toBe("disclaimer_required");
  for (const baseUrl of ["/api/v2/disclaimer", "/api/v2/profile", "/api/v2/events"]) {
    expect((await gate({ baseUrl, user })).passed, baseUrl).toBe(true);
  }
  // the settings page's routes are not the user's own : gated as the rest
  expect((await gate({ baseUrl: "/api/v2/disclaimersettings", user })).passed).toBe(false);
});

test("an api token passes, as an accepted user does", async () => {
  required = true;
  expect((await gate({ baseUrl: "/api/v2/job", user: { ...user, api: true } })).passed).toBe(true);
  required = false;
  expect((await gate({ baseUrl: "/api/v2/job", user })).passed).toBe(true);
});

test("an IPv4 address seen through IPv6 is kept without its prefix", () => {
  expect(plainIp("::ffff:10.0.0.5")).toBe("10.0.0.5");
  expect(plainIp("10.0.0.5")).toBe("10.0.0.5");
  expect(plainIp("2001:db8::1")).toBe("2001:db8::1");
});
