// lib/jobTypes.js : a template form (or awx, its old name) runs an awx job ; the jobs list says
// where a template job ran by its runner's kind.
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import { jobTypeOf, runnerKind } from "../src/lib/jobTypes.js";
import { formLinks } from "../src/lib/formLinks.js";

describe("a form's type and its job's", () => {
  test("template and awx run an awx job ; the others are their own", () => {
    assert.equal(jobTypeOf("template"), "awx");
    assert.equal(jobTypeOf("awx"), "awx");
    assert.equal(jobTypeOf("ansible"), "ansible");
    assert.equal(jobTypeOf("multistep"), "multistep");
  });

  test("a template form that names no runner takes the default template runner, as an awx form", () => {
    const [f] = formLinks([{ name: "T", type: "template", roles: ["admin"] }]);
    assert.deepEqual(f.runs, [{ defaultType: "awx" }]);
  });
});

describe("where a job ran", () => {
  test("a runner's kind : its type, an awx runner's flavour", () => {
    assert.equal(runnerKind({ type: "jenkins" }), "jenkins");
    assert.equal(runnerKind({ type: "semaphore" }), "semaphore");
    assert.equal(runnerKind({ type: "awx", flavour: "aap" }), "aap");
    assert.equal(runnerKind({ type: "awx", flavour: null }), "awx");
    assert.equal(runnerKind(null), null);
  });
});
