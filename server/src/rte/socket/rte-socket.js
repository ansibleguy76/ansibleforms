// The RTE in a socket mode (RTE_MODE=outbound or inbound) : it talks only to the app, over one
// WebSocket, and holds no database credentials. Outbound it dials the app (APP_URL) and keeps
// the socket, redialing when it drops ; inbound it listens and the app dials it (RTE_URL, as the
// network of a database-mode RTE). Either way the same messages go both ways (protocol.js) :
// the app sends "run job N" with everything the RTE used to read in the database, the RTE runs
// it (rte/ansible-core.js) and sends its output, events, log and end back as numbered items,
// kept on its disk until the app acks them (spool.js).
//
// It imports no database module : rte/ansible-core.js reads and writes through the socket's
// job I/O below.
import express from "express";
import http from "http";
import https from "https";
import fs from "fs";
import os from "os";
import path from "path";
import { timingSafeEqual } from "crypto";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import WebSocket, { WebSocketServer } from "ws";
import { HttpsProxyAgent } from "https-proxy-agent";
import axios from "axios";
import logger from "../../lib/logger.js";
import httpsConfig from "../../../config/https.config.js";
import appConfig from "../../../config/app.config.js";
import ansibleConfig from "../../../config/ansible.config.js";
import { nodeId } from "../../lib/role.js";
import { appVersion as version } from "../../lib/version.js";
import { openJobSecrets } from "../../lib/sealedSecrets.js";
import { collectSecrets, registerJobSecrets, maskOutput } from "../../lib/outputMask.js";
import { installFatalHandlers } from "../../lib/fatal.js";
import { requestContext } from "../../lib/requestContext.js";
import { httpMetrics, metricsHandler, addScrapeGauge } from "../../lib/metrics.js";
import { onShutdown, stopWithin, isStopping } from "../../lib/shutdown.js";
import { httpServerOptions } from "../../lib/httpServerOptions.js";
import Repo from "../../models/repo.model.js";
import { runAnsibleJob, useJobIO } from "../ansible-core.js";
import { Session } from "./session.js";
import { JobSpool } from "./spool.js";
import { FileCache } from "./files.js";
import { SOCKET_CONTRACT, RTE_SOCKET_PATH, CLOSE, WINDOW, MAX_PAYLOAD, socketUrl, fingerprint } from "./protocol.js";

// ─── settings ─────────────────────────────────────────────────────────────────

const maxJobs = () => Math.max(0, parseInt(process.env.RTE_MAX_JOBS ?? 10, 10) || 0);
const drainSeconds = () => Math.max(0, parseInt(process.env.RTE_DRAIN_SECONDS ?? 25, 10) || 0);
// the persistent folder (server/persistent, /app/dist/persistent in the image)
const PERSISTENT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../persistent");
// where the items wait for the app's ack, and where the job files the app sent are kept
const spoolDir = () => process.env.RTE_SPOOL_PATH || path.join(PERSISTENT, "rte-spool");
const cacheDir = () => process.env.RTE_CACHE_PATH || path.join(PERSISTENT, "rte-files");
// transfer : the app sends the job's files ; local : the RTE runs from its own folders (mounts)
const filesMode = () => (String(process.env.RTE_FILES || "transfer").toLowerCase() === "local" ? "local" : "transfer");
// the name the RTE joins as (its runner under Connections > Runners) : RTE_NAME, else its node id
const rteName = () => String(process.env.RTE_NAME || "").trim() || nodeId;

// ─── state ────────────────────────────────────────────────────────────────────

// jobId -> { spool, job, paths, files, dirs, abort, pid, running }
const jobs = new Map();
// the socket to the app, once welcomed
let session = null;
let welcomed = false;
let cache = null;
let mode = "outbound";
let ansible = null;

/**
 * This RTE's capacity, in its hello and health : the app sends no job to a full RTE.
 *
 * Returns:
 *   object: { maxJobs, running, free, cpus, memoryMb, freeMemoryMb, load }.
 */
function capacity() {
  const running = [...jobs.values()].filter((j) => j.running).length;
  const max = maxJobs();
  return {
    maxJobs: max,
    running,
    free: max ? Math.max(0, max - running) : null,
    cpus: os.cpus().length,
    memoryMb: Math.round(os.totalmem() / 1048576),
    freeMemoryMb: Math.round(os.freemem() / 1048576),
    load: Math.round(os.loadavg()[0] * 100) / 100,
  };
}

/**
 * The ansible-core version, for the hello.
 *
 * Returns:
 *   Promise<string|null>
 */
function ansibleVersion() {
  return new Promise((resolve) => {
    execFile("ansible-playbook", ["--version"], { timeout: 10000 }, (err, stdout) => {
      if (err) return resolve(null);
      const first = String(stdout).split(/\r?\n/)[0];
      resolve((/\[core\s+([^\]]+)\]/.exec(first) || [])[1] || first.trim());
    });
  });
}

// ─── items to the app ─────────────────────────────────────────────────────────

/**
 * Sends a job's items not sent yet, within the window of items not acked.
 *
 * Args:
 *   jobId (number): the job.
 */
function pump(jobId) {
  const entry = jobs.get(jobId);
  if (!entry || !session || !welcomed) return;
  const sp = entry.spool;
  while (sp.next <= sp.seq && sp.next - sp.acked <= WINDOW) {
    const item = sp.get(sp.next);
    sp.next++;
    if (item && !session.send({ t: "item", jobId, item })) {
      sp.rewind();
      return;
    }
  }
}

/**
 * Adds an item to a job's spool and sends it.
 *
 * Args:
 *   jobId (number): the job.
 *   item (object): { kind, ... }.
 */
function emit(jobId, item) {
  const entry = jobs.get(jobId);
  if (!entry) throw new Error(`job ${jobId} is not on this RTE`);
  entry.spool.append(item);
  pump(jobId);
}

// ─── the job's I/O over the socket (rte/ansible-core.js) ──────────────────────

/**
 * Where a playbooks repository's playbooks are on this RTE (local files) : its playbooks
 * folder when it has one, else its root ; ANSIBLE_PATH without a repository.
 *
 * Args:
 *   repo (string|null): the repository used for playbooks, as the app said.
 *
 * Returns:
 *   string: the folder.
 */
function localPlaybookRoot(repo) {
  if (!repo) return ansibleConfig.path;
  const folder = Repo.folderOf(repo);
  const sub = path.join(folder, "playbooks");
  return fs.existsSync(sub) ? sub : folder;
}

const socketJobIO = {
  mode: "socket",
  async load(jobId) {
    const entry = jobs.get(jobId);
    if (!entry) return null;
    return { form: entry.job?.form || "", extravars: entry.job?.extravars ?? {}, lastOrder: Number(entry.job?.lastOrder) || 0 };
  },
  // the app masks what it stores ; this keeps the credentials' secrets out of the spool too
  async registerOutputSecrets(jobId, { credentials = {} } = {}) {
    registerJobSecrets(jobId, collectSecrets(credentials));
  },
  async playbookDirectory(jobId, playbookSubPath = "") {
    const entry = jobs.get(jobId);
    const root = entry?.dirs?.playbooks || localPlaybookRoot(entry?.paths?.playbookRepo || null);
    return playbookSubPath ? path.join(root, playbookSubPath) : root;
  },
  async inventoryRoots(jobId) {
    const entry = jobs.get(jobId);
    if (entry?.dirs?.inventories) return entry.dirs.inventories;
    const repos = (entry?.paths?.inventoryRepos || []).filter((n) => Repo.isValidName(n));
    return [{ repository: null, root: appConfig.inventoryPath }, ...repos.map((n) => ({ repository: n, root: Repo.folderOf(n) }))];
  },
  async writeOutput(jobId, record) {
    emit(jobId, { kind: "output", record: { ...record, output: maskOutput(jobId, record.output) } });
  },
  async writeEvents(jobId, events) {
    emit(jobId, { kind: "events", events });
  },
  async setJobLog(jobId, content) {
    emit(jobId, { kind: "log", content: maskOutput(jobId, content) });
  },
  async started(jobId, pid, host) {
    const entry = jobs.get(jobId);
    if (entry) entry.pid = pid;
    emit(jobId, { kind: "started", pid, host });
  },
  async exited(jobId) {
    const entry = jobs.get(jobId);
    if (entry) entry.pid = null;
    emit(jobId, { kind: "exited" });
  },
  async isAbortRequested(jobId) {
    return !!jobs.get(jobId)?.abort;
  },
  async resetAbortRequested(jobId) {
    const entry = jobs.get(jobId);
    if (entry) entry.abort = false;
  },
  async end(jobId, order, stream, status, message, artifacts = {}) {
    emit(jobId, { kind: "end", order, stream, status, message: maskOutput(jobId, message), artifacts });
  },
};

// ─── messages from the app ────────────────────────────────────────────────────

/**
 * The files a job runs from, sent by the app : fetched when not cached, and their folders set
 * on the job.
 *
 * Args:
 *   entry (object): the job.
 *
 * Returns:
 *   Promise<void>
 */
async function ensureFiles(entry) {
  const files = entry.files || {};
  if (filesMode() !== "transfer" || (!files.playbooks && !files.inventories?.length)) return;
  const ask = (hash) => !!session?.send({ t: "fetch", hash });
  const dirs = {};
  if (files.playbooks?.hash) dirs.playbooks = await cache.ensure(files.playbooks.hash, ask);
  if (files.inventories?.length) {
    dirs.inventories = [];
    for (const inv of files.inventories) {
      dirs.inventories.push({ repository: inv.repository ?? null, root: await cache.ensure(inv.hash, ask) });
    }
  }
  entry.dirs = dirs;
}

/**
 * Takes a job from the app (run) : refused when busy, stopping or of another contract, else
 * claimed and run in the background.
 *
 * Args:
 *   msg (object): { jobId, contract, sealed, job, paths, files }.
 */
async function onRun(msg) {
  const jobId = parseInt(msg.jobId, 10);
  const refuse = (error, busy = false) => session?.send({ t: "refused", jobId, error, busy });
  if (!Number.isInteger(jobId) || jobId <= 0) return refuse("jobId is required");
  if (msg.contract !== SOCKET_CONTRACT) return refuse(`this RTE speaks contract ${SOCKET_CONTRACT}, the app sent contract ${msg.contract}`);
  if (jobs.get(jobId)?.running) return session?.send({ t: "claimed", jobId });
  if (isStopping()) return refuse("this RTE is stopping", true);
  const cap = capacity();
  if (cap.maxJobs && cap.running >= cap.maxJobs) return refuse(`this RTE runs ${cap.running} jobs already (RTE_MAX_JOBS)`, true);
  let secrets;
  try {
    secrets = openJobSecrets(msg.sealed, process.env.RTE_TOKEN || "", jobId);
  } catch (err) {
    return refuse(err.message);
  }
  const entry = {
    spool: jobs.get(jobId)?.spool || new JobSpool(spoolDir(), jobId),
    job: msg.job || {},
    paths: msg.paths || {},
    files: msg.files || {},
    dirs: null,
    abort: false,
    pid: null,
    running: true,
  };
  jobs.set(jobId, entry);
  session?.send({ t: "claimed", jobId });
  logger.notice(`RTE: running job ${jobId}`);
  (async () => {
    try {
      await ensureFiles(entry);
    } catch (err) {
      await socketJobIO.end(jobId, (Number(entry.job?.lastOrder) || 0) + 1, "stderr", "failed", `[ERROR]: ${err.message}`);
      return;
    }
    await runAnsibleJob({ jobId, secrets });
  })()
    .catch((err) => logger.error(`RTE: job ${jobId} failed: ${err.message || err}`))
    .finally(() => {
      entry.running = false;
    });
}

/**
 * Stops a job (cancel) : the flag first, so the run ends as aborted, then its process group.
 *
 * Args:
 *   msg (object): { jobId }.
 */
function onCancel(msg) {
  const entry = jobs.get(parseInt(msg.jobId, 10));
  if (!entry?.running) return;
  entry.abort = true;
  if (entry.pid > 0) {
    try {
      process.kill(-entry.pid, "SIGTERM");
    } catch (e) {
      logger.debug(`RTE: could not signal job ${msg.jobId}: ${e.message}`);
    }
  }
}

/**
 * The app stored a job's items (ack) : the spool goes once its end is stored.
 *
 * Args:
 *   msg (object): { jobId, seq }.
 */
function onAck(msg) {
  const jobId = parseInt(msg.jobId, 10);
  const entry = jobs.get(jobId);
  if (!entry) return;
  if (entry.spool.ack(Number(msg.seq) || 0) && !entry.running) {
    entry.spool.remove();
    jobs.delete(jobId);
    return;
  }
  pump(jobId);
}

/**
 * Takes a socket to the app : says hello, and once welcomed sends what is not acked yet.
 *
 * Args:
 *   sess (Session): the socket.
 */
function attach(sess) {
  if (session && session !== sess) session.close(CLOSE.REPLACED, "a newer socket took over");
  session = sess;
  welcomed = false;
  sess.on("m:welcome", (msg) => {
    welcomed = true;
    sess.peer = msg;
    logger.notice(`RTE '${rteName()}': connected to the app (node ${msg.node || "?"})`);
    if (msg.pending) logger.warning(`RTE '${rteName()}': waiting for an admin to approve it under Connections > Runners (fingerprint ${fingerprint(process.env.RTE_TOKEN || "")})`);
    for (const [jobId, entry] of jobs) {
      entry.spool.rewind();
      pump(jobId);
    }
  });
  sess.on("m:run", (msg) => onRun(msg).catch((e) => logger.error(`RTE: run: ${e.message}`)));
  sess.on("m:cancel", onCancel);
  sess.on("m:ack", onAck);
  sess.on("m:file", (msg) => cache.deliver(msg));
  sess.on("close", (code, reason) => {
    if (session === sess) {
      session = null;
      welcomed = false;
      cache.failAll(new Error("the socket to the app closed while the job's files came"));
    }
    logger.warning(`RTE '${rteName()}': socket to the app closed (${code}${reason ? `: ${reason}` : ""})`);
  });
  sess.send({
    t: "hello",
    id: nodeId,
    name: rteName(),
    version,
    contract: SOCKET_CONTRACT,
    mode,
    ansible,
    files: filesMode(),
    url: process.env.RTE_URL || null,
    capacity: capacity(),
    running: [...jobs.entries()].filter(([, e]) => e.running).map(([id]) => id),
    spooled: [...jobs.keys()],
  });
}

// ─── outbound : the RTE dials the app ─────────────────────────────────────────

/**
 * What this RTE says of itself when it calls the app : its token, its id and name, and for an
 * RTE the app does not know yet (it then waits for approval) its host and version ; a join
 * token, when it has one, approves it at once.
 *
 * Args:
 *   token (string): RTE_TOKEN.
 *
 * Returns:
 *   object: the headers.
 */
function rteHeaders(token) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "X-AF-RTE-Id": nodeId,
    "X-AF-RTE-Name": rteName(),
    "X-AF-RTE-Host": os.hostname(),
    "X-AF-RTE-Version": version,
  };
  if (process.env.RTE_JOIN_TOKEN) headers["X-AF-RTE-Join"] = process.env.RTE_JOIN_TOKEN;
  return headers;
}

/**
 * Keeps a socket to the app open : dials APP_URL, and when it drops dials again, waiting a
 * little longer each time (1 s up to 30 s, with some jitter so a fleet does not dial at once).
 *
 * Args:
 *   token (string): RTE_TOKEN.
 */
function dialOut(token) {
  const url = socketUrl(process.env.APP_URL);
  let delay = 1000;
  const headers = rteHeaders(token);
  if (process.env.RTE_URL) headers["X-AF-RTE-Url"] = process.env.RTE_URL;
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || "";
  const options = {
    headers,
    maxPayload: MAX_PAYLOAD,
    handshakeTimeout: 15000,
    // a self-signed app inside the same network (compose, a pod) : APP_TLS_VERIFY=0 ; else
    // NODE_EXTRA_CA_CERTS names the CA
    rejectUnauthorized: String(process.env.APP_TLS_VERIFY ?? "1") !== "0",
  };
  if (proxy && !noProxy(new URL(url).hostname)) options.agent = new HttpsProxyAgent(proxy);
  const connect = () => {
    if (isStopping()) return;
    const ws = new WebSocket(url, options);
    ws.on("open", () => {
      delay = 1000;
      attach(new Session(ws, "app"));
    });
    ws.on("unexpected-response", (req, res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => logger.warning(`RTE '${rteName()}': the app refused the socket (${res.statusCode}): ${body.slice(0, 300)}`));
    });
    ws.on("error", (err) => logger.debug(`RTE: socket to ${url}: ${err.message}`));
    ws.on("close", () => {
      if (isStopping()) return;
      const wait = delay + Math.floor(Math.random() * 1000);
      delay = Math.min(delay * 2, 30000);
      logger.info(`RTE: dialing the app again in ${Math.round(wait / 1000)} seconds`);
      setTimeout(connect, wait).unref?.();
    });
  };
  logger.notice(`RTE '${rteName()}': dialing the app at ${url}${options.agent ? " through the proxy" : ""}`);
  connect();
}

/**
 * Whether a host bypasses the proxy (NO_PROXY).
 *
 * Args:
 *   host (string): the app's host name.
 *
 * Returns:
 *   boolean
 */
function noProxy(host) {
  const list = String(process.env.NO_PROXY || process.env.no_proxy || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.some((p) => p === "*" || host === p || host.endsWith(p.startsWith(".") ? p : `.${p}`));
}

// ─── inbound : one registration call ──────────────────────────────────────────

/**
 * Registers an inbound RTE with the app once (APP_URL set) : its runner is added or updated with
 * its mode and its address (RTE_URL), with a join token the first time, so the app dials it from
 * then on. Tried again with a backoff until the app answers ; refused (a wrong token) it stops.
 *
 * Args:
 *   token (string): RTE_TOKEN.
 *
 * Returns:
 *   Promise<void>: settles once registered, or refused.
 */
async function registerInbound(token) {
  const base = new URL(process.env.APP_URL);
  const url = `${base.origin}${base.pathname.replace(/\/+$/, "")}/api/v2/rte/register`;
  const headers = rteHeaders(token);
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy || "";
  const httpsAgent = proxy && !noProxy(base.hostname)
    ? new HttpsProxyAgent(proxy)
    : new https.Agent({ rejectUnauthorized: String(process.env.APP_TLS_VERIFY ?? "1") !== "0" });
  let delay = 2000;
  for (;;) {
    if (isStopping()) return;
    try {
      const { data } = await axios.post(url, { mode: "inbound", url: process.env.RTE_URL }, { headers, httpsAgent, proxy: false, timeout: 15000 });
      if (data.pending) logger.warning(`RTE '${rteName()}': asked to join as inbound runner '${data.runner}': the app dials it once an admin approves it under Connections > Runners (fingerprint ${fingerprint(token)})`);
      else logger.notice(`RTE '${rteName()}': registered with the app as inbound runner '${data.runner}' at ${data.uri}: the app dials it from now on`);
      return;
    } catch (err) {
      const status = err?.response?.status;
      const why = err?.response?.data?.error || err.message;
      if (status && status < 500 && status !== 429) {
        logger.error(`RTE '${rteName()}': the app refused the registration (${status}): ${why}`);
        return;
      }
      logger.warning(`RTE '${rteName()}': could not register with the app yet (${why}), trying again in ${delay / 1000} seconds`);
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 60000);
    }
  }
}

// ─── start ────────────────────────────────────────────────────────────────────

/**
 * Starts a socket-mode RTE : the spool and the files cache, the probes, then the socket -
 * dialed (outbound) or listened for (inbound).
 *
 * Args:
 *   rteMode (string): outbound or inbound.
 *
 * Returns:
 *   Promise<void>
 */
export async function startSocketRte(rteMode) {
  mode = rteMode;
  const token = process.env.RTE_TOKEN || "";
  if (token.length < 16) {
    console.error("RTE: set RTE_TOKEN (at least 16 characters) ; refusing to start");
    process.exit(1);
  }
  if (mode === "outbound" && !process.env.APP_URL) {
    console.error("RTE: RTE_MODE=outbound needs APP_URL, the app's address (https://forms.example.com) ; refusing to start");
    process.exit(1);
  }
  if (mode === "outbound") {
    try {
      socketUrl(process.env.APP_URL);
    } catch (e) {
      console.error(`RTE: ${e.message} ; refusing to start`);
      process.exit(1);
    }
  }
  if (mode === "inbound" && process.env.APP_URL && !process.env.RTE_URL) {
    console.error("RTE: RTE_MODE=inbound with APP_URL registers with the app, which then dials RTE_URL : set RTE_URL (http://this-host:8000) ; refusing to start");
    process.exit(1);
  }
  if (mode === "inbound" && !process.env.APP_URL) {
    logger.notice("RTE: inbound without APP_URL: its runner is added under Connections > Runners or in the config seed (type RTE, mode inbound, a credential with its address and RTE_TOKEN)");
  }
  installFatalHandlers("RTE");
  useJobIO(socketJobIO);
  fs.mkdirSync(spoolDir(), { recursive: true, mode: 0o700 });
  cache = new FileCache(cacheDir());
  ansible = await ansibleVersion();

  // the items an earlier start left : sent once connected ; a job that had not ended cannot go on
  for (const sp of JobSpool.loadAll(spoolDir())) {
    if (!sp.ended) sp.append({ kind: "abandon", message: "the RTE restarted while the playbook ran" });
    jobs.set(sp.jobId, { spool: sp, job: {}, paths: {}, files: {}, dirs: null, abort: false, pid: null, running: false });
    logger.warning(`RTE: job ${sp.jobId} left by an earlier start: sending what the app has not stored`);
  }

  stopWithin((drainSeconds() + 8) * 1000);
  onShutdown("running jobs", async () => {
    const until = Date.now() + drainSeconds() * 1000;
    const running = () => [...jobs.values()].filter((j) => j.running).length;
    if (running()) logger.notice(`RTE: stopping, waiting up to ${drainSeconds()} seconds for ${running()} running job(s)`);
    while (running() && Date.now() < until) await new Promise((r) => setTimeout(r, 500));
    // the last items go before the socket closes
    await new Promise((r) => setTimeout(r, 1000));
  });
  onShutdown("socket", () => session?.close(CLOSE.GOING_AWAY, "the RTE stops"));

  // the probes and the metrics, as a database-mode RTE's ; ready : connected to the app
  const app = express();
  app.disable("x-powered-by");
  app.use(requestContext);
  app.use(httpMetrics);
  app.get("/live", (req, res) => res.json({ status: "live" }));
  app.get("/ready", (req, res) =>
    isStopping() ? res.status(503).json({ status: "not ready", reason: "stopping" })
      : mode === "outbound" && !welcomed ? res.status(503).json({ status: "not ready", reason: "not connected to the app" })
        : res.json({ status: "ready" }));
  addScrapeGauge("af_rte_running_jobs", "The playbooks this RTE runs now", [], async (g) => g.set(capacity().running));
  addScrapeGauge("af_rte_max_jobs", "How many playbooks this RTE runs at once (RTE_MAX_JOBS, 0: no limit)", [], async (g) => g.set(maxJobs()));
  addScrapeGauge("af_rte_socket_connected", "Whether this RTE's socket to the app is open (1) or not (0)", [], async (g) => g.set(welcomed ? 1 : 0));
  app.get("/metrics", metricsHandler());

  const port = appConfig.port;
  const server = httpsConfig.https
    ? https.createServer({ ...httpServerOptions(), key: httpsConfig.httpsKey, cert: httpsConfig.httpsCert }, app)
    : http.createServer(httpServerOptions(), app);
  server.on("error", (err) => {
    console.error(`RTE: cannot listen on port ${port}: ${err.message}`);
    process.exit(1);
  });
  onShutdown("server", () => new Promise((resolve) => server.close(() => resolve())));

  if (mode === "inbound") {
    // the app dials /rte/v1/socket with this RTE's token ; a newer socket replaces the older one
    // (the app node holding the lease changed)
    const expected = Buffer.from(token);
    const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });
    server.on("upgrade", (req, socket, head) => {
      const url = new URL(req.url, "http://x");
      if (url.pathname !== RTE_SOCKET_PATH) return socket.destroy();
      const given = Buffer.from(String(req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
      if (!(given.length === expected.length && timingSafeEqual(given, expected))) {
        logger.warning(`RTE: refused a socket without the right token from ${req.socket.remoteAddress}`);
        socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
        return socket.destroy();
      }
      wss.handleUpgrade(req, socket, head, (ws) => attach(new Session(ws, `app ${req.headers["x-af-node"] || req.socket.remoteAddress}`)));
    });
  }

  await new Promise((resolve) => server.listen(port, resolve));
  logger.notice(`RTE '${rteName()}' ${version} (${mode}, files ${filesMode()}) listening on ${httpsConfig.https ? "https" : "http"} port ${port}, token fingerprint ${fingerprint(token)}`);
  if (mode === "outbound") dialOut(token);
  // inbound with the app's address : one call so the app knows this RTE and dials it
  else if (process.env.APP_URL) registerInbound(token).catch((e) => logger.error(`RTE: registration: ${e.message}`));

  // its health to the app every 20 s : what it runs and its free slots
  setInterval(() => {
    if (welcomed) session?.send({ t: "health", capacity: capacity(), running: [...jobs.entries()].filter(([, e]) => e.running).map(([id]) => id), stopping: isStopping() });
  }, 20000).unref();
}

// for the tests
export { socketJobIO, jobs, capacity, onRun, onAck, onCancel, attach };
