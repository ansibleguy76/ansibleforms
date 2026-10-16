// The single sign-on providers told to the page in index.html (src/lib/ssoMeta.js) : the sign-in
// card keeps the room of their buttons from its first frame, rather than growing once it has
// asked the api which are on.
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import { enabledSsoProviders, injectSsoProviders } from "../src/lib/ssoMeta.js";

const html = '<!DOCTYPE html>\n<html>\n<head>\n  <base href="/" />\n</head>\n<body></body>\n</html>';

describe("the single sign-on providers in index.html", () => {
  test("the providers on, in a meta tag of the head", () => {
    const out = injectSsoProviders(html, ["azuread", "oidc"]);
    assert.match(out, /<meta name="af-sso" content="azuread,oidc" \/>\n<\/head>/);
  });

  test("none on: the tag says so, empty", () => {
    assert.match(injectSsoProviders(html, []), /<meta name="af-sso" content="" \/>/);
  });

  test("the tag already there is replaced, never doubled", () => {
    const once = injectSsoProviders(html, ["oidc"]);
    const twice = injectSsoProviders(once, ["azuread"]);
    assert.equal((twice.match(/name="af-sso"/g) || []).length, 1);
    assert.match(twice, /content="azuread"/);
  });

  test("only the known names reach the attribute", () => {
    const out = injectSsoProviders(html, ['oidc"><script>alert(1)</script>', "oidc", "saml"]);
    assert.match(out, /<meta name="af-sso" content="oidc" \/>/);
    assert.doesNotMatch(out, /script/);
  });

  test("not readable (null): the page is left without the tag", () => {
    assert.equal(injectSsoProviders(html, null), html);
  });

  test("the providers on are read from their models, in the card's order", async () => {
    const models = (azure, oidc) => ({
      EntraId: { isEnabled: async () => ({ enable: azure }) },
      OIDC: { isEnabled: async () => ({ enable: oidc }) },
    });
    assert.deepEqual(await enabledSsoProviders(models(1, 1)), ["azuread", "oidc"]);
    assert.deepEqual(await enabledSsoProviders(models(0, 1)), ["oidc"]);
    assert.deepEqual(await enabledSsoProviders(models(1, 0)), ["azuread"]);
    assert.deepEqual(await enabledSsoProviders(models(0, 0)), []);
  });

  test("a model that fails: the read fails, and the caller leaves the tag out", async () => {
    const models = { EntraId: { isEnabled: async () => { throw new Error("db down"); } }, OIDC: { isEnabled: async () => ({ enable: 1 }) } };
    const providers = await enabledSsoProviders(models).catch(() => null);
    assert.equal(injectSsoProviders(html, providers), html);
  });
});
