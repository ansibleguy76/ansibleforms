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

test("a version, the current one too, goes with its acceptances ; restored, it is the current one", async () => {
  answers = [
    { match: /FROM AnsibleForms\.`disclaimer_versions` ORDER BY \(version/, rows: [{ version: 3 }] },
    { match: /FROM AnsibleForms\.`disclaimer_versions` v ORDER BY/, rows: [{ version: 3, title: "t3" }, { version: 2, title: "t2", text: "x2", checkbox_label: "ok" }] },
    { match: /MAX\(version\)/, rows: [{ v: 3 }] },
    { match: /COUNT\(\*\) AS n FROM AnsibleForms\.`disclaimer_versions`/, rows: [{ n: 1 }] },
  ];
  await Disclaimer.deleteVersion(3);
  expect(queries.some((q) => /DELETE FROM AnsibleForms\.`disclaimer_versions` WHERE version/.test(q.sql) && q.args[0] === 3)).toBe(true);
  // the current one deleted : none enabled, the disclaimer off
  expect(queries.some((q) => /SET disclaimer_version = NULL, disclaimer_enabled = 0/.test(q.sql))).toBe(true);
  await Disclaimer.deleteVersion(2);
  expect(queries.some((q) => /DELETE FROM AnsibleForms\.`disclaimer_acceptances` WHERE version/.test(q.sql) && q.args[0] === 2)).toBe(true);
  // restored : the current one, as it is (no copy) - who accepted it counts again
  expect(await Disclaimer.restoreVersion(2, "admin")).toBe(2);
  expect(queries.some((q) => /^INSERT INTO AnsibleForms\.`disclaimer_versions`/.test(q.sql))).toBe(false);
  const chosen = queries.find((q) => /SET disclaimer_version = \?/.test(q.sql));
  expect(chosen.args).toEqual([2]);
});

test("the last version deleted : the disclaimer is switched off", async () => {
  answers = [
    { match: /FROM AnsibleForms\.`disclaimer_versions` v ORDER BY/, rows: [{ version: 1, title: "t" }] },
    { match: /COUNT\(\*\) AS n FROM AnsibleForms\.`disclaimer_versions`/, rows: [{ n: 0 }] },
  ];
  await Disclaimer.deleteVersion(1);
  expect(queries.some((q) => /SET disclaimer_enabled = 0/.test(q.sql))).toBe(true);
});

test("a disclaimer added is a new version, not enabled ; the current one is pinned first", async () => {
  answers = [
    { match: /SELECT disclaimer_enabled/, rows: [{ disclaimer_enabled: 1 }] },
    { match: /FROM AnsibleForms\.`disclaimer_versions` ORDER BY \(version/, rows: [{ version: 2, title: "t", text: "x", checkbox_label: "ok" }] },
    { match: /MAX\(version\)/, rows: [{ v: 2 }] },
  ];
  await expect(Disclaimer.createVersion({ title: "t" }, "admin")).rejects.toThrow(/needs a title, a text/);
  expect(await Disclaimer.createVersion({ title: "New", text: "Words", checkbox_label: "I agree" }, "admin")).toBe(3);
  expect(queries.find((q) => /SET disclaimer_version = \? WHERE disclaimer_version IS NULL/.test(q.sql)).args).toEqual([2]);
  expect(queries.find((q) => /^INSERT INTO AnsibleForms\.`disclaimer_versions`/.test(q.sql)).args).toMatchObject({ version: 3, title: "New" });
  expect(queries.some((q) => /disclaimer_enabled = 1/.test(q.sql))).toBe(false);
});

test("a version enabled is the one users accept ; disabled, the disclaimer is off ; its words corrected, or asked again", async () => {
  answers = [
    { match: /SELECT disclaimer_enabled/, rows: [{ disclaimer_enabled: 1 }] },
    { match: /FROM AnsibleForms\.`disclaimer_versions` ORDER BY \(version/, rows: [{ version: 2 }] },
    { match: /FROM AnsibleForms\.`disclaimer_versions` v ORDER BY/, rows: [{ version: 2, title: "t2" }, { version: 1, title: "t1" }] },
  ];
  await Disclaimer.enableVersion(1, true, "admin");
  expect(queries.find((q) => /SET disclaimer_version = \?, disclaimer_enabled = 1/.test(q.sql)).args).toEqual([1]);
  await Disclaimer.enableVersion(2, false, "admin");
  expect(queries.some((q) => /^UPDATE AnsibleForms\.`settings` SET disclaimer_enabled = 0$/.test(q.sql))).toBe(true);
  await Disclaimer.updateVersion(1, { title: "T", text: "X", checkbox_label: "ok" });
  expect(queries.some((q) => /DELETE FROM AnsibleForms\.`disclaimer_acceptances` WHERE version/.test(q.sql))).toBe(false);
  await Disclaimer.updateVersion(1, { title: "T", text: "X", checkbox_label: "ok", askAgain: true });
  expect(queries.some((q) => /DELETE FROM AnsibleForms\.`disclaimer_acceptances` WHERE version/.test(q.sql))).toBe(true);
});
