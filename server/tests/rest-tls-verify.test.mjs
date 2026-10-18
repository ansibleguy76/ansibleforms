// The REST helper functions check the endpoint's certificate (CodeQL js/disabling-certificate-
// validation) : REST_IGNORE_CERTS, read on each call, is the only way to skip it.
import { describe, test, expect, vi, beforeEach } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

const seen = [];
vi.mock("axios", () => {
  const fn = async (config) => { seen.push(config); return { data: { ok: true }, headers: {}, status: 200 }; };
  fn.get = async (url, config) => fn({ ...config, url, method: "get" });
  fn.post = async (url, body, config) => fn({ ...config, url, method: "post", data: body });
  fn.request = fn;
  return { default: fn };
});

const appConfig = (await import("./__mocks__/app.config.js")).default;
const fn = await import("../src/functions/default.js");
const fnRestAdvanced = fn.default?.fnRestAdvanced ?? fn.fnRestAdvanced;

describe("REST helper certificate check", () => {
  beforeEach(() => { seen.length = 0; });

  test("checks the certificate by default", async () => {
    appConfig.restIgnoreCerts = false;
    await fnRestAdvanced("get", "https://example.test/api").catch(() => {});
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.at(-1).httpsAgent.options.rejectUnauthorized).toBe(true);
  });

  test("skips it only with REST_IGNORE_CERTS", async () => {
    appConfig.restIgnoreCerts = true;
    await fnRestAdvanced("get", "https://example.test/api").catch(() => {});
    expect(seen.at(-1).httpsAgent.options.rejectUnauthorized).toBe(false);
    appConfig.restIgnoreCerts = false;
  });
});
