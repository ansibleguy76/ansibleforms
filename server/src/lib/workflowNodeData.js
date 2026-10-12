// One workflow node's variables and artifacts, for the job page (a node's Show variables and Show
// artifacts) : a workflow the RTE ran (job_type workflow) keeps each node's job as a child job of
// its own, with its extravars and its artifacts (set_stats) ; an AWX, AAP or Ascender workflow's
// node is a job on that AWX, asked for them.
import mysql from "../models/db.model.js";
import Runner from "../models/runner.model.js";
import Job from "../models/job.model.js";
import { Awx } from "../runners/awx/api.js";
import Errors from "./errors.js";
import { safeParse } from "./safejson.js";

/**
 * An object from a column or a value : {} when it is none, or not an object.
 *
 * Args:
 *   value (any): the value (a JSON text, or already an object).
 *
 * Returns:
 *   object: the object.
 */
function objectOf(value) {
  const parsed = typeof value === "string" ? safeParse(value, {}, "workflow node data") : value;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

/**
 * The variables and the artifacts of a workflow job's node.
 *
 * Args:
 *   job (object): the workflow job, as Job.findById read it for the user (so they may see it).
 *   nodeId (string|number): the node's id in the job's graph (jobs.awx_workflow).
 *   deps (object): { mysql, Runner, Awx, mask } - mask(form, extravarsText) masks what may not
 *     leave the server (Job.maskExtravars : secret-like keys, the form's password fields).
 *   deps (object): { mysql, Runner, Awx } - for the tests.
 *
 * Returns:
 *   Promise<object>: { node, job (the node's job id, or null), extravars, artifacts }.
 *
 * Raises:
 *   NotFoundError: the job has no graph, or no node of that id.
 */
export async function workflowNodeData(job, nodeId, deps = {}) {
  const { mysql: db = mysql, Runner: runners = Runner, Awx: awx = Awx, mask = Job.maskExtravars } = deps;
  // the node's extravars as the parent's are shown : the form's password fields and the
  // secret-like keys masked - the child job holds the parent form's values, passwords included
  const masked = async (extravars) => objectOf(await mask(job.form, JSON.stringify(objectOf(extravars))));
  const graph = objectOf(job?.awx_workflow);
  const node = (graph.nodes || []).find((n) => String(n.id) === String(nodeId));
  if (!node) throw new Errors.NotFoundError(`Job ${job?.id} has no workflow node ${nodeId}`);
  const out = { node: node.id, job: node.job ?? null, extravars: {}, artifacts: {} };
  // not run (yet) : nothing to show
  if (!node.job) return out;
  if (job.job_type === "workflow") {
    // the RTE's : a child of this job, never another job's
    const rows = await db.do("SELECT extravars, awx_artifacts FROM AnsibleForms.`jobs` WHERE id=? AND parent_id=?", [node.job, job.id]);
    if (!rows?.length) return out;
    return { ...out, extravars: await masked(rows[0].extravars), artifacts: objectOf(rows[0].awx_artifacts) };
  }
  // an AWX workflow : asked to the runner the job ran on
  const runner = job.runner ? await runners.findByName(job.runner) : null;
  if (!runner) throw new Errors.NotFoundError(`The runner '${job.runner || ""}' this job ran on is gone : its nodes cannot be read`);
  const data = await awx.getNodeJobData(runner, node);
  return { ...out, ...data, extravars: await masked(data.extravars) };
}

export default { workflowNodeData };
