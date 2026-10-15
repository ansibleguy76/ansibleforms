// A failed single sign-on said only "ResponseBodyError: server responded with an error in the
// response body" : openid-client's wrapper, not the provider's reason. The login page and the log
// now show the provider's error_description (Entra ID's AADSTS text), and a callback that brings
// no user is refused instead of minting a handoff without claims.
import { describe, test, expect, vi } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [], tryDo: async () => [] } }));
vi.mock("../src/models/audit.model.js", () => ({ default: { log: async () => {} } }));
// the strategy's verdict, as the test sets it : (err, user)
let verdict = [null, false];
vi.mock("passport", () => ({
  default: {
    authenticate: (_name, callback) => () => callback(...verdict),
    use: () => {},
    unuse: () => {},
    serializeUser: () => {},
    deserializeUser: () => {},
    initialize: () => (_req, _res, next) => next(),
  },
}));

const { ssoErrorMessage } = await import("../src/controllers/v2/login.controller.js");
const controller = (await import("../src/controllers/v2/login.controller.js")).default;

// what openid-client throws when Entra ID's token endpoint refuses the code
const tokenError = Object.assign(new Error("server responded with an error in the response body"), {
  name: "ResponseBodyError",
  error: "invalid_client",
  error_description: "AADSTS7000215: Invalid client secret provided. Ensure the secret being sent in the request is the client secret value.\r\nTrace ID: 1234\r\nCorrelation ID: 5678",
});

const redirectRes = () => { const r = { location: null }; r.redirect = (url) => { r.location = url; return r; }; return r; };
const errorOf = (location) => new URL(location, "https://af.example").searchParams.get("error");

describe("a failed single sign-on says why", () => {
  test("the provider's description, first line only, not openid-client's wrapper", () => {
    expect(ssoErrorMessage(tokenError)).toBe("AADSTS7000215: Invalid client secret provided. Ensure the secret being sent in the request is the client secret value.");
  });

  test("the provider's code when it sends no description, the message otherwise", () => {
    expect(ssoErrorMessage({ error: "access_denied", message: "x" })).toBe("access_denied");
    expect(ssoErrorMessage(new Error("Unknown authentication strategy"))).toBe("Unknown authentication strategy");
  });

  test("the login page gets it as one encoded query value", async () => {
    const r = redirectRes();
    await controller.errorHandler(tokenError, {}, r, () => {});
    expect(r.location).toMatch(/\/login\?error=AADSTS7000215%3A%20Invalid/);
    expect(errorOf(r.location)).toMatch(/^AADSTS7000215: Invalid client secret provided/);
  });

  test("a callback without a user is refused, no handoff is minted", async () => {
    verdict = [null, false];
    const r = redirectRes();
    const next = vi.fn();
    await controller.oidcCallback({ query: {} }, r, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());
    expect(next.mock.calls[0][0].message).toMatch(/did not sign you in/);
    expect(r.location).toBeNull();
  });

  test("a provider error goes on, with its reason, to the error handler", async () => {
    verdict = [tokenError, false];
    const next = vi.fn();
    await controller.entraidCallback({ query: {} }, redirectRes(), next);
    await vi.waitFor(() => expect(next).toHaveBeenCalledWith(tokenError));
  });
});
