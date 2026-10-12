// The 7 patch fills an old job's runner kind from its runner's type and flavour. On a database from
// before runners.flavour, filling it before that column was added failed (Unknown column
// 'r.flavour') : the start ended with "Patching failed" until the next one. The fill comes after
// every runners column it reads.
import { test, expect, vi } from "vitest";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

// a database whose tables are there, the runners table without flavour and project yet
const columns = { runners: new Set(["id", "name", "type", "uri", "token", "username", "password", "use_credentials", "node_id"]) };
const order = [];
vi.mock("../src/models/db.model.js", () => ({
  default: {
    do: async (sql, params) => {
      if (/^SHOW COLUMNS FROM/.test(sql)) {
        const [, table, field] = params;
        return columns[table] ? (columns[table].has(field) ? [{ Field: field }] : []) : [{ Field: field }];
      }
      if (/^ALTER TABLE \?\?\.\?\? ADD COLUMN/.test(sql)) {
        const [, table, field] = params;
        if (columns[table]) columns[table].add(field);
        order.push(`add ${table}.${field}`);
        return {};
      }
      if (/SET j\.runner_kind/.test(sql)) {
        if (!columns.runners.has("flavour")) throw new Error("Unknown column 'r.flavour' in 'field list'");
        order.push("fill runner_kind");
        return { affectedRows: 0 };
      }
      return [];
    },
  },
}));

const { patchVersion7 } = await import("../src/models/schema.model.js");

test("the runner kind is filled after runners.flavour exists, and the patch does not fail on it", async () => {
  const messages = [], success = [], failed = [];
  await patchVersion7(messages, success, failed);
  expect(failed.filter((f) => /r\.flavour/.test(f))).toEqual([]);
  expect(order.indexOf("fill runner_kind")).toBeGreaterThan(order.indexOf("add runners.flavour"));
});
