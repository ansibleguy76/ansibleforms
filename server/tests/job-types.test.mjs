// lib/jobTypes.js : a form's type names the product it runs on ; every template form (awx, aap,
// ascender, semaphore, rundeck, jenkins) runs an awx job, and the jobs list says where it ran by
// its runner's kind.
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import { jobTypeOf, runnerKind, RUNNER_TYPE_OF, TEMPLATE_FORM_TYPES } from "../src/lib/jobTypes.js";
import { formLinks } from "../src/lib/formLinks.js";

describe("a form's type and its job's", () => {
  test("every template form type runs an awx job ; the others are their own", () => {
    for (const t of ["awx", "aap", "ascender", "semaphore", "rundeck", "jenkins"]) assert.equal(jobTypeOf(t), "awx", t);
    assert.equal(jobTypeOf("ansible"), "ansible");
    assert.equal(jobTypeOf("multistep"), "multistep");
    assert.equal(jobTypeOf("workflow"), "workflow");
    assert.equal(TEMPLATE_FORM_TYPES.includes("template"), false, "type template is gone");
  });

  test("each form type runs on a runner of its own type ; aap and ascender on an awx runner", () => {
    assert.deepEqual(RUNNER_TYPE_OF, { ansible: "rte", awx: "awx", aap: "awx", ascender: "awx", semaphore: "semaphore", rundeck: "rundeck", jenkins: "jenkins" });
  });

  test("a form that names no runner takes the default runner of its type", () => {
    const [aap] = formLinks([{ name: "T", type: "aap", roles: ["admin"] }]);
    assert.deepEqual(aap.runs, [{ defaultType: "awx" }]);
    const [rd] = formLinks([{ name: "R", type: "rundeck", roles: ["admin"] }]);
    assert.deepEqual(rd.runs, [{ defaultType: "rundeck" }]);
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
