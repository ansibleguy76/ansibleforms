// An RTE that registers itself (src/rte/register.js) and a config seed that declares the same
// RTE (src/lib/seed.js, the helm chart's `rte` at http://127.0.0.1:8000) must end as ONE runner,
// whichever writes first. The RTE starts with the app : its first registration can land
// between the app creating the schema and the seed being applied, and the two used to match
// by different keys (the RTE by its address, the seed by the name), so both rows stayed.
//
// The real Runner and CrudModel run here, over a small in-memory runners table : the race
// is about what the two code paths do to the same rows, so neither is stubbed.
import { test, describe, beforeEach, vi } from "vitest";
import assert from "node:assert/strict";

process.env.LOG_PATH = process.env.LOG_PATH || "/tmp/ansibleforms-test-logs";
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";

// ---------------------------------------------------------------------------------
// The database : the runners table, the jobs' runner column and the nodes' heartbeats
// ---------------------------------------------------------------------------------
let runners;
let jobs;
let alive;
let nextId;

const pick = (row) => ({ ...row });
const byId = (id) => runners.find((r) => r.id === Number(id));

async function answer(sql, vars) {
  // the heartbeats of the nodes register.js asks about
  if (/FROM AnsibleForms.`nodes` WHERE id IN/.test(sql)) return vars[0].filter((id) => alive.has(id)).map((id) => ({ id }));
  // the jobs a runner ran, moved to another name
  if (/^UPDATE AnsibleForms.`jobs` SET runner = \? WHERE runner = \?/.test(sql)) {
    let n = 0;
    for (const j of jobs) if (j.runner === vars[1]) { j.runner = vars[0]; n++; }
    return { affectedRows: n };
  }
  // the default of a type (runner.model.js)
  if (/SELECT name FROM AnsibleForms.`runners` WHERE is_default = 1 AND managed = 1 AND type = \?/.test(sql)) {
    return runners.filter((r) => r.is_default && r.managed && r.type === vars[0]).map((r) => ({ name: r.name }));
  }
  if (/^UPDATE AnsibleForms.`runners` SET is_default = 0 WHERE id <> \? AND type = \?/.test(sql)) {
    const onlyUnmanaged = /AND managed = 0/.test(sql);
    for (const r of runners) if (r.id !== vars[0] && r.type === vars[1] && (!onlyUnmanaged || !r.managed)) r.is_default = 0;
    return { affectedRows: 1 };
  }
  // CrudModel's statements
  if (/^SELECT 1 FROM \?\? WHERE \?\? = \?/.test(sql)) return byId(vars[2]) ? [{ 1: 1 }] : [];
  if (/^SELECT managed FROM \?\? WHERE \?\? = \?/.test(sql)) return byId(vars[2]) ? [{ managed: byId(vars[2]).managed }] : [];
  if (/^SELECT .* FROM AnsibleForms.runners WHERE name = \?/.test(sql)) return runners.filter((r) => r.name === vars[0]).map(pick);
  if (/^SELECT .* FROM AnsibleForms.runners WHERE id = \?/.test(sql)) return runners.filter((r) => r.id === Number(vars[0])).map(pick);
  if (/^SELECT .* FROM AnsibleForms.runners$/.test(sql)) return runners.map(pick);
  if (/^INSERT INTO AnsibleForms.runners SET \?/.test(sql)) {
    // the natural key is unique, as in create_runners_table.sql
    if (runners.some((r) => r.name === vars.name)) throw new Error(`Duplicate entry '${vars.name}' for key 'uk_AnsibleForms_runners_natural_key'`);
    const row = { id: nextId++, managed: 0, is_default: 0, node_id: null, ...vars };
    runners.push(row);
    return { insertId: row.id };
  }
  if (/^UPDATE AnsibleForms.runners SET \? WHERE id = \?/.test(sql)) {
    const row = byId(vars[1]);
    if (!row) return { affectedRows: 0 };
    if (vars[0].name && runners.some((r) => r !== row && r.name === vars[0].name)) {
      throw new Error(`Duplicate entry '${vars[0].name}' for key 'uk_AnsibleForms_runners_natural_key'`);
    }
    Object.assign(row, vars[0]);
    return { affectedRows: 1 };
  }
  if (/^DELETE FROM AnsibleForms.runners WHERE id = \?/.test(sql)) {
    const before = runners.length;
    runners = runners.filter((r) => r.id !== Number(vars[0]));
    return { affectedRows: before - runners.length };
  }
  return [];
}

vi.mock("../src/models/db.model.js", () => ({
  default: {
    do: async (sql, vars) => answer(sql, vars),
    tryDo: async () => [],
  },
}));

const appConfig = (await import("./__mocks__/app.config.js")).default;
appConfig.encryptionSecret ||= "0123456789abcdef0123456789abcdef";
const { listSections, applyListSection } = await import("../src/lib/seed.js");
const { registerOnce } = await import("../src/rte/register.js");
const CrudModel = (await import("../src/models/crud.model.js")).default;

// ---------------------------------------------------------------------------------
// The helm chart's server pod : an RTE on 127.0.0.1:8000 (RTE_URL), and the seed's `rte`
// ---------------------------------------------------------------------------------
const TOKEN = "a-token-of-sixteen-chars";
const ME = "rte-pod1-8000";
const REG = { uri: "http://127.0.0.1:8000", name: "127.0.0.1", token: TOKEN, nodeId: ME };
const SEEDED = { name: "rte", type: "rte", description: "The RTE in the server pod, from the Helm chart", uri: "http://127.0.0.1:8000", token: TOKEN, is_default: true };
const runnersSection = listSections.find((s) => s.key === "runners");
const summary = () => ({ created: [], updated: [], released: [], pruned: [], adopted: [], recloned: [], unchanged: 0 });

const seed = (items = [SEEDED]) => applyListSection(runnersSection, { items }, summary());
const rteRows = () => runners.filter((r) => r.type === "rte");

beforeEach(() => {
  runners = [];
  jobs = [];
  alive = new Set([ME]);
  nextId = 1;
  CrudModel.flushLocal("runner");
});

describe("an RTE and the config seed declaring it end as one runner", () => {
  test("the seed first : the RTE finds the seeded row by its address and leaves it alone", async () => {
    await seed();
    assert.equal(await registerOnce(REG), null);
    assert.equal(rteRows().length, 1);
    assert.equal(rteRows()[0].name, "rte");
    assert.equal(rteRows()[0].managed, 1);
  });

  test("the RTE first : the seed adopts the row it registered instead of adding a second one", async () => {
    await registerOnce(REG);
    assert.equal(rteRows().length, 1, "the RTE registered itself");
    jobs.push({ id: 1, runner: "127.0.0.1" });

    const s = summary();
    await applyListSection(runnersSection, { items: [SEEDED] }, s);

    assert.equal(rteRows().length, 1, "one runner for one RTE address");
    const row = rteRows()[0];
    assert.equal(row.name, "rte", "under the name the seed declares");
    assert.equal(row.managed, 1, "and managed by the seed from now on");
    assert.equal(row.node_id, null, "no longer a registered row : the worker's sweep never removes it");
    assert.equal(row.description, SEEDED.description);
    assert.equal(row.is_default, 1);
    assert.deepEqual(s.adopted, ["runner:rte"], "the adoption is said, like any other");
    assert.deepEqual(s.created, []);
    assert.equal(jobs[0].runner, "rte", "a job that ran on the registered row names the runner it is now");

    // the next checks of the RTE and the next applies of the seed change nothing
    assert.equal(await registerOnce(REG), null);
    const again = summary();
    await applyListSection(runnersSection, { items: [SEEDED] }, again);
    assert.equal(again.unchanged, 1);
    assert.equal(rteRows().length, 1);
  });

  test("the RTE writing between the seed's read and its insert : its next check removes its own row", async () => {
    // both rows exist : the RTE found no row, the seed created its own, the RTE then created
    await seed();
    runners.push({ id: nextId++, name: "127.0.0.1", type: "rte", uri: "http://127.0.0.1:8000/", token: "", managed: 0, is_default: 0, node_id: ME });
    jobs.push({ id: 1, runner: "127.0.0.1" });

    const said = await registerOnce(REG);
    assert.match(said, /removed runner '127\.0\.0\.1'.*'rte'/);
    assert.equal(rteRows().length, 1);
    assert.equal(rteRows()[0].name, "rte");
    assert.equal(jobs[0].runner, "rte");
  });

  test("a row added by hand at the seeded address is somebody's work : neither adopted nor removed", async () => {
    runners.push({ id: nextId++, name: "mine", type: "rte", uri: "http://127.0.0.1:8000", token: "", managed: 0, is_default: 0, node_id: null });
    await seed();
    await registerOnce(REG);
    assert.deepEqual(rteRows().map((r) => r.name).sort(), ["mine", "rte"]);
  });

  test("a registered row at another address is not adopted", async () => {
    await registerOnce({ ...REG, uri: "http://10.0.0.9:8000", name: "10.0.0.9" });
    await seed();
    assert.deepEqual(rteRows().map((r) => r.name).sort(), ["10.0.0.9", "rte"]);
  });
});
