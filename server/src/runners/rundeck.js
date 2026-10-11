// The rundeck runner : a job on Rundeck (rundeck.com). A form of type awx names it with
// `runner: <name>` and its job with `template: <group/name>`, `<name>` or the job's uuid ; the
// execution's output is followed back into the job, as an AWX job's is.
//
// The runner row : uri (the Rundeck server, e.g. https://rundeck.example.com), token (a user's
// API token), project (the project name the jobs are in). The API is used at version 41, which
// Rundeck 4.x to 6.x speak.
import yaml from "yaml";
import logger from "../lib/logger.js";
import Errors from "../lib/errors.js";
import mysql from "../models/db.model.js";
import Credential from "../models/credential.model.v2.js";
// a cycle (job.model imports the orchestrator) ; only used when a job runs
import Job from "../models/job.model.js";
import { forgetJobSecrets } from "../lib/outputMask.js";
import { clientFor, contactTolerance, delay, jobEnded, lostContact } from "./common.js";

const API = "/api/41";
const POLL_MS = 1000;
// how much output one poll reads
const MAX_LINES = 500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// an execution's status : succeeded and aborted are what they say, anything else that ended
// (failed, timedout, failed-with-retry, other) failed
const STATUS = { succeeded: "success", aborted: "aborted" };

function client(runner) {
  return clientFor(runner, { "X-Rundeck-Auth-Token": runner.token || "", Accept: "application/json" });
}

// what the job output (or the connection test) says when Rundeck does not take the call
function describe(err, runner) {
  const status = err?.response?.status;
  const at = `Rundeck at ${runner.uri}`;
  const said = err?.response?.data?.message || err?.response?.data?.error;
  if (status === 401 || status === 403) return `${at} refused the token : check the API token stored here${said ? ` (${said})` : ""}`;
  if (status === 404) return err.what === "project" ? `${at} has no project ${runner.project}` : `${at} : ${said || "not found"}`;
  if (status) return `${at} answered ${status} : ${said || err.message}`;
  return `${at} is unreachable : ${err.code || err.message}`;
}

const project = (runner) => encodeURIComponent(runner.project);

/** proves the connection works : Rundeck answers, the token is valid, the project exists */
async function check(runner) {
  const http = client(runner);
  try {
    const { data } = await http.get(`${API}/system/info`);
    const { data: p } = await http.get(`${API}/project/${project(runner)}`).catch((err) => {
      err.what = "project";
      throw err;
    });
    return { version: data?.system?.rundeck?.version, apiVersion: data?.system?.rundeck?.apiversion, project: p?.name };
  } catch (err) {
    throw new Errors.BadRequestError(describe(err, runner));
  }
}

/**
 * The job a form names : a job's uuid as it is, else `group/name` (the group being everything
 * before the last /) or a bare name, matched exactly in the runner's project.
 */
async function findJob(http, runner, template) {
  const wanted = String(template ?? "").trim();
  if (!wanted) throw new Errors.BadRequestError("The form names no job (template: <group/name>)");
  if (UUID.test(wanted)) {
    const { data } = await http.get(`${API}/job/${wanted}/info`);
    return data;
  }
  const at = wanted.lastIndexOf("/");
  const name = at < 0 ? wanted : wanted.slice(at + 1);
  const group = at < 0 ? null : wanted.slice(0, at);
  const params = { jobExactFilter: name };
  if (group !== null) params.groupPathExact = group;
  const { data } = await http.get(`${API}/project/${project(runner)}/jobs`, { params });
  const found = (Array.isArray(data) ? data : []).filter((j) => j.name === name && (group === null || (j.group || "") === group));
  if (!found.length) throw new Errors.NotFoundError(`No job '${wanted}' in Rundeck project ${runner.project}`);
  if (found.length > 1) throw new Errors.BadRequestError(`Several jobs are called '${name}' in Rundeck project ${runner.project} : name it with its group (group/${name})`);
  return found[0];
}

// the options a job declares : only those are sent. Rundeck accepts an option a job does not
// declare, so without this every extra var - the credentials too - would land in Rundeck.
async function jobOptions(http, jobId) {
  const { data } = await http.get(`${API}/job/${jobId}`, { params: { format: "yaml" }, headers: { Accept: "application/yaml, text/yaml, */*" }, responseType: "text" });
  const def = yaml.parse(String(data || ""));
  const job = Array.isArray(def) ? def[0] : def;
  return (job?.options || []).map((o) => o?.name).filter(Boolean);
}

// an option's value : Rundeck takes strings ; a list or an object is sent as its json
function optionValue(v) {
  if (v === null || v === undefined) return "";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

const jobLabel = (job) => (job.group ? `${job.group}/${job.name}` : job.name);

async function launchJob(runner, extravars, credentials, jobid, counter) {
  const http = client(runner);
  await Job.printJobOutput(`ok: [Running on Rundeck ${runner.name} (${runner.uri})]`, "stdout", jobid, ++counter);
  let job;
  let execution;
  let sentOptions;
  try {
    job = await findJob(http, runner, extravars.__template__);
    const declared = await jobOptions(http, job.id);
    const values = { ...extravars, ...credentials };
    const options = {};
    for (const name of declared) if (Object.prototype.hasOwnProperty.call(values, name)) options[name] = optionValue(values[name]);
    sentOptions = Object.keys(options);
    const body = { options };
    if (extravars.__limit__) body.filter = String(extravars.__limit__);
    if (extravars.__verbose__) body.loglevel = "DEBUG";
    ({ data: execution } = await http.post(`${API}/job/${job.id}/run`, body));
    if (!execution?.id) throw new Error("Rundeck returned no execution");
  } catch (err) {
    const name = job ? jobLabel(job) : extravars.__template__;
    const why = err instanceof Errors.NotFoundError || err instanceof Errors.BadRequestError ? err.message : describe(err, runner);
    logger.error(`Job ${jobid} : could not run job ${name} on Rundeck : ${why}`);
    // "failed" : endJobStatus also mails the status
    await Job.endJobStatus(jobid, counter + 1, "stderr", "failed", `[ERROR]: Failed to launch job ${name} : ${why}`);
    throw jobEnded(new Errors.ApiError(why));
  }
  logger.info(`Job ${jobid} : Rundeck execution ${execution.id} of job ${jobLabel(job)}`);
  await Job.update({ awx_id: execution.id }, jobid);
  const withOptions = sentOptions.length ? `, options ${sentOptions.join(", ")}` : "";
  await Job.printJobOutput(`ok: [Launched job ${jobLabel(job)} with execution id ${execution.id}${withOptions}]`, "stdout", jobid, ++counter);
  return trackExecution(runner, job, execution.id, jobid, counter);
}

/**
 * Follow an execution to its end : its output read on from where the last poll stopped (offset
 * and lastmod), an ERROR line as stderr, then its status mapped onto ours.
 */
async function trackExecution(runner, job, executionId, jobid, counter) {
  const http = client(runner);
  const contact = contactTolerance();
  // where the output was read up to ; lastModified is absent until the first line
  let offset = 0;
  let lastmod = 0;
  let abortSent = false;
  // the nodes the output came from : once there are two, each line says its node - the lines of
  // a job that runs on several nodes interleave
  const nodes = new Set();
  for (;;) {
    let out;
    try {
      ({ data: out } = await http.get(`${API}/execution/${executionId}/output`, { params: { offset, lastmod, maxlines: MAX_LINES } }));
      contact.ok();
    } catch (err) {
      const message = describe(err, runner);
      const r = contact.failed();
      if (r.giveUp) {
        return lostContact(jobid, counter + 1, `[ERROR]: lost contact with Rundeck while following execution ${executionId} (${message}) : it may still be running, check it in Rundeck`);
      }
      logger.warning(`Job ${jobid} : Rundeck did not answer [${r.failures}], retrying in ${r.waitMs / 1000}s : ${message}`);
      await delay(r.waitMs);
      continue;
    }
    offset = Number(out?.offset ?? offset) || offset;
    if (out?.lastModified !== undefined) lastmod = Number(out.lastModified) || lastmod;
    // consecutive lines of one stream in one row, the order kept
    let abortRequested = false;
    let chunk = [];
    let stream = "stdout";
    const flush = async () => {
      if (chunk.length) abortRequested = (await Job.printJobOutput(chunk.join("\n"), stream, jobid, ++counter)) || abortRequested;
      chunk = [];
    };
    const entries = Array.isArray(out?.entries) ? out.entries : [];
    for (const e of entries) if (e?.node) nodes.add(e.node);
    for (const e of entries) {
      const s = e?.level === "ERROR" ? "stderr" : "stdout";
      if (s !== stream) {
        await flush();
        stream = s;
      }
      const prefix = nodes.size > 1 && e?.node ? `[${e.node}] ` : "";
      chunk.push(prefix + String(e?.log ?? ""));
    }
    await flush();
    // the abort flag, also when there was nothing to write
    if (!abortRequested) abortRequested = await Job.isAbortRequested(jobid);

    if (out?.execCompleted && out?.completed) {
      let status = out.execState;
      try {
        const { data } = await http.get(`${API}/execution/${executionId}`);
        status = data?.status || status;
      } catch (err) {
        logger.warning(`Job ${jobid} : could not read the end status of execution ${executionId}, taking ${status} : ${err.message}`);
      }
      const ended = STATUS[status] || "failed";
      if (ended === "success") {
        await Job.endJobStatus(jobid, counter + 1, "stdout", "success", `ok: [Successfully completed job ${jobLabel(job)}]`);
        return true;
      }
      if (ended === "aborted") {
        await Job.resetAbortRequested(jobid);
        await Job.endJobStatus(jobid, counter + 1, "stderr", "aborted", `Job ${jobLabel(job)} was aborted`);
        return `Job ${jobLabel(job)} was aborted`;
      }
      const message = `Job ${jobLabel(job)} completed with status ${status}`;
      await Job.endJobStatus(jobid, counter + 1, "stderr", "failed", `[ERROR]: ${message}`);
      return message;
    }
    if (abortRequested && !abortSent) {
      abortSent = true;
      await Job.printJobOutput("Abort requested", "stderr", jobid, ++counter);
      try {
        const { data } = await http.get(`${API}/execution/${executionId}/abort`);
        if (data?.abort?.status === "failed") throw new Error(data.abort.reason || "Rundeck refused the abort");
        // the execution ends as aborted : the next polls write its last lines and end the job
      } catch (err) {
        await Job.printJobOutput(`Abort request denied (${err.response ? describe(err, runner) : err.message}), reverting abort request`, "stderr", jobid, ++counter);
        await Job.resetAbortRequested(jobid);
        abortSent = false;
      }
    }
    // Rundeck's own advice : wait longer when nothing changed
    await delay(out?.unmodified ? POLL_MS * 2 : POLL_MS);
  }
}

export default {
  type: "rundeck",
  capabilities: { playbook: false, template: true },
  check,
  // resolves once the execution has ended and its output is tracked
  async launch(ctx) {
    const { jobId, extravars, credentialMap, runner } = ctx;
    const credentials = await Credential.resolveCredentialMap(extravars.__credentials__ || credentialMap || {});
    // the execution's output is tracked here : the credentials' secrets and the password
    // fields' values are masked in it (they may be passed to Rundeck as options)
    const rows = await mysql.do("SELECT form FROM AnsibleForms.`jobs` WHERE id=?", [jobId]);
    await Job.registerOutputSecrets(jobId, { form: rows?.[0]?.form, extravars, credentials });
    try {
      return await launchJob(runner, extravars, credentials, jobId, await Job.lastOrder(jobId));
    } finally {
      forgetJobSecrets(jobId);
    }
  },
  // the fast path : aborts the execution straight away ; the tracker also sees the abort flag
  async cancel(ctx) {
    const rows = await mysql.do("SELECT awx_id FROM AnsibleForms.`jobs` WHERE id=?", [ctx.jobId]);
    const executionId = rows?.[0]?.awx_id;
    if (!executionId) return;
    try {
      await client(ctx.runner).get(`${API}/execution/${executionId}/abort`);
    } catch (err) {
      logger.debug(`Job ${ctx.jobId} : Rundeck did not take the abort (${err.message}) ; the tracker will`);
    }
  },
};
