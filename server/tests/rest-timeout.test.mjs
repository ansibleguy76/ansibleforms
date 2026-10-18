// The REST expression functions : a call is bounded by REST_TIMEOUT_SECONDS (an
// endpoint that never answers used to hang the request forever), and a missing
// credential is a clear error instead of a TypeError.
import { describe, test, expect, beforeAll, afterAll, vi } from "vitest";
import http from "node:http";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

// no credential exists
vi.mock("../src/models/credential.model.v2.js", () => ({
  default: { findByName: async () => null, resolveCredential: async () => null },
}));

const appConfig = (await import("./__mocks__/app.config.js")).default;
const { default: fn } = await import("../src/functions/default.js");

let server;
let base;
beforeAll(async () => {
  // accepts the request and never answers
  server = http.createServer(() => {});
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

describe("REST functions", () => {
  test("a call that gets no answer fails after REST_TIMEOUT_SECONDS", async () => {
    appConfig.restTimeoutSeconds = 0.3;
    try {
      const started = Date.now();
      await expect(fn.fnRestAdvanced("get", `${base}/slow`, null, {})).rejects.toThrow(/timeout/i);
      expect(Date.now() - started).toBeLessThan(5000);
    } finally {
      delete appConfig.restTimeoutSeconds;
    }
  });

  test("fnRestBasic with an unknown credential throws a clear error", async () => {
    await expect(fn.fnRestBasic("get", `${base}/x`, null, "nope")).rejects.toThrow("Credential 'nope' not found");
  });

  test("fnRestJwtSecure with an unknown credential throws a clear error", async () => {
    await expect(fn.fnRestJwtSecure("get", `${base}/x`, null, "nope")).rejects.toThrow(/Credential 'nope' not found/);
  });
});
