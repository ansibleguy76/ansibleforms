// Ask again (models/disclaimer.model.js) : the acceptances ticked no longer count - kept, marked
// when and by whom - and their users accept again in a row of their own.
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

test("the acceptances ticked are marked asked again, by whom ; none given is refused", async () => {
  answers = [{ match: /^UPDATE AnsibleForms\.`disclaimer_acceptances` SET asked_again_at/, rows: { affectedRows: 2 } }];
  expect(await Disclaimer.askAgain([3, "4", "x"], "admin")).toBe(2);
  const update = queries.find((q) => /SET asked_again_at/.test(q.sql));
  expect(update.sql).toMatch(/asked_again_at IS NULL/);
  expect(update.args[1]).toBe("admin");
  expect(update.args[2]).toEqual([3, 4]);
  await expect(Disclaimer.askAgain([], "admin")).rejects.toThrow(/No acceptance/);
});

test("an acceptance asked again no longer counts : the user accepts again, in a new row", async () => {
  answers = [
    { match: /SELECT disclaimer_enabled/, rows: [{ disclaimer_enabled: 1 }] },
    { match: /FROM AnsibleForms\.`disclaimer_versions`/, rows: [{ version: 2, title: "t", text: "x", checkbox_label: "ok" }] },
  ];
  const jane = { username: "jane", type: "local" };
  expect(await Disclaimer.isRequired(jane)).toBe(true);
  expect(queries.some((q) => /asked_again_at IS NULL/.test(q.sql))).toBe(true);
  await Disclaimer.accept(jane, 2, "10.0.0.1", "ua");
  expect(queries.some((q) => /^INSERT INTO AnsibleForms\.`disclaimer_acceptances`/.test(q.sql))).toBe(true);
});
