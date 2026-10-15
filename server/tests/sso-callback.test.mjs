// An SSO credential's redirect URL (lib/ssoCallback.js) : the one set (the credential's, else the
// provider's own from before), else the app's address (Settings > URL) and the type's callback path.
import { describe, test, expect, vi } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

let url = "";
vi.mock("../src/models/settings.model.js", () => ({ default: { findUrl: async () => ({ url }) } }));
const { redirectUrl } = await import("../src/lib/ssoCallback.js");

describe("the redirect URL a provider signs in with", () => {
  test("the first one set wins : the credential's, then the provider's own", async () => {
    expect(await redirectUrl("entraid", "https://a/cb", "https://b/cb")).toBe("https://a/cb");
    expect(await redirectUrl("entraid", "", "https://b/cb")).toBe("https://b/cb");
  });

  test("none set : the app's address and the type's callback path ; no address, none", async () => {
    url = "https://forms.example.com/";
    expect(await redirectUrl("entraid", "", null)).toBe("https://forms.example.com/api/v2/auth/entraid/callback");
    expect(await redirectUrl("oidc")).toBe("https://forms.example.com/api/v2/auth/oidc/callback");
    url = "";
    expect(await redirectUrl("oidc")).toBe("");
  });
});
