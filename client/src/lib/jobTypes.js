// A job's type as the app says it, and what it offers : a job's page and the form's output both
// show it (the type's badge, a node's link to the product it ran on, Show artifacts).

/**
 * The type a job shows : a template job by the product it ran on (aap, semaphore, jenkins ...),
 * any other by its own type.
 *
 * Args:
 *   j (object): the job (job_type, runner_kind).
 *
 * Returns:
 *   string: the type shown.
 */
export function jobTypeLabel(j) {
  if (j?.job_type === 'awx') return j.runner_kind || 'awx';
  return j?.job_type || 'ansible';
}

// a job type as its badge says it : the product's own spelling, as the other badges capitalized
export const JOB_TYPE_NAMES = {
  ansible: 'Ansible',
  workflow: 'Workflow',
  multistep: 'Multistep',
  awx: 'AWX',
  aap: 'AAP',
  ascender: 'Ascender',
  semaphore: 'Semaphore',
  rundeck: 'Rundeck',
  jenkins: 'Jenkins',
};

/**
 * A job's type as its badge says it.
 *
 * Args:
 *   j (object): the job (job_type, runner_kind).
 *
 * Returns:
 *   string: the name (AWX, Jenkins, Workflow ...).
 */
export function jobTypeName(j) {
  const type = jobTypeLabel(j);
  return JOB_TYPE_NAMES[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Whether a job offers its artifacts : every job, as a workflow node's card does ({} when its
 * playbook gathered none with set_stats), but a template job that ran on Semaphore, Rundeck or
 * Jenkins, which have no artifacts.
 *
 * Args:
 *   j (object): the job (job_type, runner_kind).
 *
 * Returns:
 *   boolean: true when it offers them.
 */
export function hasArtifacts(j) {
  if (j?.job_type === 'awx') return !['semaphore', 'rundeck', 'jenkins'].includes(j.runner_kind);
  return !!j;
}

export default { jobTypeLabel, jobTypeName, hasArtifacts, JOB_TYPE_NAMES };
