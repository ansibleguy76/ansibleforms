// LAUNCH_VALIDATION : a REST launch checked against the form's rules with the same
// engine as the browser and the MCP server (lib/launchValidation.js, Job.launch guardLaunch),
// and in `enforce` launched with the extravars the server builds.
import { describe, test, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => [] } }));

const { guardLaunch, launchValidationMode } = await import("../src/models/job.model.js");
const Form = (await import("../src/models/form.model.js")).default;
const appConfig = (await import("./__mocks__/app.config.js")).default;
const logger = (await import("./__mocks__/logger.js")).default;
const { validateLaunch, verifyUploads, compareExtravars, describeLaunchErrors, describeRowErrors } = await import("../src/lib/launchValidation.js");
const { evalSandbox } = await import("../src/lib/formEngine/node/sandbox.js");

const user = { username: "bob", roles: ["public"], options: {} };
const formObj = {
  name: "Create host",
  fields: [
    { name: "host", type: "text", required: true, regex: { expression: "^prod-", description: "Must start with prod-" }, model: "vm.name" },
    { name: "size", type: "number", default: 10 },
    { name: "pw", type: "password", model: "secrets.pw" },
    { name: "pw2", type: "password", sameAs: "pw", output: false },
    { name: "upload", type: "file", maxSize: 1024, regex: { expression: "\\.txt$", description: "txt only" } },
    { name: "cred", type: "credential", expression: "'cred_' + '$(host)'" },
  ],
};
const formConfig = { constants: {}, forms: [formObj] };
const services = { evalSandbox, serverExpression: vi.fn(), query: vi.fn() };

let uploadDir, outside;
const upload = (name, bytes) => {
  const p = path.join(uploadDir, `abc${bytes}`);
  fs.writeFileSync(p, "x".repeat(bytes));
  return { fieldname: "file", originalname: name, mimetype: "text/plain", encoding: "7bit", path: p, size: 1 };
};
beforeAll(() => {
  uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "af-uploads-"));
  outside = path.join(os.tmpdir(), `af-outside-${process.pid}`);
  fs.writeFileSync(outside, "secret");
});
afterAll(() => {
  fs.rmSync(uploadDir, { recursive: true, force: true });
  fs.rmSync(outside, { force: true });
});

const args = (rawFormData, extravars = {}, files = {}) => ({ form: formObj.name, formConfig, formObj, user, rawFormData, extravars, files });

let warned;
beforeEach(() => {
  warned = [];
  logger.warning = (m) => warned.push(m);
  appConfig.launchValidation = "log";
  appConfig.uploadPath = uploadDir;
});
afterEach(() => { delete appConfig.launchValidation; delete appConfig.uploadPath; });

describe("validateLaunch", () => {
  const run = (rawFormData, extravars = {}, files = {}) =>
    validateLaunch({ formConfig, formObj, user, services, rawFormData, extravars, files, uploadPath: uploadDir });

  test("the raw field values are checked, passwords read back from the modelled extravars", async () => {
    const r = await run({ host: "prod-1" }, { secrets: { pw: "a" }, pw2: "b" });
    expect(r.ok).toBe(false);
    expect(r.errors.validationErrors).toEqual({ pw2: [{ type: "sameAs", description: "Must match the field 'pw'" }] });
  });

  test("a valid launch comes with the extravars and credentials the server built", async () => {
    const r = await run({ host: "prod-1", pw2: "a" }, { secrets: { pw: "a" }, __verbose__: true });
    expect(r.ok).toBe(true);
    expect(r.payload.extravars).toEqual({ vm: { name: "prod-1" }, size: 10, secrets: { pw: "a" }, cred: "cred_prod-1", __verbose__: true });
    expect(r.payload.credentials).toEqual({ cred: "cred_prod-1" });
  });

  test("a wizard form is skipped", async () => {
    const r = await validateLaunch({ formConfig, formObj: { ...formObj, wizard: [{ subform: "s1" }] }, user, services, rawFormData: {}, extravars: {} });
    expect(r.skipped).toMatch(/wizard/);
  });

  test("the log line names fields and rule types, never values", () => {
    const line = describeLaunchErrors({ missing: ["a"], invalid: ["host", "cluster"], waiting: [],
      validationErrors: { host: [{ type: "regex", description: "contains s3cr3t" }] },
      uploads: [{ field: "upload", reason: "the uploaded file does not exist" }] });
    expect(line).toBe("missing : a ; failing rules : host (regex) ; invalid : cluster ; uploads : upload (the uploaded file does not exist)");
    expect(line).not.toContain("s3cr3t");
  });
});

describe("list row errors", () => {
  test("name the row and the rule, nested rows included, never a value", () => {
    const line = describeRowErrors({
      disks: [{ index: 1, invalid: ["name"], validationErrors: { name: [{ type: "regex", description: "s3cr3t" }] } }],
      vms: [{ index: 0, invalid: ["disks"], rowErrors: { disks: [{ index: 2, missing: ["size"] }] } }],
    });
    expect(line).toEqual(["disks[1].name (regex)", "vms[0].disks[2].size (missing)"]);
    expect(describeLaunchErrors({ invalid: ["disks"], rowErrors: { disks: [{ index: 0, missing: ["x"] }] } }))
      .toBe("failing rows : disks[0].x (missing)");
  });
});

describe("uploads", () => {
  test("a file is checked on the upload : name and the size on disk, not the size claimed", async () => {
    const r = await validateLaunch({ formConfig, formObj, user, services, uploadPath: uploadDir,
      rawFormData: { host: "prod-1", upload: {} }, extravars: {}, files: { upload: upload("a.exe", 2048) } });
    expect(r.ok).toBe(false);
    expect(r.errors.validationErrors.upload.map((e) => e.type)).toEqual(["maxSize", "regex"]);
  });

  test("the extravars hold the verified upload", async () => {
    const u = upload("notes.txt", 100);
    const r = await validateLaunch({ formConfig, formObj, user, services, uploadPath: uploadDir,
      rawFormData: { host: "prod-1" }, extravars: {}, files: { upload: { ...u, size: 1, destination: "/elsewhere" } } });
    expect(r.ok).toBe(true);
    expect(r.payload.extravars.upload).toMatchObject({ originalname: "notes.txt", path: u.path, size: 100, destination: uploadDir });
  });

  test("an upload outside the upload folder, or one that does not exist, is refused", () => {
    const res = verifyUploads(formObj, { upload: { originalname: "x.txt", path: outside } }, uploadDir);
    expect(res.errors).toEqual([{ field: "upload", reason: "the upload is not in the upload folder" }]);
    const traversal = verifyUploads(formObj, { upload: { originalname: "x.txt", path: path.join(uploadDir, "..", path.basename(outside)) } }, uploadDir);
    expect(traversal.errors[0].reason).toBe("the upload is not in the upload folder");
    const gone = verifyUploads(formObj, { upload: { originalname: "x.txt", path: path.join(uploadDir, "nope") } }, uploadDir);
    expect(gone.errors[0].reason).toBe("the uploaded file does not exist");
  });
});

describe("compareExtravars", () => {
  test("names the top-level keys that differ, leaving reserved keys out", () => {
    expect(compareExtravars({ a: 1, b: { c: 2 }, x: 1, __verbose__: true, __playbook__: "p" }, { a: 1, b: { c: 3 }, y: 1 }))
      .toEqual(["b", "x", "y"]);
  });
});

describe("per-form launchValidation", () => {
  test("the stricter of the form and LAUNCH_VALIDATION wins", () => {
    appConfig.launchValidation = "off";
    expect(launchValidationMode({})).toBe("off");
    expect(launchValidationMode({ launchValidation: "enforce" })).toBe("enforce");
    expect(launchValidationMode({ launchValidation: "log" })).toBe("log");
    appConfig.launchValidation = "enforce";
    // a form can never loosen what the instance enforces
    expect(launchValidationMode({ launchValidation: "off" })).toBe("enforce");
    appConfig.launchValidation = "log";
    expect(launchValidationMode({ launchValidation: "enforce" })).toBe("enforce");
    expect(launchValidationMode({ launchValidation: "bogus" })).toBe("log");
  });

  test("a form with launchValidation: enforce is enforced while the instance is off", async () => {
    appConfig.launchValidation = "off";
    const strict = { ...formObj, launchValidation: "enforce" };
    const err = await guardLaunch({ ...args({ host: "test-1" }), formObj: strict }).catch((e) => e);
    expect(err.name).toBe("ValidationError");
    const built = await guardLaunch({ ...args({ host: "prod-1" }, { vm: { name: "forged" } }), formObj: strict });
    expect(built.extravars.vm).toEqual({ name: "prod-1" });
    // the same form without the property : no check at all
    await expect(guardLaunch(args({ host: "test-1" }))).resolves.toBeUndefined();
  });

  test("the form schema takes it on a form, refuses it on a wizard form and on a subform", () => {
    const base = { name: "F", type: "ansible", playbook: "p.yml", roles: ["public"], categories: [], fields: [{ name: "a", type: "text" }] };
    expect(() => Form.validateForm({ ...base, launchValidation: "enforce" })).not.toThrow();
    expect(() => Form.validateForm({ ...base, launchValidation: "strict" })).toThrow();
    const wizard = { ...base, fields: undefined, wizard: [{ subform: "s1" }] };
    expect(() => Form.validateForm(wizard)).not.toThrow();
    expect(() => Form.validateForm({ ...wizard, launchValidation: "enforce" })).toThrow();
    expect(() => Form.validateForm({ name: "S", type: "subform", fields: [{ name: "a", type: "text" }], launchValidation: "log" })).toThrow();
  });
});

describe("guardLaunch", () => {
  test("off : nothing is checked, nothing is logged", async () => {
    appConfig.launchValidation = "off";
    await expect(guardLaunch(args({ host: "test-1" }))).resolves.toBeUndefined();
    await expect(guardLaunch(args({}, { host: "anything" }))).resolves.toBeUndefined();
    expect(warned).toEqual([]);
  });

  test("log : an invalid launch is logged and goes ahead", async () => {
    await expect(guardLaunch(args({ host: "test-1" }))).resolves.toBeUndefined();
    expect(warned.join("\n")).toMatch(/would refuse form 'Create host' for bob .* failing rules : host \(regex\)/);
  });

  test("log : a verified upload is not reported as differing, however the browser wrote its path", async () => {
    const u = upload("notes.txt", 100);
    const browserCopy = { ...u, destination: "./persistent/uploads/", path: path.relative(process.cwd(), u.path), size: 100 };
    await guardLaunch(args({ host: "prod-1" }, { vm: { name: "prod-1" }, size: 10, secrets: {}, cred: "cred_prod-1", upload: browserCopy }, { upload: browserCopy }));
    expect(warned).toEqual([]);
  });

  test("log : forged extravars are named, the client's are still used", async () => {
    const forged = { vm: { name: "rm -rf" }, size: 10, secrets: {}, extra: "x" };
    await expect(guardLaunch(args({ host: "prod-1" }, forged))).resolves.toBeUndefined();
    expect(warned).toHaveLength(1);
    expect(warned[0]).toMatch(/extravars differ from the ones the server builds for cred, extra, vm/);
    expect(warned[0]).not.toContain("rm -rf");
  });

  test("enforce : an invalid launch is refused with the failing fields", async () => {
    appConfig.launchValidation = "enforce";
    const err = await guardLaunch(args({ host: "test-1" })).catch((e) => e);
    expect(err.name).toBe("ValidationError");
    expect(err.status).toBe(422);
    expect(err.details.validationErrors).toEqual({ host: [{ type: "regex", description: "Must start with prod-" }] });
  });

  test("enforce : valid rawFormData next to forged extravars runs the server's extravars", async () => {
    appConfig.launchValidation = "enforce";
    const built = await guardLaunch(args({ host: "prod-1" }, { vm: { name: "rm -rf" }, size: 999, cred: "stolen", __verbose__: true }));
    expect(built.extravars).toEqual({ vm: { name: "prod-1" }, size: 10, secrets: {}, cred: "cred_prod-1", __verbose__: true });
    expect(built.credentials).toEqual({ cred: "cred_prod-1" });
  });

  test("enforce : a file value in rawFormData without a verified upload never reaches the extravars", async () => {
    appConfig.launchValidation = "enforce";
    const built = await guardLaunch(args({ host: "prod-1", upload: { path: "/etc/shadow", originalname: "x.txt" } }, { upload: { path: "/etc/shadow" } }));
    expect(built.extravars.upload).toBeUndefined();
    expect(JSON.stringify(built)).not.toContain("/etc/shadow");
    // and a required file without an upload is missing
    const required = { ...formObj, fields: formObj.fields.map((f) => (f.name === "upload" ? { ...f, required: true } : f)) };
    const err = await guardLaunch({ ...args({ host: "prod-1", upload: {} }), formObj: required }).catch((e) => e);
    expect(err.details.missing).toEqual(["upload"]);
  });

  test("enforce : a forged upload path is refused", async () => {
    appConfig.launchValidation = "enforce";
    const err = await guardLaunch(args({ host: "prod-1" }, {}, { upload: { originalname: "x.txt", path: outside } })).catch((e) => e);
    expect(err.name).toBe("ValidationError");
    expect(err.details.uploads).toEqual([{ field: "upload", reason: "the upload is not in the upload folder" }]);
  });

  test("enforce : a wizard form is refused, it cannot be checked yet", async () => {
    appConfig.launchValidation = "enforce";
    const wizard = { ...formObj, wizard: [{ subform: "s1" }] };
    const err = await guardLaunch({ ...args({ host: "prod-1" }), formObj: wizard }).catch((e) => e);
    expect(err.name).toBe("ValidationError");
    expect(err.message).toMatch(/cannot be launched with launch validation 'enforce' yet/);
  });

  test("enforce : leaving rawFormData out is not a way around the check", async () => {
    appConfig.launchValidation = "enforce";
    const err = await guardLaunch(args({}, { host: "anything" })).catch((e) => e);
    expect(err.name).toBe("ValidationError");
    expect(err.message).toMatch(/no rawFormData was sent/);
  });
});
