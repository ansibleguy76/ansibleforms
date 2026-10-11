// What a form's type means for its job. `template` runs a job on a runner that runs templates (an
// AWX, AAP or Ascender, a Semaphore, a Rundeck, a Jenkins) ; `awx` is its old name, kept so the
// forms written before 7 run as they did. The job itself is stored as an awx job either way :
// its output, artifacts and relaunch follow the same path.

/** the form types that run a job on a template runner */
export const TEMPLATE_FORM_TYPES = ["template", "awx"];

/**
 * The job type of a form type : a template (or awx) form runs an awx job.
 *
 * Args:
 *   formType (string): the form's type.
 *
 * Returns:
 *   string: ansible, awx or multistep (the type a job is stored with).
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
