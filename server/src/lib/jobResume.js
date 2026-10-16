// Following again the jobs a node stopped following (#1084). A job on a remote runner (AWX,
// AAP, Ascender) carries on when the app node that launched it restarts or is replaced, but the
// loop that followed it lived in that node's process : the start of a node (Job.abandonOwn) and
// the worker's sweep of dead nodes (Job.abandonDeadNodes) abandon its jobs. Right after, the
// abandoned jobs that a runner can follow again are taken over here - claimed in one statement,
// so of two nodes only one follows a job - and end with what really happened on the runner.
import logger from "./logger.js";
import mysql from "../models/db.model.js";
import Job from "../models/job.model.js";
import Runner from "../models/runner.model.js";
import { getRunner, RUNNERS } from "../runners/index.js";
import { nodeId } from "./role.js";

// how far back an abandoned job is followed again : the runner keeps its jobs much longer, but a
// job abandoned before that is one the hourly sweep gave up on (Job.abandon), not a restart
export const RESUME_WITHIN_HOURS = 24;

// the job types a runner follows remotely (a template on AWX, Semaphore, Rundeck, Jenkins) :
// a playbook runs on an RTE, which carries on by itself (jobs.host), and a multistep or a
// workflow is driven by the app's own loop, which cannot be resumed
const RESUMABLE_TYPES = ["awx"];

/**
 * The runner types that can follow a job again (their runner has resume) : AWX, AAP and
 * Ascender today. The jobs of the others stay abandoned, as before.
 *
 * Returns:
 *   string[]: the runner types.
 */
export function resumableRunnerTypes() {
  return Object.keys(RUNNERS).filter((type) => typeof RUNNERS[type].resume === "function");
}

/**
 * The abandoned jobs that may be followed again : launched on a runner that can follow a job
 * again (their remote id and their runner are known), not ended, started within
 * RESUME_WITHIN_HOURS.
 *
 * Returns:
 *   Promise<object[]>: the jobs ({ id, tracker, runner, awx_id, awx_workflow, parent_id, step }).
 */
export async function findResumable() {
  return mysql.do(
    "SELECT j.id, j.tracker, j.runner, j.awx_id, j.awx_workflow, j.parent_id, j.step FROM AnsibleForms.`jobs` j " +
      "JOIN AnsibleForms.`runners` r ON r.name = j.runner " +
      "WHERE j.status='abandoned' AND j.`end` IS NULL AND j.host IS NULL AND j.awx_id IS NOT NULL " +
      "AND j.job_type IN (?) AND r.type IN (?) AND j.start > (NOW() - INTERVAL ? HOUR) ORDER BY j.id",
    [RESUMABLE_TYPES, resumableRunnerTypes(), RESUME_WITHIN_HOURS]
  );
}

/**
 * Takes over an abandoned job : running again, followed by this node. One statement, matched on
 * the node that followed it, so when two nodes try only one wins.
 *
 * Args:
 *   job (object): the job ({ id, tracker }).
 *   self (string): this node.
 *
 * Returns:
 *   Promise<boolean>: true when this node took it.
 */
export async function claim(job, self = nodeId) {
  const res = await mysql.do(
    "UPDATE AnsibleForms.`jobs` SET status='running', tracker=? WHERE id=? AND status='abandoned' AND `end` IS NULL AND tracker <=> ?",
    [self, job.id, job.tracker ?? null]
  );
  return (res?.affectedRows || 0) > 0;
}

/**
 * Leaves a job abandoned for good, saying why, with an end : it is not tried again.
 *
 * Args:
 *   job (object): the job ({ id }).
 *   reason (string): why it could not be followed again.
 */
async function giveUp(job, reason) {
  await Job.printJobOutput(`[ERROR]: ${reason}`, "stderr", job.id, (await Job.lastOrder(job.id)) + 1);
  await mysql.do("UPDATE AnsibleForms.`jobs` SET status='abandoned', `end`=NOW() WHERE id=? AND status='running'", [job.id]);
  logger.warning(`Job ${job.id} stays abandoned: ${reason}`);
}

/**
 * Ends the multistep a resumed step belonged to : its loop died with the node, so the steps after
 * this one do not run. It fails, saying so, rather than stay abandoned with no word.
 *
 * Args:
 *   job (object): the step ({ id, parent_id, step }).
 */
async function endParent(job) {
  const rows = await mysql.do("SELECT status FROM AnsibleForms.`jobs` WHERE id=?", [job.id]);
  const status = rows?.[0]?.status || "unknown";
  const parent = job.parent_id;
  await Job.endJobStatus(
    parent,
    (await Job.lastOrder(parent)) + 1,
    "stderr",
    "failed",
    `[ERROR]: the server restarted while step '${job.step || job.id}' ran (job ${job.id}): that step ended with ${status}, the steps after it were not run`
  );
}

/**
 * Follows one claimed job again until it ends, on its runner.
 *
 * Args:
 *   job (object): the job, claimed by this node.
 */
async function follow(job) {
  try {
    const row = await Runner.findByName(job.runner).catch(() => null);
    if (!row) return giveUp(job, `the runner '${job.runner}' it ran on is gone: check the job on the runner itself`);
    const impl = getRunner(row.type);
    if (!impl.resume) return giveUp(job, `a ${row.type} runner's jobs cannot be followed again after a restart: check the job on the runner itself`);
    logger.notice(`Following job ${job.id} again on runner '${row.name}' (remote job ${job.awx_id})`);
    const result = await impl.resume({ jobId: job.id, runner: row, job });
    if (result === null) return giveUp(job, `the runner no longer knows job ${job.awx_id}: its end is unknown`);
  } catch (err) {
    logger.error(`Following job ${job.id} again failed: ${err.message || err}`);
    // the tracker ends the job itself when it loses its runner ; anything else leaves it here
    const rows = await mysql.do("SELECT status FROM AnsibleForms.`jobs` WHERE id=?", [job.id]).catch(() => []);
    if (rows?.[0]?.status === "running") await giveUp(job, `could not follow it again: ${err.message || err}`).catch(() => {});
  }
  if (job.parent_id) await endParent(job).catch((err) => logger.error(`Ending the multistep of job ${job.id} failed: ${err.message || err}`));
}

/**
 * Takes over the abandoned jobs that may be followed again, and follows each until it ends, in
 * the background. Called right after a node's start abandoned its jobs, and after the worker's
 * sweep of dead nodes.
 *
 * Args:
 *   self (string): this node.
 *
 * Returns:
 *   Promise<number>: the jobs taken over.
 */
export async function resumeAbandoned(self = nodeId) {
  let taken = 0;
  for (const job of await findResumable()) {
    if (!(await claim(job, self))) continue;
    taken++;
    // not awaited : a job may run for hours
    follow(job).catch((err) => logger.error(`Job ${job.id}: ${err.message || err}`));
  }
  if (taken) logger.warning(`Following ${taken} abandoned job(s) again on their runner`);
  return taken;
}

export default { resumeAbandoned, findResumable, claim, RESUME_WITHIN_HOURS };
