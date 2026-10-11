// What the runners that follow a job on another system share (awx, semaphore) : the http
// client, the tolerance for that system not answering for a while, and ending a job when
// contact is lost. Each runner keeps its own wording.
import axios from "axios";
import https from "https";
import { stripTrailingSlashes } from "../lib/url.js";
// a cycle (job.model imports the orchestrator, which reaches the runners) ; Job is only used
// when a job runs, long after both modules have loaded
import Job from "../models/job.model.js";

export function delay(t, v) {
  return new Promise((resolve) => setTimeout(resolve, t, v));
}

/** the certificate checked or not, against a private authority's certificates when given */
export function getHttpsAgent(runner) {
  return new https.Agent({
    rejectUnauthorized: !runner.ignore_certs,
    ca: runner.ca_bundle || undefined,
  });
}

// every call : a connection that hangs must fail and reach the retries, not wait for ever
export const REMOTE_TIMEOUT_MS = 60000;

/**
 * An axios client for a runner's server : its uri as the base, its certificate settings, the
 * timeout every call gets.
 *
 * Args:
 *   runner (object): the runner row (uri, ignore_certs, ca_bundle).
 *   headers (object): the authorization headers.
 *
 * Returns:
 *   AxiosInstance
 */
export function clientFor(runner, headers) {
  return axios.create({
    baseURL: stripTrailingSlashes(String(runner?.uri || "")),
    headers,
    httpsAgent: getHttpsAgent(runner),
    timeout: REMOTE_TIMEOUT_MS,
  });
}

// polls in a row that may fail before the job is given up
const MAX_RETRIES = 10;

/**
 * How long the remote system may fail to answer before a followed job is given up :
 * AWX_LOST_MINUTES (5) of failures in a row, with a backoff between the tries (1, 2, 4 ... 30
 * seconds). A network blip, a restart or a busy server is no reason to end a job that is
 * running there.
 *
 * Returns:
 *   {failed: function, ok: function}: failed() counts a failure and answers { giveUp, waitMs } ;
 *     ok() starts the count again.
 */
export function contactTolerance(lostMinutes = Math.max(0, parseFloat(process.env.AWX_LOST_MINUTES ?? 5) || 0), now = Date.now) {
  let since = null;
  let failures = 0;
  return {
    failed() {
      failures++;
      if (since === null) since = now();
      const giveUp = failures >= MAX_RETRIES && now() - since >= lostMinutes * 60 * 1000;
      return { giveUp, waitMs: Math.min(30000, 1000 * 2 ** Math.min(failures - 1, 5)), failures };
    },
    ok() {
      since = null;
      failures = 0;
    },
  };
}

// an error thrown after the job was ended : who catches it must not end it again
export function jobEnded(err) {
  err.jobEnded = true;
  return err;
}

/**
 * The remote system stopped answering while a job was followed : end ours, rather than leave
 * it 'running' until the daily sweep. The job over there may well go on.
 *
 * Returns:
 *   string: the line the job ended with.
 */
export async function lostContact(jobid, counter, line) {
  await Job.resetAbortRequested(jobid).catch(() => {});
  await Job.endJobStatus(jobid, counter, "stderr", "failed", line);
  return line;
}
