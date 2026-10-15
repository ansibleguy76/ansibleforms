// An api token's lifetime by the role options : allowApiTokens up to API_TOKEN_MAX_DAYS,
// extendedTokenExpiration as well and one that never expires (lib/tokenLifetime.js).
import { describe, test, expect } from "vitest";
import authConfig from "../config/auth.config.js";
import { NEVER_DAYS, apiTokenDays, mayMakeApiTokens, mayMakeNeverExpiringTokens, revocationHorizonSeconds } from "../src/lib/tokenLifetime.js";

const user = (options) => ({ username: "u", type: "local", options });

describe("api token lifetime", () => {
  test("no option : no token", () => {
    expect(mayMakeApiTokens(user({}))).toBe(false);
    expect(apiTokenDays(user({}), 30)).toBe(null);
    expect(apiTokenDays(user({ allowApiTokens: false, extendedTokenExpiration: false }), 30)).toBe(null);
  });

  test("allowApiTokens : days up to the cap, never refused", () => {
    const u = user({ allowApiTokens: true });
    expect(mayMakeApiTokens(u)).toBe(true);
    expect(mayMakeNeverExpiringTokens(u)).toBe(false);
    expect(apiTokenDays(u, 30)).toBe(30);
    expect(apiTokenDays(u, "7")).toBe(7);
    expect(apiTokenDays(u, authConfig.apiTokenMaxDays + 500)).toBe(authConfig.apiTokenMaxDays);
    expect(apiTokenDays(u, "never")).toBe(null);
  });

  test("extendedTokenExpiration alone : tokens too (a role from before allowApiTokens), and never", () => {
    const u = user({ extendedTokenExpiration: true });
    expect(mayMakeApiTokens(u)).toBe(true);
    expect(apiTokenDays(u, 30)).toBe(30);
    expect(apiTokenDays(u, "never")).toBe(NEVER_DAYS);
    expect(apiTokenDays(u, "NEVER")).toBe(NEVER_DAYS);
  });

  test("no lifetime, or not a positive number : refused", () => {
    const u = user({ allowApiTokens: true, extendedTokenExpiration: true });
    for (const v of [undefined, null, "", 0, -3, "abc", "0.5"]) expect(apiTokenDays(u, v)).toBe(null);
  });

  test("a never-expiring token fits MariaDB's FROM_UNIXTIME (2106), and revocations last as long", () => {
    const end = new Date(Date.now() + NEVER_DAYS * 86400 * 1000);
    expect(end.getUTCFullYear()).toBeLessThan(2106);
    expect(revocationHorizonSeconds()).toBeGreaterThanOrEqual(NEVER_DAYS * 86400);
  });
});
