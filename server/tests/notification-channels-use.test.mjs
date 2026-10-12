// Notification channels in use : a form names them (its notifications, its approval - the schema
// takes channels next to recipients), a job's end and an approval reach them with a link to the
// job, and the mail servers of a 7 release candidate become mail channels when the database is
// upgraded.
import { describe, test, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import Ajv from "ajv";
import { createRequire } from "module";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

// the queries ; each answers what the test queues (else [])
const queries = [];
let answers = [];
vi.mock("../src/models/db.model.js", () => ({
  default: {
    do: async (sql, args) => {
      queries.push({ sql, args });
      const next = answers.find((a) => a.match.test(sql));
      return next ? (typeof next.rows === "function" ? next.rows(sql, args) : next.rows) : [];
    },
  },
}));

// what reached the channels
const sent = [];
vi.mock("../src/lib/notifiers.js", () => ({
  sendToChannels: async (names, message, recipients, context) => {
    sent.push({ names, message, recipients, context });
    return names.map((name) => ({ name, ok: true }));
  },
}));

const require = createRequire(import.meta.url);
const Job = (await import("../src/models/job.model.js")).default;
const { default: Settings } = await import("../src/models/settings.model.js");
const { channelsOfForm } = await import("../src/models/form.model.js");
const { default: NotificationChannel } = await import("../src/models/notificationChannel.model.js");
const { moveMailServersToChannels, copyMailSettingsToServers } = await import("../src/models/schema.model.js");

beforeEach(() => {
  queries.length = 0;
  answers = [];
  sent.length = 0;
  vi.restoreAllMocks();
});

describe("a form's channels, in the schema", () => {
  const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
  ajv.addMetaSchema(require("ajv/lib/refs/json-schema-draft-06.json"));
  const validate = ajv.compile(JSON.parse(fs.readFileSync(new URL("../schema/form_schema.json", import.meta.url), "utf8")));
  const form = (over) => ({ name: "f", type: "ansible", playbook: "p.yml", roles: ["admin"], fields: [], ...over });

  test("notifications take channels next to recipients, or alone ; one of them at least", () => {
    expect(validate(form({ notifications: { channels: ["ops-slack"], onStatus: ["failed"] } }))).toBe(true);
    expect(validate(form({ notifications: { recipients: ["a@example.com"], channels: ["ops-teams"] } }))).toBe(true);
    expect(validate(form({ notifications: { onStatus: ["failed"] } }))).toBe(false);
    expect(validate(form({ notifications: { channels: [""] } }))).toBe(false);
  });

  test("an approval takes channels, with or without its mail notifications", () => {
    expect(validate(form({ approval: { message: "ok ?", roles: ["admin"], channels: ["approvers"] } }))).toBe(true);
  });

  test("the channels a form names : its notifications', its approval's and its steps', each once", () => {
    expect(
      channelsOfForm({
        notifications: { channels: ["a", "b"] },
        approval: { channels: ["b", "c"] },
        steps: [{ notifications: { channels: ["d"] } }, { approval: { channels: ["", "e"] } }],
      }),
    ).toEqual(["a", "b", "c", "d", "e"]);
    expect(channelsOfForm({})).toEqual([]);
  });
});

describe("a job's end and an approval reach the channels", () => {
  const job = { id: 12, form: "Deploy", job_type: "ansible", status: "success", user: "bob", output: "" };

  test("a status notification with channels only : a short text and the link to the job", async () => {
    vi.spyOn(Job, "findById").mockResolvedValue({ ...job, notifications: JSON.stringify({ channels: ["ops"], onStatus: ["success"] }) });
    vi.spyOn(Settings, "findUrl").mockResolvedValue({ url: "https://af.example.com/" });
    expect(await Job.sendStatusNotification(12)).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].names).toEqual(["ops"]);
    expect(sent[0].message).toMatchObject({ status: "success", event: "status", link: "https://af.example.com/jobs/12" });
    expect(sent[0].message.text).toContain("12");
    expect(sent[0].message.text).toContain("Deploy");
  });

  test("a status it does not notify on : nothing sent", async () => {
    vi.spyOn(Job, "findById").mockResolvedValue({ ...job, notifications: JSON.stringify({ channels: ["ops"], onStatus: ["failed"] }) });
    expect(await Job.sendStatusNotification(12)).toBe(false);
    expect(sent).toHaveLength(0);
  });

  test("an approval with channels : its title and message, the link, its mail recipients handed on", async () => {
    vi.spyOn(Settings, "findUrl").mockResolvedValue({ url: "https://af.example.com" });
    const approval = { title: "Remove $(vm) ?", message: "About to remove $(vm).", roles: ["admin"], channels: ["approvers"] };
    expect(await Job.sendApprovalNotification(approval, { vm: "web1" }, 30)).toBe(true);
    expect(sent[0].names).toEqual(["approvers"]);
    expect(sent[0].message).toMatchObject({ title: "Remove web1 ?", text: "About to remove web1.", link: "https://af.example.com/jobs/30", status: "approve" });
    expect(sent[0].context).toBe("Approval");
  });

  test("a mail channel named : the usual mail through it, not the active one ; the others by name", async () => {
    vi.spyOn(Job, "findById").mockResolvedValue({ ...job, notifications: JSON.stringify({ recipients: ["ops@example.com"], channels: ["relay", "ops"], onStatus: ["any"] }) });
    vi.spyOn(Settings, "findUrl").mockResolvedValue({ url: "https://af.example.com" });
    const relay = { id: 2, name: "relay", type: "mail", enabled: 1, server: "relay.example.com", port: 25, from_address: "af@example.com" };
    vi.spyOn(NotificationChannel, "findByName").mockImplementation(async (name) => (name === "relay" ? relay : null));
    const mailed = vi.spyOn(Job, "_buildAndSendEmail").mockResolvedValue(true);
    expect(await Job.sendStatusNotification(12)).toBe(true);
    expect(mailed).toHaveBeenCalledTimes(1);
    expect(mailed.mock.calls[0][0]).toMatchObject({ recipients: ["ops@example.com"], templatePath: "jobstatus.html", server: relay });
    expect(sent[0].names).toEqual(["ops"]);
  });

  test("no mail channel named : the usual mail through the active one", async () => {
    vi.spyOn(Job, "findById").mockResolvedValue({ ...job, notifications: JSON.stringify({ recipients: ["ops@example.com"], onStatus: ["any"] }) });
    const mailed = vi.spyOn(Job, "_buildAndSendEmail").mockResolvedValue(true);
    await Job.sendStatusNotification(12);
    expect(mailed.mock.calls[0][0].server).toBeUndefined();
    expect(sent).toHaveLength(0);
  });

  test("no url set : the channels still get it, without a link", async () => {
    vi.spyOn(Settings, "findUrl").mockResolvedValue({ url: "" });
    await Job.sendApprovalNotification({ message: "m", roles: ["admin"], channels: ["x"] }, {}, 1);
    expect(sent[0].message.link).toBe("");
  });
});

describe("the mail servers of a release candidate become mail channels", () => {
  test("no mail_servers table : nothing to do", async () => {
    answers = [{ match: /SHOW TABLES FROM AnsibleForms LIKE 'mail_servers'/, rows: [] }];
    expect(await moveMailServersToChannels()).toBe(null);
  });

  test("copied as mail channels, then the table dropped", async () => {
    answers = [
      { match: /LIKE 'mail_servers'/, rows: [{ t: "mail_servers" }] },
      { match: /^INSERT INTO AnsibleForms\.`notification_channels`/, rows: { affectedRows: 2 } },
      { match: /SELECT m\.name FROM AnsibleForms\.`mail_servers` m WHERE NOT EXISTS/, rows: [] },
      { match: /SHOW TABLES FROM \?\? WHERE/, rows: [{ Tables_in_AnsibleForms: "mail_servers" }] },
      { match: /DROP TABLE IF EXISTS/, rows: { affectedRows: 0 } },
    ];
    expect(await moveMailServersToChannels()).toMatch(/Moved 2 mail server\(s\)/);
    const insert = queries.find((q) => /^INSERT INTO AnsibleForms\.`notification_channels`/.test(q.sql));
    expect(insert.sql).toMatch(/SELECT m\.name, m\.description, 'mail', 1, m\.is_active/);
    expect(queries.some((q) => /DROP TABLE IF EXISTS/.test(q.sql))).toBe(true);
  });

  test("one named like a channel of another type : not copied over it, and the table kept", async () => {
    answers = [
      { match: /LIKE 'mail_servers'/, rows: [{ t: "mail_servers" }] },
      { match: /^INSERT INTO/, rows: { affectedRows: 1 } },
      { match: /SELECT m\.name FROM AnsibleForms\.`mail_servers` m WHERE NOT EXISTS/, rows: [{ name: "ops" }] },
    ];
    expect(await moveMailServersToChannels()).toMatch(/ops could not move/);
    expect(queries.some((q) => /DROP TABLE/.test(q.sql))).toBe(false);
  });

  test("the mail settings of before : the first mail channel, only while there is none", async () => {
    answers = [{ match: /COUNT\(\*\) AS n FROM AnsibleForms\.`notification_channels` WHERE type = 'mail'/, rows: [{ n: 1 }] }];
    expect(await copyMailSettingsToServers()).toBe(null);
    answers = [
      { match: /COUNT\(\*\) AS n/, rows: [{ n: 0 }] },
      { match: /SELECT \* FROM AnsibleForms\.`settings`/, rows: [{ mail_server: "smtp.example.com", mail_port: 25 }] },
    ];
    expect(await copyMailSettingsToServers()).toMatch(/mail channel 'default'/);
    const insert = queries.find((q) => /INSERT INTO AnsibleForms\.`notification_channels`/.test(q.sql));
    expect(insert.sql).toMatch(/VALUES \(\?, \?, 'mail', 1/);
  });
});
