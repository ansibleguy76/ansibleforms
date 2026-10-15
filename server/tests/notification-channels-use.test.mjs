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
const { moveMailServersToChannels, copyMailSettingsToServers, moveMailServersToCredentials, moveSsoClientsToCredentials, moveLdapServersToCredentials, moveRunnerSecretsToCredentials, moveBannerSwitchToAnnouncements } = await import("../src/models/schema.model.js");

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

describe("a mail channel's server moves to its smtp credential", () => {
  const channel = (over) => ({ id: 1, name: "office", server: "smtp.example.com", port: 587, secure: 1, credential: "o365", ...over });

  test("no channel with a server left : nothing to do", async () => {
    expect(await moveMailServersToCredentials()).toBe(null);
  });

  test("a credential without a server : the channel's goes into it, the channel's emptied", async () => {
    answers = [
      { match: /FROM AnsibleForms\.`notification_channels`/, rows: [channel()] },
      { match: /SELECT \* FROM AnsibleForms\.`credentials` WHERE name/, rows: [{ id: 9, name: "o365", host: null }] },
    ];
    expect(await moveMailServersToCredentials()).toMatch(/office into o365/);
    const into = queries.find((q) => /^UPDATE AnsibleForms\.`credentials` SET host/.test(q.sql));
    expect(into.args).toEqual(["smtp.example.com", 587, 1, 9]);
    const emptied = queries.find((q) => /^UPDATE AnsibleForms\.`notification_channels` SET server = NULL/.test(q.sql));
    expect(emptied.args).toEqual(["o365", 1]);
  });

  test("a credential with another server : a copy with the channel's, which the channel then names", async () => {
    answers = [
      { match: /FROM AnsibleForms\.`notification_channels`/, rows: [channel()] },
      { match: /SELECT \* FROM AnsibleForms\.`credentials` WHERE name/, rows: [{ id: 9, name: "o365", host: "other.example.com", port: 25, secure: 0 }] },
    ];
    expect(await moveMailServersToCredentials()).toMatch(/a copy of o365, o365-office/);
    expect(queries.find((q) => /^INSERT INTO AnsibleForms\.`credentials`/.test(q.sql)).args.slice(2, 5)).toEqual(["smtp.example.com", 587, 1]);
    expect(queries.find((q) => /SET server = NULL/.test(q.sql)).args).toEqual(["o365-office", 1]);
  });

  test("no credential (a relay) : a new smtp one without a user", async () => {
    answers = [{ match: /FROM AnsibleForms\.`notification_channels`/, rows: [channel({ name: "relay", credential: null, port: 25, secure: 0 })] }];
    expect(await moveMailServersToCredentials()).toMatch(/relay into relay-smtp/);
    const insert = queries.find((q) => /^INSERT INTO AnsibleForms\.`credentials`/.test(q.sql));
    expect(insert.sql).toMatch(/'smtp'/);
    expect(insert.args).toEqual(["relay-smtp", "The server of the mail channel relay", "smtp.example.com", 25, 0]);
  });
});

describe("a mail channel sends through its credential's server", () => {
  test("the credential's server, port and TLS ; its own while the credential has none", async () => {
    answers = [{ match: /credential/, rows: [{ name: "o365", host: "smtp.office365.com", port: 587, secure: 1 }] }];
    vi.spyOn(NotificationChannel, "resolveCredential").mockResolvedValue({ user: "u", password: "p" });
    const config = await NotificationChannel.toMailConfig({ name: "m", server: "old.example.com", port: 25, credential: "o365", from_address: "af@example.com" });
    expect(config).toMatchObject({ mail_server: "smtp.office365.com", mail_port: 587, mail_secure: 1, mail_username: "u" });
    answers = [{ match: /credential/, rows: [{ name: "old-login", host: null }] }];
    const legacy = await NotificationChannel.toMailConfig({ name: "m", server: "old.example.com", port: 25, credential: "old-login" });
    expect(legacy).toMatchObject({ mail_server: "old.example.com", mail_port: 25 });
  });

  test("a relay's credential has no user : no login", async () => {
    answers = [{ match: /credential/, rows: [{ name: "relay-smtp", host: "relay.example.com", port: 25 }] }];
    vi.spyOn(NotificationChannel, "resolveCredential").mockResolvedValue({ user: "", password: "" });
    const config = await NotificationChannel.toMailConfig({ name: "r", credential: "relay-smtp" });
    expect(config).toMatchObject({ mail_server: "relay.example.com", mail_username: "" });
  });
});

describe("an SSO provider's client moves to a credential of its type", () => {
  test("its own client : a new credential, named after it, with its tenant ; the provider's emptied", async () => {
    answers = [{ match: /FROM AnsibleForms\.`oauth2_providers`/, rows: [{ id: 3, name: "Contoso Entra ID", provider: "azuread", tenant_id: "t-1", redirect_uri: "https://f/cb", client_id: "c-1", client_secret: "enc", credential: null }] }];
    expect(await moveSsoClientsToCredentials()).toMatch(/Contoso Entra ID into contoso-entra-id-sso/);
    const insert = queries.find((q) => /^INSERT INTO AnsibleForms\.`credentials`/.test(q.sql));
    expect(insert.args).toEqual(["contoso-entra-id-sso", "c-1", "enc", "The client of the SSO provider Contoso Entra ID", "entraid", "t-1", null, "https://f/cb"]);
    expect(queries.find((q) => /SET client_id = NULL/.test(q.sql)).args).toEqual(["contoso-entra-id-sso", 3]);
  });

  test("a credential already : its issuer copied into it when it has none", async () => {
    answers = [{ match: /FROM AnsibleForms\.`oauth2_providers`/, rows: [{ id: 4, name: "kc", provider: "oidc", issuer: "https://kc/realms/a", credential: "kc-app" }] }];
    expect(await moveSsoClientsToCredentials()).toMatch(/kc kept kc-app/);
    const into = queries.find((q) => /^UPDATE AnsibleForms\.`credentials` SET issuer/.test(q.sql));
    expect(into.args).toEqual(["https://kc/realms/a", "kc-app"]);
  });

  test("nothing of its own left : nothing to do", async () => {
    expect(await moveSsoClientsToCredentials()).toBe(null);
  });
});

describe("an LDAP directory's servers move to its ldap credential", () => {
  const dir = (over) => ({ id: 2, name: "eu", server: "ldap.eu:636", port: 636, enable_tls: 1, ignore_certs: 0, cert: null, ca_bundle: "CA", bind_user_dn: "cn=svc", bind_user_pw: "enc", credential: "eu-bind", ...over });

  test("a credential without servers : the directory's go into it, the directory's emptied", async () => {
    answers = [
      { match: /FROM AnsibleForms\.`ldap`/, rows: [dir()] },
      { match: /SELECT \* FROM AnsibleForms\.`credentials` WHERE name/, rows: [{ id: 9, name: "eu-bind", host: null }] },
    ];
    expect(await moveLdapServersToCredentials()).toMatch(/eu into eu-bind/);
    const into = queries.find((q) => /^UPDATE AnsibleForms\.`credentials` SET \?/.test(q.sql));
    expect(into.args[0]).toMatchObject({ host: "ldap.eu:636", port: 636, secure: 1, ca_bundle: "CA" });
    expect(queries.find((q) => /UPDATE AnsibleForms\.`ldap` SET server = NULL/.test(q.sql)).args).toEqual(["eu-bind", 2]);
  });

  test("its own bind account : a new ldap credential with it and the servers", async () => {
    answers = [{ match: /FROM AnsibleForms\.`ldap`/, rows: [dir({ credential: null })] }];
    expect(await moveLdapServersToCredentials()).toMatch(/eu into eu-ldap/);
    const insert = queries.find((q) => /^INSERT INTO AnsibleForms\.`credentials` SET/.test(q.sql));
    expect(insert.args[0]).toMatchObject({ name: "eu-ldap", user: "cn=svc", password: "enc", credential_type: "ldap", host: "ldap.eu:636" });
  });

  test("nothing of its own left : nothing to do", async () => {
    expect(await moveLdapServersToCredentials()).toBe(null);
  });
});

describe("a runner's token or login moves to a credential", () => {
  test("a token : an api credential with it ; a Jenkins : a userpass one with its user and token", async () => {
    answers = [{ match: /FROM AnsibleForms\.`runners`/, rows: [
      { id: 1, name: "semaphore-prod", type: "semaphore", token: "enc-t" },
      { id: 2, name: "jenkins-ci", type: "jenkins", username: "af", token: "enc-j" },
      { id: 3, name: "awx-login", type: "awx", use_credentials: 1, username: "admin", password: "enc-p" },
    ] }];
    expect(await moveRunnerSecretsToCredentials()).toMatch(/3 runner/);
    const inserts = queries.filter((q) => /^INSERT INTO AnsibleForms\.`credentials` SET/.test(q.sql)).map((q) => q.args[0]);
    expect(inserts[0]).toMatchObject({ name: "semaphore-prod-token", credential_type: "api", user: null, password: "enc-t" });
    expect(inserts[1]).toMatchObject({ name: "jenkins-ci-login", credential_type: "userpass", user: "af", password: "enc-j" });
    expect(inserts[2]).toMatchObject({ name: "awx-login-login", credential_type: "userpass", user: "admin", password: "enc-p" });
    expect(queries.filter((q) => /UPDATE AnsibleForms\.`runners` SET token = NULL/.test(q.sql)).map((q) => q.args)).toEqual([
      ["semaphore-prod-token", 1], ["jenkins-ci-login", 2], ["awx-login-login", 3],
    ]);
  });

  test("none left : nothing to do", async () => {
    expect(await moveRunnerSecretsToCredentials()).toBe(null);
  });
});

describe("the announcements' switch of before moves to each announcement", () => {
  test("switched on : nothing to do", async () => {
    answers = [{ match: /SELECT banner_show/, rows: [{ banner_show: 1 }] }];
    expect(await moveBannerSwitchToAnnouncements()).toBe(null);
    expect(queries.some((q) => /UPDATE/.test(q.sql))).toBe(false);
  });
  test("switched off : every announcement disabled, the switch back on", async () => {
    answers = [
      { match: /SELECT banner_show/, rows: [{ banner_show: 0 }] },
      { match: /UPDATE AnsibleForms\.`announcements`/, rows: { affectedRows: 2 } },
    ];
    expect(await moveBannerSwitchToAnnouncements()).toMatch(/disabled 2 announcement/);
    expect(queries.some((q) => /SET banner_show = 1/.test(q.sql))).toBe(true);
  });
});
