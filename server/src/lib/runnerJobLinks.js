// The address of a job in the web UI of the product it ran on - an AWX, AAP or Ascender, a
// Jenkins, a Semaphore or a Rundeck : the job page's template box links its #id there (a new
// tab), and each node of an AWX workflow's graph its own job. Built here, where the runner's uri,
// flavour and project are known, so the browser needs none of them ; kept on the job
// (jobs.runner_job_url) once it is known - at its launch, else when its page is first read - so
// a runner removed or renamed later leaves the links.
import Runner from "../models/runner.model.js";
import mysql from "../models/db.model.js";
import logger from "./logger.js";

// a node's job type in AWX, and what the UI calls it in a job's address (an approval has a page of
// another kind : none)
const UI_KINDS = { job: "playbook", workflow_job: "workflow", project_update: "project", inventory_update: "inventory" };

/**
 * A job's page in the UI of an awx runner.
 *
 * | runner                                  | address                              |
 * | AWX, Ascender, AAP before 2.5 (/api/v2) | /#/jobs/<kind>/<id>/output           |
 * | AAP 2.5+ gateway (/api/controller/v2)   | /execution/jobs/<kind>/<id>/output   |
 *
 * Args:
 *   runner (object): the runner (type, uri, flavour).
 *   id (number|string): the job's id in that product.
 *   kind (string): 'playbook', 'workflow', 'project' or 'inventory'.
 *
 * Returns:
 *   string: the address, or '' when there is none (not an awx runner, no id, a uri that is
 *   not an http address).
 */
export function uiJobUrl(runner, id, kind = "playbook") {
  if (runner?.type !== "awx" || !/^\d+$/.test(String(id ?? "")) || !Object.values(UI_KINDS).includes(kind)) return "";
  // the UI is where the API is, without the API path (https://aap.example.com/api/controller/v2) ;
  // a path before it stays (/tower/api/v2). Never the credentials a uri may carry.
  const base = uiBase(runner);
  if (!base) return "";
  // the AAP 2.5 gateway (its controller under /api/controller) has its own UI ; an AAP before 2.5
  // is the controller alone, with AWX's (the uri parses : uiBase read it)
  const gateway = runner.flavour === "aap" && /\/api\/controller(\/|$)/.test(new URL(String(runner.uri)).pathname);
  return gateway ? `${base}/execution/jobs/${kind}/${id}/output` : `${base}/#/jobs/${kind}/${id}/output`;
}

/**
 * A runner's web UI : its uri without the API path a uri may carry (and never its credentials).
 *
 * Args:
 *   runner (object): the runner (uri).
 *
 * Returns:
 *   string: the address, '' when the uri is not an http address.
 */
function uiBase(runner) {
  let url;
  try {
    url = new URL(String(runner?.uri || ""));
  } catch (e) {
    return "";
  }
  if (!["http:", "https:"].includes(url.protocol)) return "";
  const api = url.pathname.search(/\/api(\/|$)/);
  return url.origin + (api >= 0 ? url.pathname.slice(0, api) : url.pathname).replace(/\/+$/, "");
}

/**
 * A build's, a task's or an execution's page in the UI of a Jenkins, a Semaphore or a Rundeck.
 *
 * | runner    | address                                              |
 * | Jenkins   | /job/<folder>/job/<job>/<build>/console               |
 * | Semaphore | /project/<project id>/history?t=<task id>             |
 * | Rundeck   | /project/<project>/execution/show/<execution id>      |
 *
 * Args:
 *   runner (object): the runner (type, uri, project).
 *   id (number|string): the build's number, the task's or the execution's id.
 *   template (string): the job a Jenkins form names (its path under the runner's folder).
 *
 * Returns:
 *   string: the address, or '' when there is none.
 */
export function toolJobUrl(runner, id, template) {
  if (!/^\d+$/.test(String(id ?? ""))) return "";
  const base = uiBase(runner);
  if (!base) return "";
  if (runner.type === "jenkins") {
    // the job's full name : under the runner's folder when it has one, each part a /job/<name>
    const parts = [runner.project, template]
      .flatMap((x) => String(x ?? "").split("/"))
      .map((x) => x.trim())
      .filter(Boolean);
    if (!parts.length) return "";
    return `${base}${parts.map((x) => `/job/${encodeURIComponent(x)}`).join("")}/${id}/console`;
  }
  const project = String(runner.project ?? "").trim();
  if (!project) return "";
  if (runner.type === "semaphore") return `${base}/project/${encodeURIComponent(project)}/history?t=${id}`;
  if (runner.type === "rundeck") return `${base}/project/${encodeURIComponent(project)}/execution/show/${id}`;
  return "";
}

/**
 * A job's address in the product it ran on, from its runner as it is now.
 *
 * Args:
 *   job (object): the job (runner kind, awx_id, extravars, awx_workflow).
 *   runner (object): its runner.
 *
 * Returns:
 *   string: the address, '' when there is none.
 */
function jobUrlFrom(job, runner) {
  if (["jenkins", "semaphore", "rundeck"].includes(runner?.type)) {
    let extravars = job.extravars;
    if (typeof extravars === "string") {
      try {
        extravars = JSON.parse(extravars);
      } catch (e) {
        extravars = {};
      }
    }
    return toolJobUrl(runner, job.awx_id, extravars?.__template__);
  }
  if (runner?.type !== "awx") return "";
  let graph = job.awx_workflow;
  if (typeof graph === "string") {
    try {
      graph = JSON.parse(graph);
    } catch (e) {
      graph = null;
    }
  }
  return uiJobUrl(runner, job.awx_id, graph && typeof graph === "object" ? "workflow" : "playbook");
}

/**
 * A workflow node's page, from the workflow's own kept address : the same product and routes,
 * the node's kind and id in place of the workflow's.
 *
 * Args:
 *   workflowUrl (string): the workflow job's address (/#/jobs/workflow/<id>/output or the AAP
 *     gateway's /execution/jobs/workflow/<id>/output).
 *   kind (string): the node's kind in the UI ('playbook', 'workflow', ...).
 *   id (number): its job's id.
 *
 * Returns:
 *   string: the address, '' when the workflow's is not an AWX one.
 */
function nodeUrlFrom(workflowUrl, kind, id) {
  if (!/\/jobs\/[a-z]+\/\d+\/output$/.test(String(workflowUrl || "")) || !/^\d+$/.test(String(id ?? ""))) return "";
  return workflowUrl.replace(/\/jobs\/[a-z]+\/\d+\/output$/, `/jobs/${kind}/${id}/output`);
}

/**
 * Keeps a job's address on the job, once its id in the product is known (a runner calls it right
 * after its launch) : nothing when it has one, or when there is none to build. Never throws - a
 * link is not worth failing a job for.
 *
 * Args:
 *   jobId (number): the job.
 *   deps (object): { Runner, db } - for the tests.
 *
 * Returns:
 *   Promise<string>: the address kept, '' when none.
 */
export async function rememberRunnerJobUrl(jobId, deps = {}) {
  const { Runner: runners = Runner, db = mysql } = deps;
  try {
    const rows = await db.do(
      "SELECT id, job_type, runner, awx_id, extravars, awx_workflow, runner_job_url FROM AnsibleForms.`jobs` WHERE id=?",
      [jobId],
    );
    const job = rows?.[0];
    if (!job || job.runner_job_url || !job.runner || !job.awx_id) return job?.runner_job_url || "";
    const url = jobUrlFrom(job, await runners.findByName(job.runner));
    if (url) await db.do("UPDATE AnsibleForms.`jobs` SET runner_job_url=? WHERE id=?", [url, jobId]);
    return url;
  } catch (e) {
    logger.warning(`Job ${jobId}: its address in its runner's UI could not be kept: ${e.message || e}`);
    return "";
  }
}

/**
 * A job as getJob returns it, with its address in the product it ran on (runner_job_url : an
 * AWX, AAP or Ascender, a Jenkins, a Semaphore or a Rundeck) and its AWX workflow nodes' (ui_url).
 * The address kept on the job comes first (where it ran, even with its runner gone) ; without
 * one, it is built from the runner, and kept. Nothing changes for a job on any other runner ; a
 * runner that is gone, or cannot be read, only leaves out what was not kept.
 *
 * Args:
 *   job (object): the job (job_type, runner, awx_id, extravars, awx_workflow parsed,
 *     runner_job_url kept).
 *   deps (object): { Runner, db } - for the tests.
 *
 * Returns:
 *   Promise<object>: the same job.
 */
export async function addRunnerJobLinks(job, deps = {}) {
  const { Runner: runners = Runner, db = mysql } = deps;
  if (job?.job_type !== "awx") return job;
  const kept = job.runner_job_url || "";
  let runner = null;
  if (job.runner) {
    try {
      runner = await runners.findByName(job.runner);
    } catch (e) {
      logger.warning(`Job ${job.id}: runner '${job.runner}' could not be read for its links: ${e.message || e}`);
    }
  }
  const built = runner ? jobUrlFrom(job, runner) : "";
  const url = kept || built;
  if (url) job.runner_job_url = url;
  else delete job.runner_job_url;
  // built now and not kept yet : kept, for the day its runner goes
  if (!kept && built && job.id) {
    db.do("UPDATE AnsibleForms.`jobs` SET runner_job_url=? WHERE id=? AND runner_job_url IS NULL", [built, job.id]).catch((e) =>
      logger.warning(`Job ${job.id}: its address in its runner's UI could not be kept: ${e.message || e}`),
    );
  }
  // an AWX workflow's nodes : each its job's page, from the runner, else from the kept address
  const graph = job.awx_workflow && typeof job.awx_workflow === "object" ? job.awx_workflow : null;
  if (Array.isArray(graph?.nodes)) {
    graph.nodes = graph.nodes.map((n) => {
      const kind = UI_KINDS[n?.type];
      if (!kind || !n.job) return n;
      const nodeUrl = runner?.type === "awx" ? uiJobUrl(runner, n.job, kind) : nodeUrlFrom(url, kind, n.job);
      return nodeUrl ? { ...n, ui_url: nodeUrl } : n;
    });
  }
  return job;
}
