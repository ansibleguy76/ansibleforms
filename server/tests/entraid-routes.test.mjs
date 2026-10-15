// The Entra ID sign-in is at /api/v2/auth/entraid since 7.3 ; the paths of before
// (/azureadoauth2) stay, the same handlers : a provider saved with the old redirect uri still
// comes back on /azureadoauth2/callback.
import { describe, test, expect, vi } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));

const router = (await import("../src/routes/v2/login.routes.js")).default;
const controller = (await import("../src/controllers/v2/login.controller.js")).default;

// the first handler of a route, by method and path
function handler(method, path) {
  const layer = router.stack.find((l) => l.route?.path === path && l.route.methods[method]);
  return layer ? layer.route.stack[0].handle : undefined;
}

describe("the Entra ID sign-in routes", () => {
  test("the new paths", () => {
    expect(handler("get", "/entraid")).toBe(controller.entraid);
    expect(handler("get", "/entraid/callback")).toBe(controller.entraidCallback);
    expect(handler("post", "/entraid/login")).toBe(controller.entraidLogin);
  });

  test("the old paths, the same handlers", () => {
    expect(handler("get", "/azureadoauth2")).toBe(controller.entraid);
    expect(handler("get", "/azureadoauth2/callback")).toBe(controller.entraidCallback);
    expect(handler("post", "/azureadoauth2/login")).toBe(controller.entraidLogin);
  });
});
