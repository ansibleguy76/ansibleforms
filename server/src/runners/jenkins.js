// The jenkins runner : a job on Jenkins (jenkins.io). A form of type jenkins names it with
// `runner: <name>` (or runs on the default one) and its job with `job: <name>` (`template:`
// says the same) - its path when it is in a folder,
// `ops/deploy` - under the runner's folder when the runner has one (`project`). The build's
// console is followed back into the job, as an AWX job's output is.
//
// The runner row : uri (the Jenkins server, e.g. https://jenkins.example.com, with its path when
// Jenkins runs under one), username and token (a user's API token : Jenkins signs in with both,
// and asks no CSRF crumb of an API token), project (a folder the jobs are in, optional).
import logger from "../lib/logger.js";
import Errors from "../lib/errors.js";
import mysql from "../models/db.model.js";
import Credential from "../models/credential.model.v2.js";
// a cycle (job.model imports the orchestrator) ; only used when a job runs
import Job from "../models/job.model.js";
import { forgetJobSecrets } from "../lib/outputMask.js";
import { clientFor, contactTolerance, delay, jobEnded, lostContact } from "./common.js";

const POLL_MS = 1000;

// a build's result : SUCCESS and ABORTED are what they say, anything else (FAILURE, UNSTABLE,
// NOT_BUILT) failed
const RESULT = { SUCCESS: "success", ABORTED: "aborted" };

// Jenkins hides its console notes in the log text (`ESC[8mha:////<base64>ESC[0m`, a pipeline's
// step annotations) : the console page reads them, a text shows them as noise
// eslint-disable-next-line no-control-regex -- the escape character is what the note is made of
const CONSOLE_NOTE = /\x1b\[8mha:[^\x1b]*\x1b\[0m/g;

function client(runner) {
  const basic = Buffer.from(`${runner.username || ""}:${runner.token || ""}`).toString("base64");
  return clientFor(runner, { Authorization: `Basic ${basic}`, Accept: "application/json" });
}

// what the job output (or the connection test) says when Jenkins does not take the call
function describe(err, runner) {
  const status = err?.response?.status;
  const at = `Jenkins at ${runner.uri}`;
  if (status === 401) return `${at} refused the user and API token: check the user and the API token stored here`;
  if (status === 403) return `${at}: user ${runner.username} may not do this (its permissions in Jenkins)`;
  if (status === 404) return err.what === "folder" ? `${at} has no folder ${runner.project}` : `${at}: not found`;
  if (status) return `${at} answered ${status}: ${err.message}`;
  return `${at} is unreachable: ${err.code || err.message}`;
}

/**
 * A job's (or a folder's) path in Jenkins' urls : /job/ops/job/deploy for ops/deploy.
 *
 * Args:
 *   names (string): the path, its parts separated by /.
 *
 * Returns:
 *   string: the url path, empty for none.
 */
export function jobPath(names) {
  const parts = String(names ?? "")
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.map((p) => `/job/${encodeURIComponent(p)}`).join("");
}

// the full name of the job a form names : under the runner's folder when it has one
const fullName = (runner, template) => [runner.project, template].map((x) => String(x ?? "").trim().replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/");

/** proves the connection works : Jenkins answers, the user and token are valid, the folder exists */
async function check(runner) {
  const http = client(runner);
  try {
    const res = await http.get("/api/json", { params: { tree: "mode" } });
    const { data: me } = await http.get("/me/api/json", { params: { tree: "id" } });
    // no user signed in : Jenkins took the call as anonymous
    if (!me?.id || me.id === "anonymous") {
      const err = new Error("anonymous");
      err.response = { status: 401 };
      throw err;
    }
    let folder;
    if (runner.project) {
      const { data } = await http.get(`${jobPath(runner.project)}/api/json`, { params: { tree: "fullName" } }).catch((err) => {
        err.what = "folder";
        throw err;
      });
      folder = data?.fullName;
    }
    return { version: res.headers?.["x-jenkins"], user: me.id, ...(folder ? { folder } : {}) };
  } catch (err) {
    throw new Errors.BadRequestError(describe(err, runner));
  }
}

/**
 * The job a form names, with the parameters it declares : only those are sent. Jenkins ignores
 * a parameter a job does not declare, but it would still carry every extra var - the credentials
 * too - to Jenkins.
 */
async function findJob(http, runner, template) {
  const name = fullName(runner, template);
  if (!String(template ?? "").trim()) throw new Errors.BadRequestError("The form names no job (job: <name>, or <folder>/<name>)");
  let data;
  try {
    ({ data } = await http.get(`${jobPath(name)}/api/json`, {
      params: { tree: "fullName,buildable,_class,property[parameterDefinitions[name]]" },
    }));
  } catch (err) {
    if (err?.response?.status === 404) throw new Errors.NotFoundError(`No job '${name}' on Jenkins at ${runner.uri}`);
    throw err;
  }
  if (!data?.buildable) {
    throw new Errors.BadRequestError(`Jenkins job '${name}' cannot be built: it is disabled, or a folder (name the job inside it)`);
  }
  const parameters = (data.property || []).flatMap((p) => p?.parameterDefinitions || []).map((p) => p?.name).filter(Boolean);
  return { name: data.fullName || name, path: jobPath(data.fullName || name), parameters };
}

// a parameter's value : Jenkins takes strings ; a yes / no as true or false, a list or an object
// as its json
function parameterValue(v) {
  if (v === null || v === undefined) return "";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

async function launchJob(runner, extravars, credentials, jobid, counter) {
  const http = client(runner);
  await Job.printJobOutput(`ok: [Running on Jenkins ${runner.name} (${runner.uri})]`, "stdout", jobid, ++counter);
  let job;
  let queueId;
  let sent;
  try {
    job = await findJob(http, runner, extravars.__template__);
    const values = { ...extravars, ...credentials };
    const body = new URLSearchParams();
    for (const name of job.parameters) if (Object.prototype.hasOwnProperty.call(values, name)) body.append(name, parameterValue(values[name]));
    sent = [...body.keys()];
    // a job with parameters is built with them (its defaults for the ones the form has not) ;
    // delay=0sec : no quiet period, it starts as soon as an executor is free
    const action = job.parameters.length ? "buildWithParameters" : "build";
    const res = await http.post(`${job.path}/${action}`, body.toString(), {
      params: { delay: "0sec" },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    queueId = Number(/\/queue\/item\/(\d+)/.exec(res.headers?.location || "")?.[1]);
    if (!queueId) throw new Error("Jenkins returned no queue item");
  } catch (err) {
    const name = job ? job.name : fullName(runner, extravars.__template__);
    const why = err instanceof Errors.NotFoundError || err instanceof Errors.BadRequestError ? err.message : describe(err, runner);
    logger.error(`Job ${jobid}: could not build job ${name} on Jenkins: ${why}`);
    // "failed" : endJobStatus also mails the status
    await Job.endJobStatus(jobid, counter + 1, "stderr", "failed", `[ERROR]: Failed to launch job ${name}: ${why}`);
    throw jobEnded(new Errors.ApiError(why));
  }
  const withParameters = sent.length ? `, parameters ${sent.join(", ")}` : "";
  await Job.printJobOutput(`ok: [Queued job ${job.name}${withParameters}]`, "stdout", jobid, ++counter);
  const started = await waitForBuild(runner, job, queueId, jobid, counter);
  if (typeof started !== "object") return started;
  logger.info(`Job ${jobid}: Jenkins build #${started.number} of job ${job.name}`);
  await Job.update({ awx_id: started.number }, jobid);
  await Job.printJobOutput(`ok: [Launched job ${job.name} with build #${started.number}]`, "stdout", jobid, started.counter + 1);
  return trackBuild(runner, job, started.number, jobid, started.counter + 1);
}

/**
 * Wait in Jenkins' queue until the build starts : why it waits said once each time it changes
 * (no free executor, a quiet period), the queue item cancelled on an abort.
 *
 * Returns:
 *   object|string|boolean: { number, counter } once the build started ; else how the job ended.
 */
async function waitForBuild(runner, job, queueId, jobid, counter) {
  const http = client(runner);
  const contact = contactTolerance();
  let said = "";
  for (;;) {
    let item;
    try {
      ({ data: item } = await http.get(`/queue/item/${queueId}/api/json`, { params: { tree: "cancelled,why,executable[number]" } }));
      contact.ok();
    } catch (err) {
      const message = describe(err, runner);
      const r = contact.failed();
      if (r.giveUp) {
        return lostContact(jobid, counter + 1, `[ERROR]: lost contact with Jenkins while job ${job.name} waited in its queue (${message}): check it in Jenkins`);
      }
      logger.warning(`Job ${jobid}: Jenkins did not answer [${r.failures}], retrying in ${r.waitMs / 1000}s: ${message}`);
      await delay(r.waitMs);
      continue;
    }
    if (item?.executable?.number) return { number: item.executable.number, counter };
    if (item?.cancelled) {
      await Job.resetAbortRequested(jobid);
      await Job.endJobStatus(jobid, counter + 1, "stderr", "aborted", `Job ${job.name} was cancelled in the Jenkins queue`);
      return `Job ${job.name} was cancelled in the Jenkins queue`;
    }
    if (item?.why && item.why !== said) {
      said = item.why;
      await Job.printJobOutput(`Waiting in the Jenkins queue: ${item.why}`, "stdout", jobid, ++counter);
    }
    if (await Job.isAbortRequested(jobid)) {
      try {
        await http.post("/queue/cancelItem", null, { params: { id: queueId } });
        // the item says cancelled at the next poll, which ends the job
      } catch (err) {
        // gone from the queue meanwhile : the build started, the next poll follows it
        logger.debug(`Job ${jobid}: Jenkins did not cancel queue item ${queueId} (${err.message})`);
      }
    }
    await delay(POLL_MS);
  }
}

/**
 * Follow a build to its end : its console read on from where the last poll stopped (start and
 * X-Text-Size, while X-More-Data says there is more), a line written once it is whole, the
 * console notes taken out ; then its result mapped onto ours.
 */
async function trackBuild(runner, job, number, jobid, counter) {
  const http = client(runner);
  const contact = contactTolerance();
  const build = `${job.path}/${number}`;
  let offset = 0;
  // the end of the last read that was not yet a whole line
  let pending = "";
  let abortSent = false;
  for (;;) {
    let res;
    try {
      res = await http.get(`${build}/logText/progressiveText`, { params: { start: offset }, responseType: "text", transformResponse: (d) => d });
      contact.ok();
    } catch (err) {
      const message = describe(err, runner);
      const r = contact.failed();
      if (r.giveUp) {
        return lostContact(jobid, counter + 1, `[ERROR]: lost contact with Jenkins while following build #${number} of ${job.name} (${message}): it may still be running, check it in Jenkins`);
      }
      logger.warning(`Job ${jobid}: Jenkins did not answer [${r.failures}], retrying in ${r.waitMs / 1000}s: ${message}`);
      await delay(r.waitMs);
      continue;
    }
    offset = Number(res.headers?.["x-text-size"] ?? offset) || offset;
    const more = String(res.headers?.["x-more-data"] || "") === "true";
    const text = pending + String(res.data ?? "").replace(CONSOLE_NOTE, "");
    // whole lines now ; the rest waits for its end, unless the console is complete
    const cut = more ? text.lastIndexOf("\n") + 1 : text.length;
    pending = text.slice(cut);
    const lines = text.slice(0, cut).replace(/\r/g, "").replace(/\n$/, "");
    let abortRequested = false;
    if (lines) abortRequested = await Job.printJobOutput(lines, "stdout", jobid, ++counter);
    // the abort flag, also when there was nothing to write
    if (!abortRequested) abortRequested = await Job.isAbortRequested(jobid);

    if (!more) {
      let result;
      try {
        const { data } = await http.get(`${build}/api/json`, { params: { tree: "result,building" } });
        // the console is complete a moment before the build has its result
        if (data?.building || !data?.result) {
          await delay(POLL_MS);
          continue;
        }
        result = data.result;
      } catch (err) {
        logger.warning(`Job ${jobid}: could not read the result of build #${number}, retrying: ${err.message}`);
        await delay(POLL_MS);
        continue;
      }
      const ended = RESULT[result] || "failed";
      if (ended === "success") {
        await Job.endJobStatus(jobid, counter + 1, "stdout", "success", `ok: [Successfully completed job ${job.name}, build #${number}]`);
        return true;
      }
      if (ended === "aborted") {
        await Job.resetAbortRequested(jobid);
        await Job.endJobStatus(jobid, counter + 1, "stderr", "aborted", `Job ${job.name} was aborted (build #${number})`);
        return `Job ${job.name} was aborted`;
      }
      const message = `Job ${job.name} completed with result ${result} (build #${number})`;
      await Job.endJobStatus(jobid, counter + 1, "stderr", "failed", `[ERROR]: ${message}`);
      return message;
    }
    if (abortRequested && !abortSent) {
      abortSent = true;
      await Job.printJobOutput("Abort requested", "stderr", jobid, ++counter);
      try {
        await http.post(`${build}/stop`, null, { maxRedirects: 0, validateStatus: (s) => s < 400 });
        // the build ends as aborted : the next polls write its last lines and end the job
      } catch (err) {
        await Job.printJobOutput(`Abort request denied (${err.response ? describe(err, runner) : err.message}), reverting abort request`, "stderr", jobid, ++counter);
        await Job.resetAbortRequested(jobid);
        abortSent = false;
      }
    }
    await delay(POLL_MS);
  }
}

export default {
  type: "jenkins",
  capabilities: { playbook: false, template: true },
  check,
  // resolves once the build has ended and its console is tracked
  async launch(ctx) {
    const { jobId, extravars, credentialMap, runner } = ctx;
    const credentials = await Credential.resolveCredentialMap(extravars.__credentials__ || credentialMap || {});
    // the build's console is tracked here : the credentials' secrets and the password fields'
    // values are masked in it (they may be passed to Jenkins as parameters)
    const rows = await mysql.do("SELECT form FROM AnsibleForms.`jobs` WHERE id=?", [jobId]);
    await Job.registerOutputSecrets(jobId, { form: rows?.[0]?.form, extravars, credentials });
    try {
      return await launchJob(runner, extravars, credentials, jobId, await Job.lastOrder(jobId));
    } finally {
      forgetJobSecrets(jobId);
    }
  },
  // the fast path : stops the build straight away ; the tracker also sees the abort flag (and
  // cancels a build still in the queue)
  async cancel(ctx) {
    const rows = await mysql.do("SELECT awx_id, extravars FROM AnsibleForms.`jobs` WHERE id=?", [ctx.jobId]);
    const number = rows?.[0]?.awx_id;
    if (!number) return;
    let template;
    try {
      template = JSON.parse(rows[0].extravars || "{}").__template__;
    } catch {
      return;
    }
    try {
      await client(ctx.runner).post(`${jobPath(fullName(ctx.runner, template))}/${number}/stop`, null, { maxRedirects: 0, validateStatus: (s) => s < 400 });
    } catch (err) {
      logger.debug(`Job ${ctx.jobId}: Jenkins did not take the stop (${err.message}) ; the tracker will`);
    }
  },
};
