// A workflow run : a form of type workflow (workflow: <name>) runs one of the designer's
// workflows (Designer > Workflows : the AWX export syntax) the way AWX runs a workflow job.
//
//   - Its nodes run by AWX's rules (lib/workflowDefs.js) : the ones without a parent first, a
//     node once a link into it fires (all of them when its parents must converge), branches side
//     by side ; a node that can no longer run is marked do not run.
//   - A job template node runs one of the designer's playbooks as a job of its own on the RTE (a
//     child of the workflow job, as a multistep's steps), with the node's inventory, credentials,
//     limit, tags... ; one that names a runner (runner: <name>) runs that runner's template or
//     job instead - AWX, Semaphore, Rundeck, Jenkins - as a form of the runner's type ; a node
//     with a condition (if_extra_var) runs only when that extravar is true, else it is skipped ;
//     a node may get one key of the extravars only (extra_vars_key), as a multistep's step ;
//     a nested workflow is a child workflow job ; a project node pulls a
//     repository ; an approval node holds the workflow job for approval (the bell, the job's
//     page), approved or rejected the usual way.
//   - The workflow job stores its graph as an AWX workflow's (jobs.awx_workflow), so the jobs page
//     draws it, live ; a finished node's output is copied under a WORKFLOW NODE banner, which
//     the graph opens on a click.
//   - It failed when a node failed and nothing handled it (AWX's rule) ; an abort stops it : the
//     running jobs are aborted, nothing more starts.
import fs from "fs";
import path from "path";
import logger from "../lib/logger.js";
import mysql from "./db.model.js";
import Repository from "./repository.model.js";
import Errors from "../lib/errors.js";
import Runner from "./runner.model.js";
import { workflowsOf, workflowErrors, nextStep, workflowFailed, varsOf } from "../lib/workflowDefs.js";

// how often the run looks at its jobs, its approval and an abort
const TICK_MS = 1000;
// a workflow running a workflow running ... : stopped here, a loop between files would never end
const MAX_DEPTH = 5;
// the files a search for a workflow reads : YAML, not too deep, never in .git
const MAX_DEPTH_DIRS = 6;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── finding a workflow ───────────────────────────────────────────────────────

/**
 * The YAML files under a folder.
 *
 * Args:
 *   root (string): the folder.
 *   depth (number): how deep it may go still.
 *
 * Returns:
 *   string[]: the files' absolute paths.
 */
function yamlFilesIn(root, depth = MAX_DEPTH_DIRS) {
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const full = path.join(root, e.name);
    if (e.isDirectory() && depth > 0) files.push(...yamlFilesIn(full, depth - 1));
    else if (e.isFile() && /\.ya?ml$/i.test(e.name)) files.push(full);
  }
  return files;
}

/**
 * Every workflow of the designer's : in the workflows folder (WORKFLOWS_PATH) and the
 * repositories used for workflows, a file's workflows each.
 *
 * Returns:
 *   Promise<object[]>: { workflow (workflowsOf), file (its absolute path) }.
 */
async function allWorkflows() {
  const found = [];
  for (const { root } of await Repository.getWorkflowsRoots()) {
    for (const file of yamlFilesIn(root)) {
      let text;
      try {
        text = fs.readFileSync(file, "utf8");
      } catch {
        continue;
      }
      if (!text.includes("workflow_job_templates")) continue;
      let workflows;
      try {
        workflows = workflowsOf(text);
      } catch (e) {
        logger.warning(`Workflow file '${file}' is not valid YAML : ${e.message}`);
        continue;
      }
      for (const wf of workflows) found.push({ workflow: wf, file });
    }
  }
  return found;
}

/**
 * The workflows' names, sorted : what a workflow form may run.
 *
 * Returns:
 *   Promise<object[]>: { name, file (its name) }.
 */
export async function listWorkflows() {
  return (await allWorkflows())
    .filter((f) => f.workflow.name)
    .map((f) => ({ name: f.workflow.name, file: path.basename(f.file) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * A workflow of the designer's, by its name : in the workflows folder (WORKFLOWS_PATH) or a
 * repository used for workflows.
 *
 * Args:
 *   name (string): the workflow's name.
 *
 * Returns:
 *   Promise<object>: { workflow (workflowsOf), file (where it is) }.
 *
 * Raises:
 *   NotFoundError: no workflow has this name.
 *   ConflictError: two have it - which one to run is not for the app to guess.
 */
export async function findWorkflow(name) {
  const found = (await allWorkflows()).filter((f) => f.workflow.name === name);
  if (!found.length) throw new Errors.NotFoundError(`No workflow '${name}' in the designer's workflows`);
  if (found.length > 1) {
    throw new Errors.ConflictError(`Workflow '${name}' is in ${found.map((f) => f.file).join(" and ")} : rename one of them`);
  }
  return found[0];
}

// ─── a node's job ─────────────────────────────────────────────────────────────

/**
 * The extravars a node's job gets : the workflow job's own (the form's fields, the user), without
 * its reserved keys (__playbook__, __inventory__... : the node's job sets its own), over the
 * node's extra_data and the workflow's extra_vars - the form's values win, as a survey's do in AWX.
 *
 * Args:
 *   parent (object): the workflow job's extravars.
 *   workflow (object): the workflow.
 *   node (object): the node.
 *
 * Returns:
 *   object: the extravars.
 */
export function nodeExtravars(parent, workflow, node) {
  let source = parent || {};
  // one key of the extravars only (extra_vars_key), as a multistep's step key : its value, with the
  // user copied in - when the key is there and is a map ; else all of them, as without one
  const slice = node.extra_vars_key ? source[node.extra_vars_key] : undefined;
  if (slice && typeof slice === "object" && !Array.isArray(slice)) {
    source = { ...slice };
    if (parent?.ansibleforms_user !== undefined) source.ansibleforms_user = parent.ansibleforms_user;
    else delete source.ansibleforms_user;
  }
  const own = Object.fromEntries(Object.entries(source).filter(([k]) => !/^__.*__$/.test(k)));
  return { ...varsOf(node.extra_data), ...varsOf(workflow.extra_vars), ...own };
}

/**
 * Whether a node runs : without a condition always ; with one (if_extra_var) when that extravar
 * of the workflow job is true, exactly - as a multistep's step ifExtraVar.
 *
 * Args:
 *   parent (object): the workflow job's extravars.
 *   node (object): the node.
 *
 * Returns:
 *   boolean: true when it runs.
 */
export function nodeRuns(parent, node) {
  return !node.if_extra_var || parent?.[node.if_extra_var] === true;
}

// the form type a runner's template or job is run with : an awx runner's an awx form (aap and
// ascender are the same) ; an RTE's a playbook form
const FORM_TYPE_OF_RUNNER = { rte: "ansible", awx: "awx", semaphore: "semaphore", rundeck: "rundeck", jenkins: "jenkins" };

/**
 * How a node's credentials reach its playbook : a vault one opens the vaults, the first ssh one
 * logs in, the others are passed to the playbook under their own name (as a form's credentials).
 *
 * Args:
 *   credentials (object[]): the node's credentials ({ name, kind }).
 *   types (Map): name -> the instance's credential_type.
 *
 * Returns:
 *   object: { ansibleCredentials, vaultCredentials, credentials : { name : name } }.
 */
export function credentialRoles(credentials, types) {
  const out = { ansibleCredentials: "", vaultCredentials: "", credentials: {} };
  for (const c of credentials || []) {
    if (c.kind.includes("vault") && !out.vaultCredentials) out.vaultCredentials = c.name;
    else if ((types.get(c.name) || "ssh") === "ssh" && !out.ansibleCredentials) out.ansibleCredentials = c.name;
    else out.credentials[c.name] = c.name;
  }
  return out;
}

/**
 * The form a job template node's job runs : the node's playbook and what its run uses.
 *
 * Args:
 *   workflow (object): the workflow.
 *   node (object): the node.
 *   types (Map): name -> the instance's credential_type.
 *
 * Returns:
 *   object: the step's form (as a multistep's step).
 */
export function nodeForm(workflow, node, types, runnerType = "") {
  const formType = node.runner ? FORM_TYPE_OF_RUNNER[runnerType] : "ansible";
  if (!formType) throw new Error(`node '${node.identifier}' names runner '${node.runner}', which is no runner a node can run on`);
  if (formType !== "ansible") return templateNodeForm(workflow, node, formType);
  const roles = credentialRoles(node.credentials, types);
  const form = { type: "ansible", name: `${workflow.name} - ${node.identifier}`, playbook: node.name };
  if (node.runner) form.runner = node.runner;
  if (node.inventory) form.inventory = node.inventory;
  if (node.limit) form.limit = node.limit;
  if (node.job_tags) form.tags = node.job_tags;
  if (node.skip_tags) form.skipTags = node.skip_tags;
  if (node.verbosity) form.verbosity = node.verbosity;
  if (node.job_type === "check") form.check = true;
  if (node.diff_mode) form.diff = true;
  if (roles.ansibleCredentials) form.ansibleCredentials = roles.ansibleCredentials;
  if (roles.vaultCredentials) form.vaultCredentials = roles.vaultCredentials;
  if (Object.keys(roles.credentials).length) form.credentials = roles.credentials;
  return form;
}

/**
 * The form a job template node that names a template runner runs : the runner's template or job
 * by the node's name, with what of the node's run that runner takes (an awx runner AWX's
 * credentials, the others the node's credentials as a form's). The type check, the launch and
 * the output are a form's of that type, as a multistep's step.
 *
 * Args:
 *   workflow (object): the workflow.
 *   node (object): the node.
 *   formType (string): awx, semaphore, rundeck or jenkins.
 *
 * Returns:
 *   object: the step's form.
 */
function templateNodeForm(workflow, node, formType) {
  const form = { type: formType, name: `${workflow.name} - ${node.identifier}`, template: node.name, runner: node.runner };
  const names = (node.credentials || []).map((c) => c.name);
  if (formType === "awx") {
    if (node.inventory) form.inventory = node.inventory;
    if (names.length) form.awxCredentials = names;
  } else if (names.length) {
    form.credentials = Object.fromEntries(names.map((n) => [n, n]));
  }
  if (node.limit) form.limit = node.limit;
  if (node.job_tags) form.tags = node.job_tags;
  if (node.verbosity) form.verbose = true;
  if (node.job_type === "check") form.check = true;
  if (node.diff_mode) form.diff = true;
  return form;
}

/**
 * The instance's credential types, for the credentials the workflow names.
 *
 * Args:
 *   workflow (object): the workflow.
 *
 * Returns:
 *   Promise<Map>: name -> credential_type.
 */
async function credentialTypes(workflow) {
  const names = [...new Set(workflow.nodes.flatMap((n) => n.credentials.map((c) => c.name)))];
  if (!names.length) return new Map();
  const rows = await mysql.do("SELECT name, credential_type FROM AnsibleForms.`credentials` WHERE name IN (?)", [names]);
  return new Map((rows || []).map((r) => [r.name, r.credential_type || "ssh"]));
}

// ─── the run ──────────────────────────────────────────────────────────────────

/**
 * Runs a workflow job : its nodes by AWX's rules, until none is left to run.
 *
 * Args:
 *   params (object):
 *     Job (object): the job model (job.model.js : passed in, it imports this).
 *     form (string): the form's name.
 *     formObj (object): the workflow form (workflow : the workflow's name ; approval).
 *     user (object): who launched it.
 *     extravars (object): the job's extravars.
 *     credentials (object): the form's credential fields.
 *     jobid (number): the workflow job.
 *
 * Returns:
 *   Promise<void>: when the workflow job ended.
 */
export async function runWorkflow({ Job, form, formObj, user, extravars, credentials, jobid }) {
  let counter = await Job.lastOrder(jobid);
  const print = (line, stream = "stdout") => Job.printJobOutput(line, stream, jobid, ++counter);
  const end = (status, message) => Job.endJobStatus(jobid, ++counter, status === "success" ? "stdout" : "stderr", status, message);

  let found;
  try {
    const depth = Number(formObj.__workflowDepth) || 0;
    if (depth >= MAX_DEPTH) throw new Error(`workflows nested ${MAX_DEPTH} deep : a workflow that runs itself, through another ?`);
    found = await findWorkflow(formObj.workflow);
    const errors = workflowErrors(found.workflow);
    if (errors.length) throw new Error(`workflow '${formObj.workflow}' cannot run : ${errors.join(" ; ")}`);
  } catch (e) {
    await end("failed", `[ERROR]: ${e.message}`);
    return;
  }
  const { workflow, file } = found;
  const nodes = workflow.nodes;
  const types = await credentialTypes(workflow).catch(() => new Map());
  await print(`ok: [Running workflow ${workflow.name} from ${path.basename(file)}]`);

  // ─── its state, and its graph as an AWX workflow's ───
  const state = new Map(nodes.map((n) => [n.identifier, { status: "pending", doNotRun: false, job: null, started: 0, elapsed: 0 }]));
  const ids = new Map(nodes.map((n, i) => [n.identifier, i + 1]));
  let wfStatus = "running";
  let lastGraph = "";
  const saveGraph = async () => {
    const graph = JSON.stringify({
      id: jobid,
      name: workflow.name,
      status: wfStatus,
      nodes: nodes.map((n) => {
        const s = state.get(n.identifier);
        return {
          id: ids.get(n.identifier),
          name: n.identifier,
          type: n.type,
          status: s.doNotRun ? "pending" : s.status,
          elapsed: s.elapsed,
          job: s.job,
          do_not_run: s.doNotRun,
          success_nodes: n.success.map((id) => ids.get(id)),
          failure_nodes: n.failure.map((id) => ids.get(id)),
          always_nodes: n.always.map((id) => ids.get(id)),
        };
      }),
    });
    if (graph !== lastGraph) {
      lastGraph = graph;
      await Job.update({ awx_workflow: graph }, jobid);
    }
  };
  await saveGraph();

  // ─── the approval the workflow job waits on (one at a time ; others queue) ───
  const approvals = [];
  let waiting = null; // { identifier, since, timeout }
  const askApproval = async (node) => {
    waiting = { identifier: node.identifier, since: Date.now(), timeout: node.timeout };
    const approval = {
      title: node.name,
      message: node.description || `Workflow ${workflow.name} : ${node.name}`,
      roles: formObj.approval?.roles || [],
      notifications: formObj.approval?.notifications || [],
    };
    await print(`APPROVE [${node.name}] ${"*".repeat(Math.max(5, 69 - node.name.length))}`);
    await Job.transitionStatus(jobid, ["running"], { status: "approve", approval: JSON.stringify(approval) });
    try {
      await Job.sendApprovalNotification(approval, extravars, jobid);
    } catch (e) {
      logger.warning(`Workflow job ${jobid} : the approval notification failed : ${e.message}`);
    }
  };
  /**
   * Where the approval waited on stands : approved (the job running again), rejected, timed out.
   *
   * Returns:
   *   Promise<string|null>: 'successful', 'failed' or null (still waiting).
   */
  const approvalOutcome = async (jobStatus) => {
    if (jobStatus === "running") return "successful";
    if (jobStatus === "rejected") {
      // the workflow job goes on : only the node was rejected
      await Job.transitionStatus(jobid, ["rejected"], { status: "running", end: null });
      return "failed";
    }
    if (jobStatus === "approve" && waiting.timeout > 0 && Date.now() - waiting.since > waiting.timeout * 1000) {
      await Job.transitionStatus(jobid, ["approve"], { status: "running", end: null });
      await print(`changed: [${waiting.identifier} timed out after ${waiting.timeout}s]`, "stderr");
      return "failed";
    }
    return null;
  };

  // ─── a node finished : its status, its output under its banner ───
  const finish = async (node, status, lines = []) => {
    const s = state.get(node.identifier);
    s.status = status;
    s.elapsed = s.started ? (Date.now() - s.started) / 1000 : 0;
    const head = `WORKFLOW NODE [${node.identifier}] (${status}) #${ids.get(node.identifier)}`;
    await print(`${head} ${"*".repeat(Math.max(5, 79 - head.length))}`);
    for (const l of lines) await print(l.output, l.output_type || "stdout");
    await saveGraph();
  };

  // ─── a node runs ───
  // the nodes running : identifier -> the promise of its run (null : an approval, answered on
  // the ticks, so never one the loop waits on)
  const running = new Map();
  const jobStatusOf = async (id) => (await mysql.do("SELECT status FROM AnsibleForms.`jobs` WHERE id=?", [id]))?.[0]?.status;
  // a node job's output, without AnsibleForms' own lines (ok: [Running on RTE ...], ok: [Playbook
  // finished] ...) : under the node's banner they would split it, as a page reads them
  const outputOf = async (id) =>
    ((await mysql.do("SELECT output, output_type FROM AnsibleForms.`job_output` WHERE job_id=? ORDER BY `order`", [id])) || []).filter(
      (l) => !/^ok: \[[^\]]*\s[^\]]*\]/.test(String(l.output || "")),
    );
  const statusOfJob = (status) => (status === "success" || status === "warning" ? "successful" : status === "aborted" ? "canceled" : "failed");

  const runChild = async (node, childForm, childExtravars) => {
    const s = state.get(node.identifier);
    const launched = await Job.launch({ form, formObj: childForm, user, credentials, extravars: childExtravars, parentId: jobid, waitForCompletion: true });
    s.job = launched.id;
    await saveGraph();
    // an abort that came in while it was being created : passed on
    if (await Job.isAbortRequested(jobid)) await Job.requestAbort(launched.id);
    await launched.completionPromise;
    const status = statusOfJob(await jobStatusOf(launched.id));
    await finish(node, status, await outputOf(launched.id));
  };

  const run = async (node) => {
    const s = state.get(node.identifier);
    s.status = "running";
    s.started = Date.now();
    await saveGraph();
    try {
      // a condition not met : skipped, what follows it runs as after a success
      if (node.type !== "workflow_approval_template" && !nodeRuns(extravars, node)) {
        await finish(node, "skipped", [{ output: `skipped: due to condition (${node.if_extra_var} is not true)`, output_type: "stdout" }]);
        return;
      }
      if (node.type === "job_template") {
        // a runner named : its template or job, as a form of its type
        let runnerType = "";
        if (node.runner) {
          const row = await Runner.findByName(node.runner);
          if (!row) throw new Error(`no runner named '${node.runner}' - add it under Connections > Runners`);
          runnerType = row.type;
        }
        await runChild(node, nodeForm(workflow, node, types, runnerType), nodeExtravars(extravars, workflow, node));
      } else if (node.type === "workflow_job_template") {
        const child = { type: "workflow", name: `${workflow.name} - ${node.identifier}`, workflow: node.name, __workflowDepth: (Number(formObj.__workflowDepth) || 0) + 1 };
        await runChild(node, child, nodeExtravars(extravars, workflow, node));
      } else if (node.type === "project") {
        let lines = [];
        let status = "successful";
        try {
          await Repository.pull(node.name);
        } catch (e) {
          status = "failed";
          lines = [{ output: e.message, output_type: "stderr" }];
        }
        const repo = await Repository.findByName(node.name).catch(() => null);
        if (repo?.output && status === "successful") lines = [{ output: repo.output, output_type: "stdout" }];
        await finish(node, status, lines);
      } else if (node.type === "workflow_approval_template") {
        // the approval queue : askApproval when it is this one's turn, its outcome on the ticks
        approvals.push(node);
        return;
      }
    } catch (e) {
      logger.error(`Workflow job ${jobid}, node ${node.identifier} : ${e.message}`);
      await finish(node, "failed", [{ output: `[ERROR]: ${e.message}`, output_type: "stderr" }]);
    }
  };

  // ─── the loop : what may start, what may never run, what finished ───
  let aborted = false;
  for (;;) {
    const jobStatus = await jobStatusOf(jobid);
    if (!aborted && (jobStatus === "aborted" || (await Job.isAbortRequested(jobid)))) {
      aborted = true;
      wfStatus = "canceled";
      // waiting on an approval : it runs again, to end as aborted
      await Job.transitionStatus(jobid, ["approve"], { status: "running", end: null });
      await print("changed: [aborting the workflow : nothing more starts]", "stderr");
      // the running jobs : Job.abort aborts a running child ; asked again for one created since
      for (const [identifier] of running) {
        const job = state.get(identifier).job;
        if (job) await Job.requestAbort(job).catch(() => {});
      }
      // an approval waited on, and those queued : canceled
      for (const node of [...approvals, ...(waiting ? [nodes.find((n) => n.identifier === waiting.identifier)] : [])]) {
        await finish(node, "canceled");
        running.delete(node.identifier);
      }
      approvals.length = 0;
      waiting = null;
    }
    // an approval : asked, then answered
    if (!aborted) {
      if (!waiting && approvals.length) {
        // asked now : answered on a later tick, from the status as it is then (the one read
        // above is from before the asking, running - it would read as approved)
        await askApproval(approvals[0]);
      } else if (waiting) {
        const outcome = await approvalOutcome(await jobStatusOf(jobid));
        if (outcome) {
          const node = approvals.shift();
          waiting = null;
          await print(`changed: [${node.identifier} ${outcome === "successful" ? "approved" : "not approved"}]`, outcome === "successful" ? "stdout" : "stderr");
          await finish(node, outcome);
          running.delete(node.identifier);
        }
      }
    }
    // what will never run, then what starts
    if (!aborted) {
      let step = nextStep(nodes, state);
      while (step.skip.length) {
        for (const id of step.skip) state.get(id).doNotRun = true;
        step = nextStep(nodes, state);
      }
      await saveGraph();
      for (const id of step.start) {
        const node = nodes.find((n) => n.identifier === id);
        if (node.type === "workflow_approval_template") {
          running.set(id, null);
          await run(node);
        } else {
          running.set(id, run(node).finally(() => running.delete(id)));
        }
      }
    }
    if (!running.size) break;
    await Promise.race([...[...running.values()].filter(Boolean), sleep(TICK_MS)]);
  }

  // ─── its end ───
  if (aborted) {
    // what never started : it will not
    for (const n of nodes) if (state.get(n.identifier).status === "pending") state.get(n.identifier).doNotRun = true;
    wfStatus = "canceled";
    await saveGraph();
    await end("aborted", "[ERROR]: workflow aborted");
    return;
  }
  const failed = workflowFailed(nodes, state);
  wfStatus = failed ? "failed" : "successful";
  await saveGraph();
  const recap = nodes
    .map((n) => {
      const s = state.get(n.identifier);
      return `${n.identifier} : ${s.doNotRun ? "do not run" : s.status}`;
    })
    .join(", ");
  await print(`WORKFLOW RECAP ${"*".repeat(64)}`);
  await print(recap);
  if (failed) await end("failed", `[ERROR]: workflow ${workflow.name} failed : a node failed and nothing handled it`);
  else await end("success", `ok: [workflow ${workflow.name} successful]`);
}
