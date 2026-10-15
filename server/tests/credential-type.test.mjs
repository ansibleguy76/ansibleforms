// A credential's type says what it is for (userpass, ssh, git, api, database...) and keeps the older
// is_database flag in step, so a client or a seed that only knows the flag still works.
import { test, describe } from "vitest";
import assert from "node:assert/strict";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";
process.env.DB_HOST = process.env.DB_HOST || "127.0.0.1";
process.env.DB_PORT = process.env.DB_PORT || "3306";
process.env.DB_USER = process.env.DB_USER || "test";
process.env.DB_PASSWORD = process.env.DB_PASSWORD || "test";

const { default: Credential } = await import("../src/models/credential.model.v2.js");

describe("a credential's type and its is_database flag", () => {
  test("the type sets the flag", () => {
    assert.equal(Credential.mirrorType({ credential_type: "database" }).is_database, 1);
    for (const type of ["userpass", "ssh", "git", "api"]) assert.equal(Credential.mirrorType({ credential_type: type }).is_database, 0);
  });

  test("the flag alone sets the type : database, or userpass on a create", () => {
    assert.equal(Credential.mirrorType({ is_database: 1 }).credential_type, "database");
    assert.equal(Credential.mirrorType({ is_database: 0 }, true).credential_type, "userpass");
    assert.equal(Credential.mirrorType({ is_database: 0 }).credential_type, undefined, "an update leaves the stored type");
  });

  test("a create with neither is a database credential, as the column's default", () => {
    assert.equal(Credential.mirrorType({}, true).credential_type, "database");
  });

  test("an unknown type is refused", () => {
    assert.throws(() => Credential.mirrorType({ credential_type: "kerberos" }), /Unknown credential type 'kerberos'/);
  });
});

describe("an Entra ID credential's tenant", () => {
  test("a create without one is refused, an update that empties it too", () => {
    assert.throws(() => Credential.requireTypeFields({ credential_type: "entraid" }, true), /needs its tenant ID/);
    assert.throws(() => Credential.requireTypeFields({ credential_type: "entraid", tenant_id: " " }), /needs its tenant ID/);
  });

  test("one with it keeps it, trimmed ; an update that does not send it leaves the stored one", () => {
    assert.equal(Credential.requireTypeFields({ credential_type: "entraid", tenant_id: " t-1 " }, true).tenant_id, "t-1");
    assert.equal(Credential.requireTypeFields({ credential_type: "entraid" }).tenant_id, undefined);
  });

  test("another type keeps none : an Open ID one, a type changed away from Entra ID", () => {
    assert.equal(Credential.requireTypeFields({ credential_type: "oidc", issuer: "https://id.example.com", tenant_id: "t-1" }, true).tenant_id, null);
    assert.equal(Credential.requireTypeFields({ credential_type: "userpass", tenant_id: "t-1" }).tenant_id, null);
  });
});

describe("an Open ID credential's issuer, an smtp one's host", () => {
  test("an Open ID one needs its issuer ; another type keeps none", () => {
    assert.throws(() => Credential.requireTypeFields({ credential_type: "oidc" }, true), /needs its issuer/);
    assert.equal(Credential.requireTypeFields({ credential_type: "oidc", issuer: " https://id.example.com " }, true).issuer, "https://id.example.com");
    assert.equal(Credential.requireTypeFields({ credential_type: "entraid", tenant_id: "t", issuer: "x" }, true).issuer, null);
  });

  test("an smtp one needs its mail server", () => {
    assert.throws(() => Credential.requireTypeFields({ credential_type: "smtp" }, true), /needs its mail server/);
    assert.equal(Credential.requireTypeFields({ credential_type: "smtp", host: "smtp.example.com" }, true).host, "smtp.example.com");
  });
});

describe("an SSO credential's redirect URL", () => {
  test("an Entra ID or Open ID one keeps it, trimmed, empty as none ; another type keeps none", () => {
    assert.equal(Credential.requireTypeFields({ credential_type: "entraid", tenant_id: "t", redirect_uri: " https://f/cb " }, true).redirect_uri, "https://f/cb");
    assert.equal(Credential.requireTypeFields({ credential_type: "oidc", issuer: "https://i", redirect_uri: "" }, true).redirect_uri, null);
    assert.equal(Credential.requireTypeFields({ credential_type: "userpass", redirect_uri: "https://f/cb" }, true).redirect_uri, null);
  });
});

describe("a credential keeps the type it was made as", () => {
  test("an update to another type is refused ; the same type, or none sent, goes on ; the seed may change it", async () => {
    const { vi } = await import("vitest");
    vi.spyOn(Credential, "findById").mockResolvedValue({ name: "smtp-office365", credential_type: "smtp" });
    await assert.rejects(Credential.update({ credential_type: "api" }, 5), /keeps the type it was made as : 'smtp-office365' is smtp/);
    const { default: CrudModel } = await import("../src/models/crud.model.js");
    const saved = vi.spyOn(CrudModel, "update").mockResolvedValue(true);
    await Credential.update({ credential_type: "smtp", host: "smtp.example.com" }, 5);
    await Credential.update({ description: "d" }, 5);
    await Credential.update({ credential_type: "api" }, 5, { fromSeed: true });
    assert.equal(saved.mock.calls.length, 3);
    vi.restoreAllMocks();
  });
});
