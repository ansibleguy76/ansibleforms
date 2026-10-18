// The 7 patch moves an SSO provider's client and an LDAP directory's servers into credentials.
// Both read and write columns the same patch adds : oauth2_providers.credential, the ldap id, name
// and credential, the credentials' tenant_id, issuer, redirect_uri, ignore_certs and ca_bundle.
// Run before them, an upgrade from 6 failed on an unknown column and moved nothing until the next
// start. The moves come after every column they use.
import { test, expect, vi } from "vitest";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

// a database from 6 : these tables are there, without the columns 7 adds
const columns = {
  oauth2_providers: new Set(["id", "name", "provider", "tenant_id", "issuer", "redirect_uri", "client_id", "client_secret", "managed"]),
  ldap: new Set(["server", "port", "enable_tls", "ignore_certs", "cert", "ca_bundle", "bind_user_dn", "bind_user_pw", "managed"]),
  credentials: new Set(["id", "name", "user", "password", "host", "port", "secure", "description", "is_database"]),
};
// the columns each move needs, by the table its first SELECT reads
const needs = {
  oauth2_providers: { oauth2_providers: ["credential"], credentials: ["tenant_id", "issuer", "redirect_uri"] },
  ldap: { ldap: ["id", "name", "credential"], credentials: ["ignore_certs", "ca_bundle", "client_cert"] },
};
const order = [];
vi.mock("../src/models/db.model.js", () => ({
  default: {
    do: async (sql, params) => {
      if (/^SHOW COLUMNS FROM/.test(sql)) {
        const [, table, field] = params;
        return columns[table] ? (columns[table].has(field) ? [{ Field: field }] : []) : [{ Field: field }];
      }
      if (/^ALTER TABLE \?\?\.\?\? ADD COLUMN id /.test(sql)) {
        const [, table] = params;
        if (columns[table]) columns[table].add("id");
        order.push(`add ${table}.id`);
        return {};
      }
      if (/^ALTER TABLE \?\?\.\?\? ADD COLUMN \?\?/.test(sql)) {
        const [, table, field] = params;
        if (columns[table]) columns[table].add(field);
        order.push(`add ${table}.${field}`);
        return {};
      }
      // the LDAP directory 'default' renamed 'main' : it reads the name column
      if (/^SELECT name FROM AnsibleForms\.`ldap` WHERE name IN/.test(sql)) {
        if (!columns.ldap.has("name")) throw new Error("Unknown column 'ldap.name' in 'field list'");
        order.push("rename ldap");
        return [];
      }
      const move = /^SELECT id, name, (?:provider|server).* FROM AnsibleForms\.`(oauth2_providers|ldap)`/.exec(sql);
      if (move) {
        const table = move[1];
        for (const [t, fields] of Object.entries(needs[table])) {
          for (const f of fields) {
            if (!columns[t].has(f)) throw new Error(`Unknown column '${t}.${f}' in 'field list'`);
          }
        }
        order.push(`move ${table}`);
        return [];
      }
      return [];
    },
  },
}));

const { patchVersion7 } = await import("../src/models/schema.model.js");

test("the SSO and LDAP moves run after the columns they use, and the patch does not fail on them", async () => {
  const messages = [], success = [], failed = [];
  await patchVersion7(messages, success, failed);
  expect(failed.filter((f) => /Unknown column/.test(String(f)))).toEqual([]);
  expect(order).toContain("move oauth2_providers");
  expect(order).toContain("move ldap");
  for (const column of ["add oauth2_providers.credential", "add credentials.tenant_id", "add credentials.issuer", "add credentials.redirect_uri"]) {
    expect(order.indexOf("move oauth2_providers")).toBeGreaterThan(order.indexOf(column));
  }
  for (const column of ["add ldap.id", "add ldap.name", "add ldap.credential", "add credentials.ignore_certs", "add credentials.ca_bundle"]) {
    expect(order.indexOf("move ldap")).toBeGreaterThan(order.indexOf(column));
  }
});

// the directory 'default' (up to 7.2) is renamed 'main' BEFORE its servers move to a credential
// named after it : after it, the credential was default-ldap, beside a directory called main
test("the LDAP rename runs after the name column and before the LDAP move", async () => {
  expect(order).toContain("rename ldap");
  expect(order.indexOf("rename ldap")).toBeGreaterThan(order.indexOf("add ldap.name"));
  expect(order.indexOf("rename ldap")).toBeLessThan(order.indexOf("move ldap"));
});
