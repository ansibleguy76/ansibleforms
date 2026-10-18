// ENABLE_SSO and SSO_AUTO_LOGIN were removed in 7.3 : each SSO provider has its own Enabled and
// Skip the login page. The upgrade dropped them silently - SSO switched off as a whole came back
// on, and the login page no longer went straight to the provider. importSsoEnvOnce carries them
// over once, records that, and warns on every start while either is still set.
import { test, describe, beforeEach, vi } from "vitest";
import assert from "node:assert/strict";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

// the providers and the schema_migrations rows ; every statement noted, with whether it ran in
// the transaction
let providers;
let migrations;
const statements = [];
vi.mock("../src/models/db.model.js", () => {
  const run = async (sql, params, tx) => {
    statements.push({ sql, params, tx });
    if (/FROM AnsibleForms\.`schema_migrations` WHERE name = \?/.test(sql)) return migrations.has(params[0]) ? [{ 1: 1 }] : [];
    if (/^UPDATE AnsibleForms\.`oauth2_providers` SET enable = 0/.test(sql)) {
      const on = providers.filter((p) => p.enable !== 0);
      on.forEach((p) => { p.enable = 0; });
      return { affectedRows: on.length };
    }
    if (/^SELECT id, name FROM AnsibleForms\.`oauth2_providers` WHERE enable = 1/.test(sql)) return providers.filter((p) => p.enable === 1);
    if (/^UPDATE AnsibleForms\.`oauth2_providers` SET auto_login = 1 WHERE id = \?/.test(sql)) {
      providers.find((p) => p.id === params[0]).auto_login = 1;
      return { affectedRows: 1 };
    }
    if (/^INSERT IGNORE INTO AnsibleForms\.`schema_migrations`/.test(sql)) {
      migrations.add(params[0]);
      return { affectedRows: 1 };
    }
    return [];
  };
  return {
    default: {
      do: (sql, params) => run(sql, params, false),
      transaction: async (fn) => fn((sql, params) => run(sql, params, true)),
    },
  };
});

// the logger is the shared mock (vitest.config.js aliases lib/logger.js to it) : its warnings
// collected here
const warnings = [];
const logger = (await import("./__mocks__/logger.js")).default;
logger.warning = (m) => warnings.push(m);

const { importSsoEnvOnce } = await import("../src/models/schema.model.js");

beforeEach(() => {
  providers = [
    { id: 1, name: "Entra", enable: 1, auto_login: 0 },
    { id: 2, name: "Keycloak", enable: 0, auto_login: 0 },
  ];
  migrations = new Set();
  statements.length = 0;
  warnings.length = 0;
});

describe("ENABLE_SSO and SSO_AUTO_LOGIN become the providers' switches, once", () => {
  test("neither set: nothing done, nothing recorded, no warning", async () => {
    assert.equal(await importSsoEnvOnce({ env: {} }), "none");
    assert.equal(statements.length, 0);
    assert.equal(warnings.length, 0);
  });

  test("ENABLE_SSO=0: every provider disabled, recorded in the same transaction", async () => {
    providers[1].enable = 1;
    assert.equal(await importSsoEnvOnce({ env: { ENABLE_SSO: "0" } }), "imported");
    assert.deepEqual(providers.map((p) => p.enable), [0, 0]);
    assert.ok(migrations.has("sso_env_import"));
    assert.ok(statements.filter((s) => /^(UPDATE|INSERT)/.test(s.sql)).every((s) => s.tx));
  });

  test("ENABLE_SSO=false counts as off too ; ENABLE_SSO=1 changes nothing", async () => {
    await importSsoEnvOnce({ env: { ENABLE_SSO: "false" } });
    assert.equal(providers[0].enable, 0);
    providers[0].enable = 1;
    migrations.clear();
    await importSsoEnvOnce({ env: { ENABLE_SSO: "1" } });
    assert.equal(providers[0].enable, 1);
  });

  test("SSO_AUTO_LOGIN=1 with exactly one provider enabled: it skips the login page", async () => {
    await importSsoEnvOnce({ env: { SSO_AUTO_LOGIN: "1" } });
    assert.equal(providers[0].auto_login, 1);
    assert.equal(providers[1].auto_login, 0);
  });

  test("SSO_AUTO_LOGIN=1 with two providers enabled: none skips it, as before", async () => {
    providers[1].enable = 1;
    await importSsoEnvOnce({ env: { SSO_AUTO_LOGIN: "true" } });
    assert.deepEqual(providers.map((p) => p.auto_login), [0, 0]);
    assert.ok(migrations.has("sso_env_import"));
  });

  test("ENABLE_SSO=0 with SSO_AUTO_LOGIN=1: SSO off wins, nobody skips the login page", async () => {
    await importSsoEnvOnce({ env: { ENABLE_SSO: "0", SSO_AUTO_LOGIN: "1" } });
    assert.deepEqual(providers.map((p) => [p.enable, p.auto_login]), [[0, 0], [0, 0]]);
  });

  test("imported before: a provider enabled since is left alone, every start warns", async () => {
    await importSsoEnvOnce({ env: { ENABLE_SSO: "0" } });
    providers[0].enable = 1;
    warnings.length = 0;
    assert.equal(await importSsoEnvOnce({ env: { ENABLE_SSO: "0" } }), "ignored");
    assert.equal(providers[0].enable, 1);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /no longer read.*Settings > SSO/);
  });
});
