// ENFORCE_LAUNCH_VALIDATION : a REST launch checked against the form's rules with the same
// engine as the browser and the MCP server (lib/launchValidation.js, Job.launch guardLaunch).
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));

const { guardLaunch } = await import("../src/models/job.model.js");
const appConfig = (await import("./__mocks__/app.config.js")).default;
const logger = (await import("./__mocks__/logger.js")).default;
const { validateLaunch, describeLaunchErrors } = await import("../src/lib/launchValidation.js");
const { evalSandbox } = await import("../src/lib/formEngine/node/sandbox.js");

const user = { username: "bob", roles: ["public"], options: {} };
const formObj = {
  name: "Create host",
  fields: [
    { name: "host", type: "text", required: true, regex: { expression: "^prod-", description: "Must start with prod-" } },
    { name: "pw", type: "password", model: "secrets.pw" },
    { name: "pw2", type: "password", sameAs: "pw" },
    { name: "upload", type: "file", maxSize: 1024 },
  ],
};
const formConfig = { constants: {}, forms: [formObj] };
const services = { evalSandbox, serverExpression: vi.fn(), query: vi.fn() };
const args = (rawFormData, extravars = {}) => ({ form: formObj.name, formConfig, formObj, user, rawFormData, extravars });

let warned;
beforeEach(() => {
  warned = [];
  logger.warning = (m) => warned.push(m);
  appConfig.enforceLaunchValidation = false;
});
afterEach(() => { delete appConfig.enforceLaunchValidation; });

describe("validateLaunch", () => {
  test("the raw field values are checked, passwords read back from the modelled extravars", async () => {
    const r = await validateLaunch({ formConfig, formObj, user, services,
      rawFormData: { host: "prod-1" }, extravars: { host: "prod-1", secrets: { pw: "a" }, pw2: "b" } });
    expect(r.ok).toBe(false);
    expect(r.errors.validationErrors).toEqual({ pw2: [{ type: "sameAs", description: "Must match the field 'pw'" }] });
  });

  test("a file is validated on its descriptor, not refused", async () => {
    const r = await validateLaunch({ formConfig, formObj, user, services,
      rawFormData: { host: "prod-1", upload: { name: "a.txt", size: 4096 } }, extravars: {} });
    expect(r.errors.validationErrors.upload[0].type).toBe("maxSize");
  });

  test("a wizard form is skipped", async () => {
    const r = await validateLaunch({ formConfig, formObj: { ...formObj, wizard: [{ subform: "s1" }] }, user, services, rawFormData: {}, extravars: {} });
    expect(r.skipped).toMatch(/wizard/);
  });

  test("the log line names fields and rule types, never values", () => {
    const line = describeLaunchErrors({ missing: ["a"], invalid: ["host", "cluster"], waiting: [],
      validationErrors: { host: [{ type: "regex", description: "contains s3cr3t" }] } });
    expect(line).toBe("missing : a ; failing rules : host (regex) ; not one of the options : cluster");
    expect(line).not.toContain("s3cr3t");
  });
});

describe("guardLaunch", () => {
  test("off : an invalid launch is logged and goes ahead", async () => {
    await expect(guardLaunch(args({ host: "test-1" }))).resolves.toBeUndefined();
    expect(warned.join("\n")).toMatch(/would refuse form 'Create host' for bob .* failing rules : host \(regex\)/);
  });

  test("on : an invalid launch is refused with the failing fields", async () => {
    appConfig.enforceLaunchValidation = true;
    const err = await guardLaunch(args({ host: "test-1" })).catch((e) => e);
    expect(err.name).toBe("ValidationError");
    expect(err.status).toBe(422);
    expect(err.details.validationErrors).toEqual({ host: [{ type: "regex", description: "Must start with prod-" }] });
  });

  test("on : a valid launch goes ahead", async () => {
    appConfig.enforceLaunchValidation = true;
    await expect(guardLaunch(args({ host: "prod-1" }))).resolves.toBeUndefined();
    expect(warned).toEqual([]);
  });

  test("on : leaving rawFormData out is not a way around the check", async () => {
    appConfig.enforceLaunchValidation = true;
    const err = await guardLaunch(args({}, { host: "anything" })).catch((e) => e);
    expect(err.name).toBe("ValidationError");
    expect(err.message).toMatch(/no rawFormData was sent/);
  });
});
