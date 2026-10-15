// Ask again (models/disclaimer.model.js) : the acceptances ticked are cleared, and their users
// accept again.
import { test, expect, vi, beforeEach } from "vitest";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";

const queries = [];
let answers = [];
vi.mock("../src/models/db.model.js", () => ({
  default: {
    do: async (sql, args) => {
      queries.push({ sql, args });
      const hit = answers.find((a) => a.match.test(sql));
      return hit ? hit.rows : [];
    },
  },
}));
vi.mock("../src/lib/epochs.js", () => ({ bump: async () => {}, onEpoch: () => {} }));
const { default: Disclaimer, forgetDisclaimer } = await import("../src/models/disclaimer.model.js");

beforeEach(() => {
  queries.length = 0;
  answers = [];
  forgetDisclaimer();
});

test("the acceptances ticked are cleared ; none given is refused", async () => {
  answers = [{ match: /^DELETE FROM AnsibleForms\.`disclaimer_acceptances`/, rows: { affectedRows: 2 } }];
  expect(await Disclaimer.askAgain([3, "4", "x"], "admin")).toBe(2);
  const del = queries.find((q) => /^DELETE FROM/.test(q.sql));
  expect(del.args[0]).toEqual([3, 4]);
  await expect(Disclaimer.askAgain([], "admin")).rejects.toThrow(/No acceptance/);
});

test("a version : the current one is never deleted ; another goes with its acceptances ; restored as the next version", async () => {
  answers = [
    { match: /FROM AnsibleForms\.`disclaimer_versions` v ORDER BY/, rows: [{ version: 3, title: "t3" }, { version: 2, title: "t2", text: "x2", checkbox_label: "ok" }] },
    { match: /MAX\(version\)/, rows: [{ v: 3 }] },
  ];
  await expect(Disclaimer.deleteVersion(3)).rejects.toThrow(/current version/);
  await Disclaimer.deleteVersion(2);
  expect(queries.some((q) => /DELETE FROM AnsibleForms\.`disclaimer_acceptances` WHERE version/.test(q.sql) && q.args[0] === 2)).toBe(true);
  expect(await Disclaimer.restoreVersion(2, "admin")).toBe(4);
  const insert = queries.find((q) => /^INSERT INTO AnsibleForms\.`disclaimer_versions`/.test(q.sql));
  expect(insert.args).toMatchObject({ version: 4, title: "t2", text: "x2", created_by: "admin" });
});
