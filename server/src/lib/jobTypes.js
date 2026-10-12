// What a form's type means for its job. A form's type names the product it runs on : ansible (a
// playbook on an RTE), or a template runner - awx (aap and ascender are the same runner, awx with a
// flavour), semaphore, rundeck, jenkins. A form names a runner of that type with `runner:`, or runs
// on its type's default. The job of a template form is stored as an awx job whatever the product :
// its output, artifacts and relaunch follow the same path ; the jobs list says where it ran from
// the job's runner_kind.

/**
 * The runner type each runner form type runs on : a form of type aap runs on an awx runner. The
 * other form types (workflow, multistep, subform) run on no runner of their own.
 */
export const RUNNER_TYPE_OF = Object.freeze({
  ansible: "rte",
  awx: "awx",
  aap: "awx",
  ascender: "awx",
  semaphore: "semaphore",
  rundeck: "rundeck",
  jenkins: "jenkins",
});

/** the form types that run a job on a template runner */
export const TEMPLATE_FORM_TYPES = Object.keys(RUNNER_TYPE_OF).filter((t) => t !== "ansible");

/**
 * The job type of a form type : every template form runs an awx job.
 *
 * Args:
 *   formType (string): the form's type.
 *
 * Returns:
 *   string: ansible, awx, multistep or workflow (the type a job is stored with).
 */
export function jobTypeOf(formType) {
  return TEMPLATE_FORM_TYPES.includes(formType) ? "awx" : formType;
}

/**
 * What a runner is, as the jobs list says where a job ran : its type, or an awx runner's flavour
 * (aap, ascender ; none is awx).
 *
 * Args:
 *   row (object): the runner (type, flavour).
 *
 * Returns:
 *   string|null: rte, awx, aap, ascender, semaphore, rundeck or jenkins ; null without a runner.
 */
export function runnerKind(row) {
  if (!row?.type) return null;
  return row.type === "awx" ? row.flavour || "awx" : row.type;
}
