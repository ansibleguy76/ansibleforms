// tests for the declarative config seed helpers (schema validation and env
// interpolation) ; the apply logic itself needs a database and is covered by
// the integration flow, these cover the pure parts
const { test } = await import("vitest");
import assert from "node:assert/strict";
import { validateSeed, interpolateEnv } from "../src/lib/seed-schema.js";

const validSeed = {
  version: 1,
  awx: {
    items: [
      { name: "tower", uri: "https://tower.example.com", token: "abc", is_default: true },
    ],
  },
  credentials: {
    prune: true,
    items: [
      { name: "vcenter", host: "vcenter.example.com", user: "svc", password: "secret", is_database: false },
      { name: "vaulted", host: "db.example.com", vault_path: "secret/db/creds" },
    ],
  },
  oauth2: {
    items: [
      { name: "EntraID", provider: "azuread", client_id: "id", client_secret: "sec", enable: true },
    ],
  },
  repositories: {
    items: [
      { name: "forms", uri: "https://git.example.com/forms.git", branch: "main", use_for_forms: true, rebase_on_start: true },
    ],
  },
  ldap: {
    server: "ldap.example.com",
    port: 389,
    bind_user_dn: "cn=bind,dc=example,dc=com",
    bind_user_pw: "secret",
    search_base: "dc=example,dc=com",
    username_attribute: "uid",
    enable: true,
  },
  settings: {
    mail_server: "smtp.example.com",
    mail_port: 25,
    mail_from: "forms@example.com",
    url: "https://forms.example.com",
  },
};

test("validateSeed accepts a full valid seed", () => {
  assert.equal(validateSeed(validSeed), true);
});

test("validateSeed accepts an empty seed", () => {
  assert.equal(validateSeed({}), true);
});

test("validateSeed rejects unknown sections and unknown fields", () => {
  assert.throws(() => validateSeed({ nonsense: {} }), /validation failed/);
  assert.throws(
    () => validateSeed({ awx: { items: [{ name: "x", uri: "y", bogus: true }] } }),
    /validation failed/
  );
});

test("validateSeed rejects missing required fields", () => {
  // awx without uri
  assert.throws(() => validateSeed({ awx: { items: [{ name: "x" }] } }), /validation failed/);
  // oauth2 without client_secret
  assert.throws(
    () => validateSeed({ oauth2: { items: [{ name: "x", provider: "oidc", client_id: "y" }] } }),
    /validation failed/
  );
  // a list section without items
  assert.throws(() => validateSeed({ credentials: { prune: true } }), /validation failed/);
});

test("interpolateEnv resolves ${VAR} references recursively", () => {
  const env = { AWX_TOKEN: "t0ken", LDAP_PW: "s3cret" };
  const out = interpolateEnv(
    {
      awx: { items: [{ name: "tower", uri: "https://x", token: "${AWX_TOKEN}" }] },
      ldap: { bind_user_pw: "${LDAP_PW}", server: "plain" },
    },
    env
  );
  assert.equal(out.awx.items[0].token, "t0ken");
  assert.equal(out.ldap.bind_user_pw, "s3cret");
  assert.equal(out.ldap.server, "plain");
});

test("interpolateEnv supports partial and repeated references", () => {
  const env = { HOST: "example.com", PROTO: "https" };
  const out = interpolateEnv({ url: "${PROTO}://forms.${HOST}/" }, env);
  assert.equal(out.url, "https://forms.example.com/");
});

test("interpolateEnv reports all missing variables at once", () => {
  assert.throws(
    () => interpolateEnv({ a: "${MISSING_ONE}", b: "${MISSING_TWO}" }, {}),
    /MISSING_ONE, MISSING_TWO/
  );
});

test("interpolateEnv leaves non-strings untouched", () => {
  const out = interpolateEnv({ port: 389, enable: true, extra: null }, {});
  assert.equal(out.port, 389);
  assert.equal(out.enable, true);
  assert.equal(out.extra, null);
});
