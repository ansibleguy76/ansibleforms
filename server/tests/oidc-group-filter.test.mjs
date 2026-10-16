// The OIDC provider's "Group Filter" had no effect : the browser filtered the list it
// posted, but the server ignores that list whenever the handoff carries a groups claim
// and used the claim unfiltered. The filter is now applied by the server, like for
// Entra ID and LDAP. And the posted list is never read at all : the groups are the
// token's claim, or none.
import { describe, test, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));
const provider = { enable: 1, groupfilter: "^af-", issuer: "https://idp.example.com" };
vi.mock("../src/models/oidc.model.js", () => ({ default: { isEnabled: async () => provider, find: async () => provider } }));
vi.mock("../src/models/user.model.js", () => ({ default: { getRolesAndOptions: async (groups) => ({ roles: groups, options: { allowLogin: true } }) } }));
vi.mock("../src/models/audit.model.js", () => ({ default: { log: async () => {} } }));

const { signHandoff } = await import("../src/lib/ssoHandoff.js");
const controller = (await import("../src/controllers/v2/login.controller.js")).default;
const authConfig = (await import("../config/auth.config.js")).default;

const res = () => { const r = { statusCode: 200, body: null }; r.status = (c) => { r.statusCode = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };
const req = (token, groups) => ({ body: { token, groups }, headers: {}, ip: "127.0.0.1" });
const login = async (profile, bodyGroups) => {
  const r = res();
  await controller.oidcLogin(req(signHandoff(profile, "oidc"), bodyGroups), r);
  expect(r.statusCode).toBe(200);
  return jwt.verify(r.body.token, authConfig.secret).user;
};

beforeEach(() => { provider.groupfilter = "^af-"; });

describe("the oidc group filter is applied by the server", () => {
  test("the groups claim of the token is filtered", async () => {
    const user = await login({ preferred_username: "bob", groups: ["af-admins", "everyone", "staff-af-"] });
    // the token carries no groups (#1036) : the roles, resolved from them (here one per group), show
    // which were kept
    expect(user).toMatchObject({ username: "bob", type: "oidc", roles: ["oidc/af-admins"] });
    expect(user.groups).toBeUndefined();
  });

  test("the list the browser posts is never read: no groups claim is no groups, whatever the body says", async () => {
    // a caller with the handoff of any account could otherwise name af-admins and get its roles
    const user = await login({ preferred_username: "bob" }, ["af-admins", "af-ops"]);
    expect(user.roles).toEqual([]);
    expect(user.roles).toEqual([]);
    // and with a claim, the body is not added to it
    expect((await login({ preferred_username: "bob", groups: ["af-ops"] }, ["af-admins"])).roles).toEqual(["oidc/af-ops"]);
  });

  test("no filter keeps every group, an invalid one keeps every group as well", async () => {
    provider.groupfilter = "";
    expect((await login({ preferred_username: "bob", groups: ["af-admins", "everyone"] })).roles).toEqual(["oidc/af-admins", "oidc/everyone"]);
    provider.groupfilter = "(";
    expect((await login({ preferred_username: "bob", groups: ["af-admins", "everyone"] })).roles).toEqual(["oidc/af-admins", "oidc/everyone"]);
  });
});
