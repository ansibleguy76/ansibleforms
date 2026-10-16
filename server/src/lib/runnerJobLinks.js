// The address of a job in the web UI of the AWX, AAP or Ascender it ran on : the job page's
// template box links its #id there, and each node of an AWX workflow's graph its own job. Built
// here, where the runner's uri and flavour are known, so the browser needs neither.
import Runner from "../models/runner.model.js";
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
  let url;
  try {
    url = new URL(String(runner.uri || ""));
  } catch (e) {
    return "";
  }
  if (!["http:", "https:"].includes(url.protocol)) return "";
  // the UI is where the API is, without the API path (https://aap.example.com/api/controller/v2) ;
  // a path before it stays (/tower/api/v2). Never the credentials a uri may carry.
  const api = url.pathname.search(/\/api(\/|$)/);
  const base = url.origin + (api >= 0 ? url.pathname.slice(0, api) : url.pathname).replace(/\/+$/, "");
  // the AAP 2.5 gateway (its controller under /api/controller) has its own UI ; an AAP before 2.5
  // is the controller alone, with AWX's
  const gateway = runner.flavour === "aap" && /\/api\/controller(\/|$)/.test(url.pathname);
  return gateway ? `${base}/execution/jobs/${kind}/${id}/output` : `${base}/#/jobs/${kind}/${id}/output`;
}

/**
 * A job as getJob returns it, with its address in the product it ran on (runner_job_url) and
 * its workflow nodes' (ui_url). Nothing changes for a job on any other runner ; a runner that is
 * gone, or cannot be read, only leaves the links out.
 *
 * Args:
 *   job (object): the job (job_type, runner, awx_id, awx_workflow parsed).
 *   deps (object): { Runner } - for the tests.
 *
 * Returns:
 *   Promise<object>: the same job.
 */
export async function addRunnerJobLinks(job, deps = {}) {
  const { Runner: runners = Runner } = deps;
  if (job?.job_type !== "awx" || !job.runner) return job;
  let runner;
  try {
    runner = await runners.findByName(job.runner);
  } catch (e) {
    logger.warning(`Job ${job.id}: runner '${job.runner}' could not be read for its links: ${e.message || e}`);
    return job;
  }
  if (runner?.type !== "awx") return job;
  const graph = job.awx_workflow && typeof job.awx_workflow === "object" ? job.awx_workflow : null;
  const url = uiJobUrl(runner, job.awx_id, graph ? "workflow" : "playbook");
  if (url) job.runner_job_url = url;
  if (Array.isArray(graph?.nodes)) {
    graph.nodes = graph.nodes.map((n) => {
      const kind = UI_KINDS[n?.type];
      const nodeUrl = kind && n.job ? uiJobUrl(runner, n.job, kind) : "";
      return nodeUrl ? { ...n, ui_url: nodeUrl } : n;
    });
  }
  return job;
}
