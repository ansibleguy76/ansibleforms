// The profile routes that check a password or hand out a token answer 429 above AUTH_RATE_LIMIT
// requests a minute from one address, as the sign-in does ; reading the profile is not limited.
import { describe, test, expect, vi, beforeAll, afterAll } from "vitest";
import express from "express";

const ok = (_req, res) => res.json({ ok: true });
vi.mock("../src/controllers/v2/user.controller.js", () => ({ default: { find: ok, changePassword: ok } }));
vi.mock("../src/controllers/v2/apiToken.controller.js", () => ({ default: { findMine: ok, create: ok, revokeMine: ok } }));

const { default: router } = await import("../src/routes/v2/profile.routes.js");
// the tests' app config (tests/__mocks__/app.config.js) ; the limiter reads it per request
const { default: appConfig } = await import("./__mocks__/app.config.js");

let server;
let base;
beforeAll(async () => {
  appConfig.authRateLimit = 2;
  const app = express();
  app.use("/api/v2/profile", router);
  await new Promise((resolve) => (server = app.listen(0, "127.0.0.1", resolve)));
  base = `http://127.0.0.1:${server.address().port}/api/v2/profile`;
});
afterAll(async () => {
  delete appConfig.authRateLimit;
  await new Promise((resolve) => server.close(resolve));
});

const call = async (method, path = "") => (await fetch(base + path, { method })).status;

describe("profile rate limit", () => {
  test("changing the password and the tokens share a ceiling, reading does not count", async () => {
    expect(await call("PUT")).toBe(200);
    expect(await call("POST", "/tokens")).toBe(200);
    expect(await call("PUT")).toBe(429);
    expect(await call("DELETE", "/tokens/abc")).toBe(429);
    for (let i = 0; i < 5; i++) {
      expect(await call("GET")).toBe(200);
      expect(await call("GET", "/tokens")).toBe(200);
    }
  });
});
