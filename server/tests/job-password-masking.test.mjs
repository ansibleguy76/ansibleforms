// A job read through the API (Job.findById with logSafe) returns its stored extravars with
// every password field of its form masked - not only the keys MASK_EXTRAVARS_REGEX catches.
import { describe, test, expect, vi } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

const stored = {
  secrets: { pw: "s3cr3t" },
  users: [{ name: "bob", token: "t0k" }],
  config: { key: "k3y", host: "web1" },
  host: "prod-1",
};
vi.mock("../src/models/db.model.js", () => ({
  default: {
    // every query answers with the job, except the job output read, which has none
    do: async (sql) => (/COALESCE\(output/.test(sql)
      ? []
      : [{ id: 7, form: "Secrets form", status: "success", extravars: JSON.stringify(stored), credentials: "{}" }]),
  },
}));
vi.mock("../src/models/form.model.js", () => ({
  default: {
    load: vi.fn(async () => ({ forms: [{
      name: "Secrets form",
      subforms: [
        { name: "user", type: "subform", fields: [{ name: "name", type: "text" }, { name: "token", type: "password" }] },
        { name: "cfg", type: "subform", fields: [{ name: "key", type: "password" }, { name: "host", type: "text" }] },
      ],
      fields: [
        { name: "pw", type: "password", model: "secrets.pw" },
        { name: "users", type: "list", subform: "user" },
        { name: "config", type: "yaml", subform: "cfg" },
        { name: "host", type: "text" },
      ],
    }] })),
  },
}));

const Job = (await import("../src/models/job.model.js")).default;
const Form = (await import("../src/models/form.model.js")).default;
const admin = { username: "admin", roles: ["admin"], options: {} };

describe("a job read through the API", () => {
  test("masks every password field of its form, by definition - rows and yaml subforms included", async () => {
    const job = await Job.findById(admin, 7, true, true);
    const ev = JSON.parse(job.extravars);
    expect(ev.secrets.pw).toBe("********");
    expect(ev.users[0]).toEqual({ name: "bob", token: "********" });
    expect(ev.config).toEqual({ key: "********", host: "web1" });
    expect(ev.host).toBe("prod-1");
    expect(job.extravars).not.toMatch(/s3cr3t|t0k|k3y/);
  });

  test("the server-side read (no logSafe) keeps the values, for a relaunch or an approval", async () => {
    const job = await Job.findById(admin, 7, true, false);
    expect(JSON.parse(job.extravars).secrets.pw).toBe("s3cr3t");
  });

  test("the form definition is cached, not loaded on every read", async () => {
    Form.load.mockClear();
    await Job.findById(admin, 7, true, true);
    await Job.findById(admin, 7, true, true);
    expect(Form.load).toHaveBeenCalledTimes(0);
  });
});
