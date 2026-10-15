// lib/formLinks.js : the forms as the settings pages link them - their roles, and where their
// jobs run : the runner a form or a step names, else the default of the type it needs.
import { test, expect } from "vitest";

const { formLinks } = await import("../src/lib/formLinks.js");

test("a form runs where it names, or on the default of its type ; subforms are left out", () => {
  const forms = formLinks([
    { name: "Play", type: "ansible", roles: ["ops"] },
    { name: "Tmpl", type: "awx", runner: "awx-lab", roles: ["admin", "ops"] },
    { name: "Old", type: "awx", awx: "awx-old" },
    { name: "Sub", type: "subform" },
    { name: "Git", type: "git" },
  ]);
  expect(forms.map((f) => f.name)).toEqual(["Git", "Old", "Play", "Tmpl"]);
  const by = Object.fromEntries(forms.map((f) => [f.name, f]));
  expect(by.Play.runs).toEqual([{ defaultType: "rte" }]);
  expect(by.Tmpl.runs).toEqual([{ runner: "awx-lab" }]);
  // awx: is the deprecated alias of runner:
  expect(by.Old.runs).toEqual([{ runner: "awx-old" }]);
  expect(by.Git.runs).toEqual([]);
  expect(by.Tmpl.roles).toEqual(["admin", "ops"]);
});

test("a multistep form runs where each of its steps runs, each place once", () => {
  const [ms] = formLinks([
    {
      name: "Multi",
      type: "multistep",
      steps: [
        { name: "a", type: "ansible" },
        { name: "b", type: "ansible" },
        { name: "c", type: "awx", runner: "awx-lab" },
      ],
    },
  ]);
  expect(ms.runs).toEqual([{ defaultType: "rte" }, { runner: "awx-lab" }]);
});

// the credentials a form names, for a credential's Used by tab
const { formCredentials, credentialsOfForm, expressionCredentials } = await import("../src/lib/formLinks.js");

test("a form's credentials : its yaml, a step's, a query field's dbConfig, its expressions", () => {
  const used = credentialsOfForm({
    name: "Deploy",
    credentials: { vcenter: "vcenter-prod", db: "$(env)-db" },
    ansibleCredentials: "linux-root",
    vaultCredentials: "vault-pass",
    awxCredentials: ["awx-machine"],
    steps: [{ name: "Configure", ansibleCredentials: "linux-root" }],
    fields: [
      { name: "cmdb", type: "query", dbConfig: "cmdb-db" },
      { name: "self", type: "query", dbConfig: "__self__" },
      { name: "svc", type: "expression", expression: "fn.fnCredentials('svc-api')" },
      { name: "rows", type: "table", tableFields: [{ name: "x", dbConfig: ["a1", "a2"] }] },
    ],
  });
  expect(used.credentials).toEqual([
    { name: "vcenter-prod", where: "credentials: vcenter" },
    { name: "linux-root", where: "ansibleCredentials" },
    { name: "vault-pass", where: "vaultCredentials" },
    { name: "awx-machine", where: "awxCredentials" },
    { name: "linux-root", where: "step Configure: ansibleCredentials" },
    { name: "cmdb-db", where: "field cmdb (dbConfig)" },
    { name: "svc-api", where: "field svc (expression)" },
    { name: "a1", where: "field rows > field x (dbConfig)" },
    { name: "a2", where: "field rows > field x (dbConfig)" },
  ]);
  // a name built at launch is not one credential : its pattern and its place are reported
  expect(used.dynamic).toEqual([{ pattern: "$(env)-db", where: "credentials: db" }]);
});

test("an expression's credentials : literal names only, the others make it dynamic", () => {
  expect(expressionCredentials("fn.fnRestBasic('get', 'https://x', null, 'snow-api', '.result')")).toEqual({ names: ["snow-api"], patterns: [], dynamic: false });
  expect(expressionCredentials("fn.fnCredentials('a', 'b')")).toEqual({ names: ["a", "b"], patterns: [], dynamic: false });
  expect(expressionCredentials("fn.fnCredentials('a')")).toEqual({ names: ["a"], patterns: [], dynamic: false });
  expect(expressionCredentials("fn.fnRestAdvanced('get', 'u', null, { Authorization: 'Basic base64(jira-cred)' })")).toEqual({ names: ["jira-cred"], patterns: [], dynamic: false });
  // a quoted template keeps its pattern ; a computed name has none
  expect(expressionCredentials("fn.fnCredentials('$(env)-db')")).toEqual({ names: [], patterns: ["$(env)-db"], dynamic: true });
  expect(expressionCredentials("fn.fnCredentials($(env) + '-db')")).toEqual({ names: [], patterns: [], dynamic: true });
  expect(expressionCredentials("fn.fnCredentials(`${env}-db`)")).toEqual({ names: [], patterns: ["${env}-db"], dynamic: true });
  expect(expressionCredentials("1 + 2")).toEqual({ names: [], patterns: [], dynamic: false });
});

test("the forms that name a credential, subforms included ; the others left out", () => {
  const forms = formCredentials([
    { name: "Plain", type: "ansible" },
    { name: "Sub", type: "subform", fields: [{ name: "q", dbConfig: "cmdb-db" }] },
    { name: "Main", type: "ansible", ansibleCredentials: "linux-root" },
  ]);
  expect(forms.map((f) => f.name)).toEqual(["Main", "Sub"]);
  expect(forms[1].credentials).toEqual([{ name: "cmdb-db", where: "field q (dbConfig)" }]);
});
