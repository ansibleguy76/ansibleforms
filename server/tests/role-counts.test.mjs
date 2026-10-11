// lib/roleCounts.js : the roles counted for the users and groups lists, by the login's rule
// (User.getRolesAndOptions) - by name, through a group, public always.
import { test, expect, vi, beforeEach } from "vitest";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";

var config = {};
vi.mock("../src/models/form.model.js", () => ({ default: { load: async () => config } }));
const { withUserRoleCounts, withGroupRoleCounts } = await import("../src/lib/roleCounts.js");

beforeEach(() => {
  config = {
    roles: [
      { name: "admin", groups: ["local/admins"], users: ["local/admin"] },
      { name: "operators", groups: ["local/admins", "local/ops", "ldap/ops"], users: [] },
      { name: "auditors", groups: [], users: ["local/jane"] },
      { name: "public", groups: [], users: [] },
    ],
  };
});
const groups = [{ id: 1, name: "admins" }, { id: 2, name: "ops" }, { id: 3, name: "empty" }];

test("a user counts its roles by name, through its groups, and public, each once", async () => {
  const [admin, jane, bob] = await withUserRoleCounts(
    [
      { username: "admin", group_ids: [1] },
      { username: "jane", group_ids: [3] },
      { username: "bob", group_ids: [2] },
    ],
    groups,
  );
  // admin : admin (by name and through admins, once), operators (through admins), public
  expect(admin.role_count).toBe(3);
  // jane : auditors by name, public
  expect(jane.role_count).toBe(2);
  // bob : operators through ops (local/ops ; ldap/ops is another provider's), public
  expect(bob.role_count).toBe(2);
});

test("a group counts the roles that name it, local ones only", async () => {
  const [admins, ops, empty] = await withGroupRoleCounts(groups);
  expect(admins.role_count).toBe(2);
  expect(ops.role_count).toBe(1);
  expect(empty.role_count).toBe(0);
});

test("a config that cannot be read counts public alone, and leaves the lists working", async () => {
  config = null;
  const [u] = await withUserRoleCounts([{ username: "x", group_ids: [1] }], groups);
  expect(u.role_count).toBe(1);
  const [g] = await withGroupRoleCounts(groups);
  expect(g.role_count).toBe(0);
});
