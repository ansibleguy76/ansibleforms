// An audit entry also goes to the syslog servers that get them : one line with what the row
// holds, the time and the request, the detail scrubbed as for the table - and sent even when the
// database refuses the row.
import { test, expect, vi } from "vitest";

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

// the logger as every test sees it (vitest.config.js aliases it to tests/__mocks__/logger.js)
const sent = [];
vi.mock("./__mocks__/logger.js", () => ({
  default: { error() {}, warning() {}, debug() {}, notice() {}, info() {} },
  sendAuditLine: (entry) => sent.push(entry),
}));
let dbThrows = false;
vi.mock("../src/models/db.model.js", () => ({ default: { do: async () => { if (dbThrows) throw new Error("ER_DISK_FULL"); return []; } } }));
vi.mock("../src/lib/requestContext.js", () => ({ currentRequest: () => ({ requestId: "req-42" }) }));

const { default: Audit } = await import("../src/models/audit.model.js");

test("who, what, on what, how it went, from where and which request ; no secret", async () => {
  await Audit.log({
    user: { username: "bob", type: "ldap" },
    action: "credential.update",
    targetType: "credential",
    target: "db-prod",
    ip: "::ffff:10.1.2.3",
    detail: { user: "svc", password: "hunter2" },
  });
  const line = sent.at(-1);
  expect(line).toMatchObject({
    actor: "bob", actor_type: "ldap", ip: "10.1.2.3", action: "credential.update", target_type: "credential",
    target: "db-prod", outcome: "success", request_id: "req-42", detail: { user: "svc", password: "[redacted]" },
  });
  expect(JSON.stringify(line)).not.toContain("hunter2");
  expect(Date.parse(line.time)).not.toBeNaN();
});

test("a system action, and a database that refuses the row : the line still goes", async () => {
  dbThrows = true;
  await Audit.log({ action: "backup.create", outcome: "failure" });
  expect(sent.at(-1)).toMatchObject({ actor: null, actor_type: "system", action: "backup.create", outcome: "failure" });
  dbThrows = false;
});
