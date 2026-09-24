// The LDAP group filter, the server side twin of the Entra ID / OIDC one in login.vue.
//
// Two things are worth pinning down, and they pull in opposite directions.
//
// The first is that it filters at all: a directory user in a hundred AD groups carried all
// hundred into the token, into every role lookup and into every job's extravars, and there
// was no way to narrow it - groups_search_base narrows the SEARCH, not the memberOf list
// AnsibleForms reads.
//
// The second is what happens when the pattern is wrong, and here the safe direction is the
// opposite of MASK_EXTRAVARS_REGEX (see regex-settings.test.mjs). Groups are what
// getRolesAndOptions maps to roles, so a stray bracket that filtered everything away would
// demote every directory user to no roles at all - a silent lockout. An uncompilable
// pattern must therefore keep the FULL list, never the empty one.
import { test, describe, expect, beforeEach, vi } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

const logged = [];
vi.mock("../src/lib/logger.js", () => ({
  default: {
    error: (m) => logged.push(String(m)),
    warning: (m) => logged.push(String(m)),
    info: () => {}, notice: () => {}, debug: () => {},
  },
}));

const Helpers = (await import("../src/lib/common.js")).default;

const AD = ["AF_Admins", "AF_Operators", "AZ_ClarivateAll_nonAltaris", "IT Services Community Hub"];

beforeEach(() => { logged.length = 0; });

describe("Helpers.filterGroups", () => {
  test("no filter keeps every group", () => {
    expect(Helpers.filterGroups(AD, "")).toEqual(AD);
    expect(Helpers.filterGroups(AD, null)).toEqual(AD);
    expect(Helpers.filterGroups(AD, undefined)).toEqual(AD);
  });

  test("whitespace only is not a pattern", () => {
    // "   " compiles perfectly well and matches nothing useful ; treating it as a real
    // filter would drop every group on a field an admin merely tabbed through
    expect(Helpers.filterGroups(AD, "   ")).toEqual(AD);
  });

  test("keeps the groups that match", () => {
    expect(Helpers.filterGroups(AD, "^AF_")).toEqual(["AF_Admins", "AF_Operators"]);
  });

  test("matches anywhere, like the client side filter does", () => {
    expect(Helpers.filterGroups(AD, "Services")).toEqual(["IT Services Community Hub"]);
  });

  test("a pattern matching nothing yields nothing", () => {
    expect(Helpers.filterGroups(AD, "^nope")).toEqual([]);
  });

  test("an uncompilable pattern keeps every group and says so", () => {
    expect(() => Helpers.filterGroups(AD, "^AF_[")).not.toThrow();
    expect(
      Helpers.filterGroups(AD, "^AF_["),
      "dropping the groups here would strip every role from every directory user"
    ).toEqual(AD);
    expect(logged.join(" ")).toMatch(/not a valid regular expression/);
  });

  test("no lastIndex carry over between calls", () => {
    // a `g` flagged regex advances lastIndex on every .test(), so the second, fourth,
    // ... group would be skipped. This is why the helper compiles without the flag.
    expect(Helpers.filterGroups(["a1", "a2", "a3", "a4"], "a")).toEqual(["a1", "a2", "a3", "a4"]);
  });
});

// The filter is applied inside User.getGroups, which is the one place ldap group names are
// produced (auth_basic.js's ldap strategy is its only caller).
const User = (await import("../src/models/user.model.js")).default;

const LDAP = { groups_attribute: "memberOf" };
const memberOf = {
  memberOf: [
    "CN=AF_Admins,OU=Groups,DC=example,DC=com",
    "CN=AF_Operators,OU=Groups,DC=example,DC=com",
    "CN=AZ_ClarivateAll_nonAltaris,OU=Groups,DC=example,DC=com",
  ],
};

describe("User.getGroups applies the ldap group filter", () => {
  test("no filter is the behaviour every existing install has", () => {
    expect(User.getGroups({ type: "ldap" }, memberOf, LDAP)).toEqual([
      "ldap/AF_Admins", "ldap/AF_Operators", "ldap/AZ_ClarivateAll_nonAltaris",
    ]);
  });

  test("the pattern matches the BARE name, not the ldap/ prefix", () => {
    // login.vue filters Entra ID and OIDC groups before the server prefixes them, so the
    // same `^AF_` must work here. Anchoring against "ldap/AF_Admins" would silently need
    // a different pattern per provider.
    expect(User.getGroups({ type: "ldap" }, memberOf, { ...LDAP, groupfilter: "^AF_" }))
      .toEqual(["ldap/AF_Admins", "ldap/AF_Operators"]);
  });

  test("the prefix is still added to what survives", () => {
    const out = User.getGroups({ type: "ldap" }, memberOf, { ...LDAP, groupfilter: "Admins" });
    expect(out).toEqual(["ldap/AF_Admins"]);
  });

  test("a broken pattern leaves the mapping exactly as it was", () => {
    expect(User.getGroups({ type: "ldap" }, memberOf, { ...LDAP, groupfilter: "(" })).toEqual([
      "ldap/AF_Admins", "ldap/AF_Operators", "ldap/AZ_ClarivateAll_nonAltaris",
    ]);
  });

  test("local users are untouched by it", () => {
    expect(User.getGroups({ type: "local" }, "admins,users", { groupfilter: "^AF_" }))
      .toEqual(["local/admins", "local/users"]);
  });
});
