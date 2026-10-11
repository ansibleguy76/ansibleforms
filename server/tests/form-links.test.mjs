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
