// A role names a Microsoft Entra ID member entraid/<name> since 7.3 ; azuread/<name>, the prefix
// of before, is the same member. The sign-in still stores the type azuread : both prefixes match
// an Entra ID user, at the login and in the Users and Groups lists.
import { describe, test, expect, vi, beforeEach } from "vitest";
import fs from "fs";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));
let config;
vi.mock("../src/models/form.model.js", async (importOriginal) => {
  const actual = await importOriginal();
  const Form = actual.default;
  return { default: Object.assign(Object.create(Form), Form, { load: async () => config }) };
});

const { default: User } = await import("../src/models/user.model.js");
const { memberRef, memberRefs, ENTRA_TYPE } = await import("../src/lib/directoryTypes.js");
const { rolesOfDirectoryUser, directoryUserRows, directoryGroupRows } = await import("../src/lib/directoryViews.js");

const admin = { name: "admin", groups: ["local/admins"] };
const roles = [
  admin,
  { name: "default", groups: [] },
  { name: "new-group", groups: ["entraid/AF-Operators"] },
  { name: "old-group", groups: ["azuread/AF-Operators"] },
  { name: "new-user", groups: [], users: ["entraid/alice@example.com"] },
  { name: "old-user", groups: [], users: ["azuread/alice@example.com"] },
  { name: "ldap-only", groups: ["ldap/AF-Operators"] },
];

beforeEach(() => {
  config = { roles };
});

describe("the entraid/ prefix of a role member", () => {
  test("is read as azuread/, the type stored ; other prefixes stay as they are", () => {
    expect(ENTRA_TYPE).toBe("azuread");
    expect(memberRef("entraid/x")).toBe("azuread/x");
    expect(memberRef("azuread/x")).toBe("azuread/x");
    expect(memberRef("ldap/x")).toBe("ldap/x");
    expect(memberRef("local/entraid/x")).toBe("local/entraid/x");
    expect(memberRefs(["entraid/a", "oidc/b"])).toEqual(["azuread/a", "oidc/b"]);
    expect(memberRefs(undefined)).toEqual([]);
  });

  test("entraid/x and azuread/x both match an Entra ID user's group at the login", async () => {
    const { roles: got } = await User.getRolesAndOptions(["azuread/AF-Operators"], { type: "azuread", username: "bob@example.com" });
    expect(got).toEqual(expect.arrayContaining(["new-group", "old-group"]));
    expect(got).not.toContain("ldap-only");
  });

  test("entraid/x and azuread/x both match an Entra ID user by name at the login", async () => {
    const { roles: got } = await User.getRolesAndOptions([], { type: "azuread", username: "alice@example.com" });
    expect(got).toEqual(expect.arrayContaining(["new-user", "old-user"]));
    expect(got).not.toContain("new-group");
  });

  test("the Users and Groups lists count both, as one user and one group", () => {
    expect(rolesOfDirectoryUser(roles, "azuread", "alice@example.com", [])).toEqual(
      expect.arrayContaining(["new-user", "old-user"]),
    );
    const users = directoryUserRows([], roles);
    expect(users.map((u) => u.id)).toEqual(["azuread/alice@example.com"]);
    expect(users[0].role_count).toBe(3);
    const groups = directoryGroupRows([{ type: "azuread", username: "bob", groups: ["azuread/AF-Operators"] }], roles);
    const entra = groups.filter((g) => g.source === "azuread");
    expect(entra.map((g) => g.id)).toEqual(["azuread/AF-Operators"]);
    expect(entra[0]).toMatchObject({ user_count: 1, role_count: 2 });
  });

  test("the config's schema takes both prefixes", () => {
    const schema = JSON.parse(fs.readFileSync(new URL("../schema/base_schema.json", import.meta.url), "utf8"));
    // the patterns of a role's groups and users : the ones naming the providers
    const patterns = [];
    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      if (typeof node.pattern === "string" && node.pattern.includes("ldap")) patterns.push(new RegExp(node.pattern));
      Object.values(node).forEach(walk);
    };
    walk(schema);
    expect(patterns.length).toBe(2);
    for (const re of patterns) {
      expect(re.test("entraid/AF-Operators")).toBe(true);
      expect(re.test("azuread/AF-Operators")).toBe(true);
    }
  });
});
