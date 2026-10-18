// The app's side of the RTE sockets (RTE_MODE=outbound or inbound on the RTE) : one WebSocket
// per RTE, held by one app node at a time (runner_leases). That node sends the RTE its jobs,
// writes what the RTE sends back - output, events, log, start, end - and acks it, sends the end
// notifications, and writes the RTE's heartbeat in `nodes` on its behalf, so the Status page,
// the Runners page and the worker's sweeps see a socket-mode RTE as they see any other.
//
//   outbound  the RTE dials /api/v2/rte/socket with its token (and, the first time, a join
//             token of Connections > Runners) ; the node that takes the call takes the lease
//   inbound   every node races for the lease of each inbound runner ; the winner dials the
//             runner's address (/rte/v1/socket) with its token and keeps the socket
//
// Any node may launch a job (runners/rte.js) : it writes the job as always, and the node holding
// the socket sends it - at once when it is the same node, else within two seconds (dispatch).
import WebSocket, { WebSocketServer } from "ws";
import logger from "../lib/logger.js";
import mysql from "../models/db.model.js";
import Job from "../models/job.model.js";
import Runner, { PENDING_MAX } from "../models/runner.model.js";
import RunnerJoinToken from "../models/runnerJoinToken.model.js";
import Credential from "../models/credential.model.v2.js";
import appConfig from "../../config/app.config.js";
import { nodeId, NODE_DEAD_SECONDS } from "../lib/role.js";
import { appVersion } from "../lib/version.js";
import { safeParse } from "../lib/safejson.js";
import { safeEqual } from "../lib/safeEqual.js";
import { resolveJobSecrets } from "../lib/jobSecrets.js";
import { sealJobSecrets } from "../lib/sealedSecrets.js";
import { forgetJobSecrets } from "../lib/outputMask.js";
import { publish } from "../lib/liveEvents.js";
import { bundleOf, bundleByHash, readChunks } from "../lib/jobFiles.js";
import { Session } from "../rte/socket/session.js";
import dbJobIO from "../rte/jobio-db.js";
import { abandonJobs } from "../rte/abandon.js";
import { getHttpsAgent, failRteJob, abortWhileWaiting, sayWaitingForSlot } from "./common.js";
import {
  SOCKET_CONTRACT, SOCKET_MODES, APP_SOCKET_PATH, CLOSE, CHUNK_BYTES, MAX_PAYLOAD, RETRY_MS,
  queueMinutes, inboundUrl, fingerprint,
} from "../rte/socket/protocol.js";

// how long a lease lasts, renewed every 20 s while the socket is open
const LEASE_SECONDS = 60;
const RENEW_MS = 20000;
// how often the jobs waiting for a socket, and the aborts, are looked for
const DISPATCH_MS = 2000;
// how often the inbound runners are looked at (a lease to take, a socket to dial)
const DIAL_MS = 10000;
// how long an RTE has to say claimed or refused
const CLAIM_TIMEOUT_MS = 30000;

// runner name -> { session, runner, direction, hello, health, rteId, renew, heartbeat }
const sessions = new Map();
// jobs being handed over or waiting for a free slot : jobId -> { retryAt, firstWait, said }
const waiting = new Map();
// the claims an RTE has not answered yet : jobId -> { resolve, timer }
const claims = new Map();
// jobs being handed over now (sendJob) : kick and dispatch never hand one over twice at once
const sending = new Set();
// jobs whose cancel was sent ; jobs whose output masks this process registered
const cancelSent = new Set();
const masked = new Set();
// each job's items, written one after the other : jobId -> Promise
const writing = new Map();
let started = false;
let wss = null;

// ─── leases ───────────────────────────────────────────────────────────────────

/**
 * Takes a runner's lease, whoever held it (outbound : the RTE dialed this node, its newest
 * socket wins).
 *
 * Args:
 *   name (string): the runner.
 *   direction (string): outbound or inbound.
 *   rteId (string): the RTE's node id.
 *
 * Returns:
 *   Promise<void>
 */
async function takeLease(name, direction, rteId) {
  await mysql.do(
    "INSERT INTO AnsibleForms.`runner_leases` (runner, node_id, expires_at, direction, rte_id) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND), ?, ?) " +
      "ON DUPLICATE KEY UPDATE node_id=VALUES(node_id), expires_at=VALUES(expires_at), direction=VALUES(direction), rte_id=VALUES(rte_id)",
    [name, nodeId, LEASE_SECONDS, direction, rteId || null]
  );
}

/**
 * Tries a runner's lease (inbound) : taken when free, expired, or this node's already.
 *
 * Args:
 *   name (string): the runner.
 *
 * Returns:
 *   Promise<boolean>: true when this node holds it now.
 */
async function tryLease(name) {
  // taken over when it expired (or renewed when it is ours) : one statement, so two nodes
  // racing for it cannot both get it. Only called while this node has no socket to it, so what
  // a socket wrote (its RTE, what it said) goes : a lease while dialing is not a connection
  const res = await mysql.do(
    "UPDATE AnsibleForms.`runner_leases` SET node_id=?, expires_at=DATE_ADD(NOW(), INTERVAL ? SECOND), direction='inbound', rte_id=NULL, info=NULL " +
      "WHERE runner=? AND (expires_at < NOW() OR node_id=?)",
    [nodeId, LEASE_SECONDS, name, nodeId]
  );
  // none yet : the first INSERT wins, the others are ignored
  if (!res?.affectedRows) {
    await mysql.do(
      "INSERT IGNORE INTO AnsibleForms.`runner_leases` (runner, node_id, expires_at, direction) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND), 'inbound')",
      [name, nodeId, LEASE_SECONDS]
    );
  }
  const rows = await mysql.do("SELECT node_id FROM AnsibleForms.`runner_leases` WHERE runner=?", [name]);
  return rows?.[0]?.node_id === nodeId;
}

/**
 * Renews a lease this node holds, with what the RTE last said.
 *
 * Args:
 *   entry (object): the session's entry.
 *
 * Returns:
 *   Promise<boolean>: false when another node holds it now.
 */
async function renewLease(entry) {
  const info = JSON.stringify({
    version: entry.hello?.version, contract: entry.hello?.contract, ansible: entry.hello?.ansible,
    mode: entry.hello?.mode, files: entry.hello?.files, capacity: entry.health?.capacity || entry.hello?.capacity,
    running: entry.health?.running || entry.hello?.running || [], node: nodeId,
  });
  const res = await mysql.do(
    "UPDATE AnsibleForms.`runner_leases` SET expires_at=DATE_ADD(NOW(), INTERVAL ? SECOND), rte_id=?, info=? WHERE runner=? AND node_id=?",
    [LEASE_SECONDS, entry.rteId || null, info, entry.runner.name, nodeId]
  );
  return (res?.affectedRows || 0) > 0;
}

/**
 * Lets a lease go (the socket closed), when this node still holds it.
 *
 * Args:
 *   name (string): the runner.
 *
 * Returns:
 *   Promise<void>
 */
async function releaseLease(name) {
  await mysql.do("DELETE FROM AnsibleForms.`runner_leases` WHERE runner=? AND node_id=?", [name, nodeId]).catch(() => {});
}

/**
 * A runner's socket, as any node sees it : who holds it, until when, and what the RTE said.
 *
 * Args:
 *   name (string): the runner.
 *
 * Returns:
 *   Promise<object|null>: { node_id, direction, rte_id, alive, info }, null when none.
 */
export async function socketState(name) {
  const rows = await mysql.do(
    "SELECT node_id, direction, rte_id, info, expires_at > NOW() AS alive FROM AnsibleForms.`runner_leases` WHERE runner=?",
    [name],
    true
  );
  if (!rows?.length) return null;
  return { ...rows[0], alive: !!rows[0].alive, info: safeParse(rows[0].info, null, `runner_leases.info ${name}`) };
}

// ─── the RTE's heartbeat, written for it ──────────────────────────────────────

/**
 * Writes a socket-mode RTE's row in `nodes`, as a database-mode RTE writes its own : the Status
 * page lists it, the Runners page shows it alive, and when it stops the worker ends its jobs.
 *
 * Args:
 *   entry (object): the session's entry.
 *
 * Returns:
 *   Promise<void>
 */
async function rteHeartbeat(entry) {
  // a runner waiting for approval runs nothing : no row of its own on the Status page yet
  if (!entry.rteId || isPending(entry)) return;
  const info = JSON.stringify({ mode: entry.hello?.mode, runner: entry.runner.name, socket: nodeId, capacity: entry.health?.capacity || entry.hello?.capacity });
  try {
    // step 1 : its row, renewed - only the row of an RTE : an app or a worker node's row is
    // never written over, whatever id the RTE said it has
    const res = await mysql.tryDo(
      "UPDATE AnsibleForms.`nodes` SET version=?, last_seen=NOW(), is_worker=0, info=? WHERE id=? AND role='rte'",
      [entry.hello?.version || null, info, entry.rteId]
    );
    // step 2 : none yet : added ; a row of another role by that id stays as it is
    if (!res?.affectedRows) {
      await mysql.tryDo(
        "INSERT IGNORE INTO AnsibleForms.`nodes` (id, role, version, started_at, last_seen, is_worker, info) VALUES (?, 'rte', ?, NOW(), NOW(), 0, ?)",
        [entry.rteId, entry.hello?.version || null, info]
      );
    }
  } catch (e) {
    logger.debug(`RTE heartbeat for ${entry.rteId}: ${e.message}`);
  }
}

// ─── a socket's life ──────────────────────────────────────────────────────────

/**
 * Whether a session's runner waits for an admin's approval : connected, but it gets no job, and
 * nothing it sends is stored.
 *
 * Args:
 *   entry (object): the session's entry.
 *
 * Returns:
 *   boolean
 */
function isPending(entry) {
  return !!Number(entry?.runner?.pending);
}

/**
 * Whether a session may run jobs : welcomed, open, and its runner approved.
 *
 * Args:
 *   entry (object): the session's entry.
 *
 * Returns:
 *   boolean
 */
function canRun(entry) {
  return !!(entry?.hello && entry.session.open && !isPending(entry));
}

/**
 * Why an RTE may not go by the id it said in its hello, if it may not : the id is what its jobs
 * are claimed with (jobs.host) and the name of its row in `nodes`, so one runner's RTE must not
 * take the id of an app node, nor of another runner's RTE.
 *
 * Args:
 *   name (string): the runner the socket signed in as.
 *   rteId (string): the id its hello said.
 *
 * Returns:
 *   Promise<string|null>: why it is taken, null when it is free (or this runner's already).
 */
async function rteIdTaken(name, rteId) {
  // step 1 : a node by that id : an app or a worker node, or a live RTE of another runner (a
  // database-mode RTE writes no runner in its row : taken while it lives)
  const nodes = await mysql.do(
    "SELECT role, info, last_seen > (NOW() - INTERVAL ? SECOND) AS alive FROM AnsibleForms.`nodes` WHERE id=?",
    [NODE_DEAD_SECONDS, rteId],
    true
  );
  const node = nodes?.[0];
  if (node && node.role !== "rte") return `it is the id of a node of role ${node.role}`;
  if (node && Number(node.alive) && safeParse(node.info, {}, `nodes.info ${rteId}`)?.runner !== name) return "a live RTE of another runner goes by it";
  // step 2 : the socket of another approved runner's RTE, held now by any app node (a runner
  // waiting for approval holds nothing : it cannot keep an id from its RTE)
  const leases = await mysql.do(
    "SELECT l.runner FROM AnsibleForms.`runner_leases` l JOIN AnsibleForms.`runners` r ON r.name = l.runner " +
      "WHERE l.rte_id=? AND l.runner<>? AND l.expires_at > NOW() AND COALESCE(r.pending, 0) = 0 LIMIT 1",
    [rteId, name],
    true
  );
  if (leases?.length) return `the RTE of runner '${leases[0].runner}' goes by it`;
  return null;
}

/**
 * Takes an RTE's socket : waits for its hello, checks its contract and its id, welcomes it, and
 * from then on keeps its lease and its heartbeat, writes what it sends and sends it its jobs. A
 * runner waiting for approval gets its socket and its lease, nothing more.
 *
 * Args:
 *   session (Session): the socket.
 *   runner (object): its runner.
 *   direction (string): outbound or inbound.
 */
function adopt(session, runner, direction) {
  const name = runner.name;
  const previous = sessions.get(name);
  if (previous && previous.session !== session) previous.session.close(CLOSE.REPLACED, "a newer socket of this RTE took over");
  // allowed : jobId -> Promise<boolean>, whether this RTE may write a job (itemAllowed) ;
  // refused : the jobs it was refused, said once in the log ; hashes : the job files sent to
  // it, the only ones it may fetch
  const entry = { session, runner, direction, hello: null, health: null, rteId: null, allowed: new Map(), refused: new Set(), hashes: new Set() };
  sessions.set(name, entry);
  // this socket is still the runner's, and open : after each wait, a closed or replaced one stops
  const current = () => sessions.get(name) === entry && session.open;

  const hello = setTimeout(() => {
    if (!entry.hello) session.close(CLOSE.PROTOCOL, "no hello");
  }, 15000);
  hello.unref?.();

  let helloSeen = false;
  session.on("m:hello", async (msg) => {
    // one hello per socket : a second one is ignored, never a second lease timer
    if (helloSeen) {
      logger.debug(`RTE '${name}': a second hello on the same socket, ignored`);
      return;
    }
    helloSeen = true;
    clearTimeout(hello);
    if (msg.contract !== SOCKET_CONTRACT) {
      logger.warning(`RTE '${name}' speaks contract ${msg.contract}, this app (${appVersion}) contract ${SOCKET_CONTRACT}: refused`);
      session.close(CLOSE.CONTRACT, `this app speaks contract ${SOCKET_CONTRACT}`);
      return;
    }
    // step 1 : its id, checked : never an app node's, nor another runner's RTE's
    const rteId = String(msg.id || `rte-${name}`).slice(0, 250);
    let taken;
    try {
      taken = await rteIdTaken(name, rteId);
    } catch (e) {
      logger.error(`RTE '${name}': could not check its id: ${e.message}`);
      session.close(CLOSE.LEASE_LOST, "no lease");
      return;
    }
    if (!current()) return;
    if (taken) {
      logger.warning(`RTE '${name}' says it is '${rteId}', refused: ${taken}`);
      session.close(CLOSE.ID_TAKEN, `the id ${rteId} is taken: ${taken}`);
      return;
    }
    entry.hello = msg;
    entry.rteId = rteId;
    // step 2 : its lease
    try {
      await takeLease(name, direction, entry.rteId);
    } catch (e) {
      logger.error(`RTE '${name}': could not take its lease: ${e.message}`);
      session.close(CLOSE.LEASE_LOST, "no lease");
      return;
    }
    if (!current()) return;
    // step 3 : welcomed ; a runner waiting for approval : connected, but it gets no job until an
    // admin approves it
    session.send({ t: "welcome", node: nodeId, contract: SOCKET_CONTRACT, version: appVersion, pending: isPending(entry) });
    logger.notice(`RTE '${name}' (${entry.rteId}, ${msg.version}, ${direction}) connected`);
    await renewLease(entry).catch(() => {});
    if (!current()) return;
    await rteHeartbeat(entry);
    if (!current()) return;
    publish("runners");
    // step 4 : the jobs it came back without : abandoned (an approved runner's only : one
    // waiting for approval has no job)
    if (!isPending(entry)) {
      await abandonLost(entry, msg).catch((e) => logger.error(`RTE '${name}': ${e.message}`));
      if (!current()) return;
    }
    // step 5 : its lease and its heartbeat kept, every RENEW_MS
    clearInterval(entry.renew);
    entry.renew = setInterval(() => renewTick(entry).catch((e) => logger.debug(`RTE '${name}': ${e.message}`)), RENEW_MS);
    entry.renew.unref?.();
    // its jobs waiting already : sent now
    dispatch().catch(() => {});
  });
  session.on("m:health", (msg) => {
    entry.health = msg;
  });
  // the answers of this socket's own claims only
  session.on("m:claimed", (msg) => settleClaim(msg.jobId, { claimed: true }, entry));
  session.on("m:refused", (msg) => settleClaim(msg.jobId, { claimed: false, error: msg.error, busy: !!msg.busy }, entry));
  session.on("m:item", (msg) => onItem(entry, msg));
  session.on("m:fetch", (msg) => onFetch(entry, msg));
  session.on("close", (code, reason) => {
    clearTimeout(hello);
    clearInterval(entry.renew);
    if (sessions.get(name) === entry) {
      sessions.delete(name);
      if (code !== CLOSE.LEASE_LOST && code !== CLOSE.REPLACED) releaseLease(name);
    }
    for (const [jobId, c] of claims) if (c.entry === entry) settleClaim(jobId, { claimed: false, error: "the socket closed", lost: true }, entry);
    logger.warning(`RTE '${name}' disconnected (${code}${reason ? `: ${reason}` : ""})`);
    publish("runners");
  });
}

/**
 * One renewal of a session : its runner read again (gone : the socket closes, approved : it
 * takes jobs from now on), its lease renewed (another node holds it : the socket closes) and
 * its heartbeat written.
 *
 * Args:
 *   entry (object): the session's entry.
 *
 * Returns:
 *   Promise<void>
 */
async function renewTick(entry) {
  const name = entry.runner.name;
  // step 1 : the runner, as stored now : rejected or deleted on any node, the socket closes ; the
  // RTE waits a long while before it dials again (rte-socket.js redialWait)
  let row;
  try {
    row = await Runner.findByName(name);
  } catch (e) {
    logger.debug(`RTE '${name}': reading its runner failed: ${e.message}`);
    row = entry.runner;
  }
  if (!row || row.type !== "rte") {
    logger.warning(`RTE '${name}': its runner is gone (rejected or deleted), closing its socket`);
    entry.session.close(CLOSE.UNAUTHORIZED, "this runner was removed under Connections > Runners");
    return;
  }
  entry.runner = { ...entry.runner, ...row };
  // step 2 : the lease
  try {
    if (!(await renewLease(entry))) {
      logger.warning(`RTE '${name}': another node holds its socket now, closing this one`);
      entry.session.close(CLOSE.LEASE_LOST, "lease taken by another node");
      return;
    }
  } catch (e) {
    logger.debug(`RTE '${name}': lease renewal failed: ${e.message}`);
  }
  // step 3 : the heartbeat
  await rteHeartbeat(entry);
}

/**
 * The jobs this RTE should be running and is not, nor has items for : it restarted without its
 * spool (a new container). They end as abandoned, as a database-mode RTE abandons its own.
 *
 * Args:
 *   entry (object): the session's entry.
 *   hello (object): its hello.
 *
 * Returns:
 *   Promise<void>
 */
async function abandonLost(entry, hello) {
  const known = new Set([...(hello.running || []), ...(hello.spooled || [])].map(Number));
  const name = entry.runner.name;
  // only the jobs of its own runner : never another runner's, whatever id the RTE said
  const rows = await mysql.do("SELECT id FROM AnsibleForms.`jobs` WHERE status='running' AND host=? AND runner=?", [entry.rteId, name]);
  for (const { id } of rows || []) {
    if (known.has(Number(id))) continue;
    if (await abandonJobs({ id, host: entry.rteId, runner: name })) logger.warning(`Job ${id}: RTE '${name}' came back without it: abandoned`);
    forgetJob(Number(id));
  }
}

// ─── outbound : an RTE dials this node ────────────────────────────────────────

/**
 * Who an RTE that calls in is (its socket, outbound, or its one registration call, either mode) :
 * its runner, signed in with its own token ; or a new runner, added with a join token of
 * Connections > Runners. A runner whose token changed (the RTE was installed again) is let in
 * with a join token too, and keeps the new token. The runner takes the mode the RTE runs in, and
 * an inbound one the address the app dials it on.
 *
 * Args:
 *   headers (object): the request's headers : Authorization (its RTE_TOKEN), X-AF-RTE-Name,
 *     X-AF-RTE-Id, X-AF-RTE-Join (a join token), X-AF-RTE-Url (its address).
 *   opts (object): { mode : outbound (default) or inbound, url : its address, over the header }.
 *
 * Returns:
 *   Promise<object>: { runner } when let in, { error, status } when not.
 */
export async function authenticate(headers, opts = {}) {
  const mode = opts.mode === "inbound" ? "inbound" : "outbound";
  const token = String(headers.authorization || "").replace(/^Bearer\s+/i, "");
  const name = String(headers["x-af-rte-name"] || "").trim();
  const join = String(headers["x-af-rte-join"] || "").trim();
  const url = String(opts.url || headers["x-af-rte-url"] || "").trim();
  if (token.length < 16) return { status: 401, error: "the RTE's token (RTE_TOKEN) is missing or shorter than 16 characters" };
  if (!name || !/^[A-Za-z0-9_.:@-]{1,250}$/.test(name)) return { status: 400, error: "the RTE's name (RTE_NAME) is missing or not a valid runner name" };
  if (mode === "inbound" && !/^https?:\/\//i.test(url)) return { status: 400, error: "an inbound RTE registers with its address (RTE_URL), which the app dials" };
  // what the runner becomes : its mode, and an inbound one's address
  const fields = mode === "inbound" ? { rte_mode: "inbound", uri: url } : { rte_mode: "outbound", ...(url ? { uri: url } : {}) };
  const runner = await Runner.findByName(name);
  if (runner && runner.type !== "rte") return { status: 409, error: `'${name}' is a ${runner.type} runner, not an RTE` };
  if (runner && safeEqual(token, runner.token)) {
    if (runner.rte_mode !== fields.rte_mode || (mode === "inbound" && runner.uri !== url)) {
      if (runner.managed) return { status: 409, error: `runner '${name}' is managed by the config seed: its mode and address are set there` };
      // an inbound one's address : its credential's when it names one
      if (mode === "inbound" && runner.credential) {
        await storeToken(name, token, url, runner.credential);
        await Runner.update({ rte_mode: "inbound", uri: "" }, runner.id, { fromRte: true });
      } else {
        await Runner.update(fields, runner.id, { fromRte: true });
      }
      logger.notice(`Runner '${name}' is ${mode} now${mode === "inbound" ? ` at ${url}` : ""}`);
    }
    return { runner: { ...runner, ...fields } };
  }
  if (!join) {
    if (runner) return { status: 401, error: `the token of RTE '${name}' is not the one stored for its runner: check its RTE_TOKEN` };
    return askToJoin({ name, token, mode, url, fields, headers, ip: opts.ip });
  }
  // a seeded runner first : refused before the join token is used, which would cost it a use
  if (runner?.managed) return { status: 409, error: `runner '${name}' is managed by the config seed: its token is set there` };
  const used = await RunnerJoinToken.use(join);
  if (!used) return { status: 401, error: "the join token (RTE_JOIN_TOKEN) is unknown, revoked, expired or used up" };
  // the token goes in a credential of type rte, as every runner signs in (Connections >
  // Credentials) : the runner names it, and an inbound one's address is the credential's
  const credential = await storeToken(name, token, mode === "inbound" ? url : "", runner?.credential);
  if (runner) {
    await Runner.update({ credential, token: null, rte_mode: fields.rte_mode, ...(mode === "inbound" ? { uri: "" } : {}) }, runner.id, { fromRte: true });
    logger.notice(`Runner '${name}' got a new token (credential '${credential}') through the join token '${used.name}'`);
  } else {
    await Runner.create({ name, type: "rte", uri: "", credential, rte_mode: fields.rte_mode, description: `Joined with the join token '${used.name}'` }, { fromRte: true });
    logger.notice(`Runner '${name}' (${mode}) added through the join token '${used.name}', signing in with the credential '${credential}'`);
  }
  return { runner: await Runner.findByName(name) };
}

// the requests to join, one after the other (askToJoin)
let joinQueue = Promise.resolve();

/**
 * An RTE nobody knows asks to join : it becomes a runner waiting for an admin's approval,
 * turned off, its token kept in a credential of its own, with what it said of itself (its host,
 * its address, its mode, its version, the fingerprint of its token) for the admin to recognise
 * it. Its socket is taken (outbound) but no job goes to it, and nobody dials it (inbound),
 * until it is approved. At most PENDING_MAX wait at once.
 *
 * Args:
 *   req (object): { name, token, mode, url, fields, headers, ip }.
 *
 * Returns:
 *   Promise<object>: { runner, pending: true }, or { status, error } when refused.
 */
function askToJoin(req) {
  // one at a time on this node : two RTEs asking at once cannot both pass the count of the ones
  // waiting (between the nodes the overshoot is one per node at most)
  const turn = joinQueue.then(() => addPending(req));
  joinQueue = turn.catch(() => {});
  return turn;
}

/**
 * Adds a runner waiting for approval, when fewer than PENDING_MAX wait (askToJoin, one at a
 * time).
 *
 * Args:
 *   req (object): { name, token, mode, url, fields, headers, ip }.
 *
 * Returns:
 *   Promise<object>: { runner, pending: true }, or { status, error } when refused.
 */
async function addPending({ name, token, mode, url, fields, headers, ip }) {
  // asked twice at once (the socket and the registration call) : the first one added it
  const already = await Runner.findByName(name);
  if (already) {
    if (already.type === "rte" && safeEqual(token, already.token)) return { runner: already, pending: !!Number(already.pending) };
    return { status: 401, error: `the token of RTE '${name}' is not the one stored for its runner: check its RTE_TOKEN` };
  }
  if ((await Runner.countPending()) >= PENDING_MAX) {
    return { status: 429, error: `${PENDING_MAX} RTEs already wait for approval under Connections > Runners: approve or reject them first` };
  }
  const info = {
    host: String(headers["x-af-rte-host"] || "").slice(0, 250) || null,
    id: String(headers["x-af-rte-id"] || "").slice(0, 250) || null,
    version: String(headers["x-af-rte-version"] || "").slice(0, 50) || null,
    // an IPv4 address as people write it, not as the IPv6 socket shows it (::ffff:10.0.0.5)
    ip: ip ? String(ip).replace(/^::ffff:/, "").slice(0, 100) : null,
    mode,
    url: mode === "inbound" ? url : null,
    fingerprint: fingerprint(token),
  };
  const credential = await storeToken(name, token, mode === "inbound" ? url : "", null);
  await Runner.create({
    name, type: "rte", uri: "", credential, rte_mode: fields.rte_mode, enabled: 0,
    pending: 1, pending_since: new Date(), pending_info: JSON.stringify(info),
    description: `Asked to join from ${info.host || info.ip || "an unknown host"}`,
  }, { fromRte: true });
  logger.notice(`RTE '${name}' (${mode}, fingerprint ${info.fingerprint}) asked to join from ${info.ip || "?"}: approve it under Connections > Runners`);
  publish("runners");
  return { runner: await Runner.findByName(name), pending: true };
}

/**
 * Keeps an RTE's token in a credential of type rte : the one its runner names already, else a
 * new one named after the runner (<runner>-rte, a number added when that name is taken).
 *
 * Args:
 *   runnerName (string): the runner.
 *   token (string): its RTE_TOKEN.
 *   url (string): the address the app dials it on (inbound), "" for none (outbound).
 *   current (string|null): the credential the runner names already.
 *
 * Returns:
 *   Promise<string>: the credential's name.
 *
 * Raises:
 *   Error: the runner's credential is managed by the config seed.
 */
async function storeToken(runnerName, token, url, current) {
  if (current) {
    const cred = await Credential.findByName(current).catch(() => null);
    if (cred && cred.credential_type === "rte") {
      if (cred.managed) throw new Error(`the credential '${current}' of runner '${runnerName}' is managed by the config seed`);
      await Credential.update({ password: token, url: url || null }, cred.id, { fromRte: true });
      return current;
    }
  }
  let name = `${runnerName}-rte`.slice(0, 240);
  for (let i = 2; await Credential.findByName(name).catch(() => null); i++) name = `${runnerName}-rte-${i}`.slice(0, 250);
  await Credential.create({
    name,
    credential_type: "rte",
    password: token,
    url: url || null,
    description: `The token of the RTE '${runnerName}' (its RTE_TOKEN), stored when it joined`,
  }, { fromRte: true });
  return name;
}

/**
 * An RTE's one registration call (POST /api/v2/rte/register) : before an inbound RTE listens, so
 * the app knows its address and dials it ; an outbound one registers when it dials anyway. No
 * user signs in : the RTE's token, or a join token, is the proof.
 *
 * Args:
 *   req (Request): { headers as authenticate(), body: { mode, url } }.
 *   res (Response): 200 { runner, mode } ; else the status and why.
 *
 * Returns:
 *   Promise<void>
 */
export async function registerHandler(req, res) {
  try {
    const out = await authenticate(req.headers, { mode: req.body?.mode, url: req.body?.url, ip: req.ip });
    if (!out.runner) {
      logger.warning(`Refused an RTE registration from ${req.ip}: ${out.error}`);
      return res.status(out.status).json({ error: out.error });
    }
    publish("runners");
    return res.json({ runner: out.runner.name, mode: out.runner.rte_mode, uri: out.runner.uri || null, pending: !!Number(out.runner.pending) });
  } catch (e) {
    logger.error(`RTE registration: ${e.message}`);
    return res.status(500).json({ error: e.message });
  }
}

// the upgrades to the RTE socket, per address : address -> { since, count } (upgradeAllowed)
const upgrades = new Map();
const UPGRADE_WINDOW_MS = 60 * 1000;

/**
 * Whether an address may try the RTE socket now : the ceiling of the registration call
 * (AUTH_RATE_LIMIT a minute, lib/authRateLimit.js, 0 turns it off), counted per address on this
 * node, so a flood of upgrades stops before any token or database is looked at.
 *
 * Args:
 *   ip (string): the caller's address (the socket's, as express sees req.ip).
 *   now (number): the time, in ms (the tests set it).
 *
 * Returns:
 *   boolean: false when the address went over the ceiling this minute.
 */
export function upgradeAllowed(ip, now = Date.now()) {
  const limit = appConfig.authRateLimit;
  if (!limit) return true;
  // step 1 : the windows that ended are forgotten, now and then (a scan of the map, not per call)
  if (upgrades.size > 1000) for (const [k, w] of upgrades) if (now - w.since >= UPGRADE_WINDOW_MS) upgrades.delete(k);
  // step 2 : this address's window : a new one when its last ended
  const key = String(ip || "?");
  let w = upgrades.get(key);
  if (!w || now - w.since >= UPGRADE_WINDOW_MS) {
    w = { since: now, count: 0 };
    upgrades.set(key, w);
  }
  w.count++;
  return w.count <= limit;
}

/**
 * The upgrade of an HTTP request to the RTE socket (outbound RTEs) : authenticated, then taken.
 * Other upgrades are left for whoever else listens. Too many from one address : 429.
 *
 * Args:
 *   req (IncomingMessage): the request.
 *   socket (Socket): its socket.
 *   head (Buffer): the first bytes.
 *
 * Returns:
 *   boolean: true when the request was the RTE socket's (handled here).
 */
export function handleUpgrade(req, socket, head) {
  const pathname = new URL(req.url, "http://x").pathname;
  if (pathname !== `${appConfig.baseUrl || ""}${APP_SOCKET_PATH}`) return false;
  // the address of the socket, not a header a caller writes itself : as the registration call's
  // limiter counts (express without trust proxy)
  if (!upgradeAllowed(req.socket.remoteAddress)) {
    const body = JSON.stringify({ error: "Too many requests, slow down" });
    socket.write(`HTTP/1.1 429 Too Many Requests\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`);
    socket.destroy();
    return true;
  }
  authenticate(req.headers, { ip: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress })
    .then((res) => {
      if (!res.runner) {
        logger.warning(`Refused an RTE socket from ${req.socket.remoteAddress}: ${res.error}`);
        const body = JSON.stringify({ error: res.error });
        socket.write(`HTTP/1.1 ${res.status} Refused\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`);
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => adopt(new Session(ws, `rte '${res.runner.name}'`), res.runner, "outbound"));
    })
    .catch((e) => {
      logger.error(`RTE socket: ${e.message}`);
      socket.write("HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n");
      socket.destroy();
    });
  return true;
}

// ─── inbound : this node dials the RTE ────────────────────────────────────────

const dialing = new Set();

/**
 * Looks at the inbound runners : takes the lease of each one free or expired, and dials the
 * ones it holds without a socket.
 *
 * Returns:
 *   Promise<void>
 */
async function dialInbound() {
  // not one waiting for approval : nobody dials an RTE an admin has not approved
  const rows = await mysql.do("SELECT name FROM AnsibleForms.`runners` WHERE type='rte' AND rte_mode='inbound' AND COALESCE(pending, 0) = 0", [], true);
  for (const { name } of rows || []) {
    if (sessions.has(name) || dialing.has(name)) continue;
    if (!(await tryLease(name).catch(() => false))) continue;
    const runner = await Runner.findByName(name);
    if (!runner?.uri) continue;
    dialing.add(name);
    let url;
    try {
      url = inboundUrl(runner.uri);
    } catch (e) {
      dialing.delete(name);
      logger.error(`Runner '${name}': its address ${runner.uri} is not one: ${e.message}`);
      continue;
    }
    const ws = new WebSocket(url, {
      headers: { Authorization: `Bearer ${runner.token || ""}`, "X-AF-Node": nodeId },
      maxPayload: MAX_PAYLOAD,
      handshakeTimeout: 10000,
      agent: url.startsWith("wss:") ? getHttpsAgent(runner) : undefined,
    });
    ws.on("open", () => {
      dialing.delete(name);
      adopt(new Session(ws, `rte '${name}'`), runner, "inbound");
    });
    ws.on("unexpected-response", (req, res) => {
      logger.warning(`Runner '${name}': the RTE at ${url} refused the socket (${res.statusCode}): check its RTE_TOKEN`);
      // listening to this event takes the abort of the handshake over from ws : without it no
      // close comes, and the runner stays in `dialing` for good (never dialed again)
      res.resume();
      ws.terminate();
    });
    ws.on("error", (e) => {
      dialing.delete(name);
      logger.debug(`Runner '${name}': dialing ${url}: ${e.message}`);
    });
    ws.on("close", () => dialing.delete(name));
  }
}

// ─── jobs to the RTEs ─────────────────────────────────────────────────────────

/**
 * An RTE said claimed or refused (or the socket closed meanwhile).
 *
 * Args:
 *   jobId (number): the job.
 *   result (object): { claimed, error, busy, lost }.
 *   entry (object): the session that answers, when one does : only the session the job was
 *     sent on settles its claim, never another RTE's.
 */
function settleClaim(jobId, result, entry = null) {
  const c = claims.get(Number(jobId));
  if (!c || (entry && c.entry !== entry)) return;
  clearTimeout(c.timer);
  claims.delete(Number(jobId));
  c.resolve(result);
}

/**
 * What a job's run message carries : everything a database-mode RTE read itself.
 *
 * Args:
 *   jobId (number): the job.
 *   entry (object): the session's entry.
 *
 * Returns:
 *   Promise<object>: the message.
 */
async function runMessage(jobId, entry) {
  const rows = await mysql.do("SELECT form, extravars, credentials FROM AnsibleForms.`jobs` WHERE id=?", [jobId]);
  if (!rows?.length) throw new Error(`job ${jobId} does not exist`);
  const extravars = safeParse(rows[0].extravars, {}, `job.extravars id=${jobId}`);
  const creds = safeParse(rows[0].credentials, {}, `job.credentials id=${jobId}`);
  const secrets = await resolveJobSecrets(extravars, creds);
  // the output is masked here, where it is stored : the credentials, the ansible and vault
  // passwords, and the form's password fields
  await registerMask(jobId, rows[0].form, extravars, secrets);
  const repos = await mysql.do("SELECT name, use_for_playbooks, use_for_inventories FROM AnsibleForms.`repositories` WHERE use_for_playbooks OR use_for_inventories ORDER BY name");
  const playbookRepo = (repos || []).find((r) => r.use_for_playbooks)?.name || null;
  const inventoryRepos = (repos || []).filter((r) => r.use_for_inventories).map((r) => r.name);
  const msg = {
    t: "run",
    jobId,
    contract: SOCKET_CONTRACT,
    sealed: sealJobSecrets(secrets, entry.runner.token, jobId),
    job: { form: rows[0].form, extravars, lastOrder: await Job.lastOrder(jobId) },
    paths: { playbookRepo, inventoryRepos },
  };
  // an RTE without files of its own : the folders, packed, by their hashes
  if (entry.hello?.files === "transfer") {
    msg.files = await jobFileHashes(inventoryRepos);
    // the only files this RTE may fetch : the ones of the jobs sent to it
    if (msg.files.playbooks?.hash) entry.hashes.add(msg.files.playbooks.hash);
    for (const inv of msg.files.inventories) entry.hashes.add(inv.hash);
  }
  return msg;
}

/**
 * The hashes of a job's files : the playbooks folder and the inventories, as this app sees them.
 *
 * Args:
 *   inventoryRepos (string[]): the repositories used for inventories.
 *
 * Returns:
 *   Promise<object>: { playbooks: { hash }, inventories: [{ repository, hash }] }.
 */
async function jobFileHashes(inventoryRepos) {
  const { default: Repository } = await import("../models/repository.model.js");
  const { default: Repo } = await import("../models/repo.model.js");
  const { default: ansibleConfig } = await import("../../config/ansible.config.js");
  const playbooksRoot = (await Repository.getAnsiblePath()) || ansibleConfig.path;
  const playbooks = await bundleOf(playbooksRoot);
  const inventories = [];
  const local = await bundleOf(appConfig.inventoryPath);
  if (local) inventories.push({ repository: null, hash: local.hash });
  for (const name of inventoryRepos) {
    const b = await bundleOf(Repo.folderOf(name));
    if (b) inventories.push({ repository: name, hash: b.hash });
  }
  return { playbooks: playbooks ? { hash: playbooks.hash } : null, inventories };
}

/**
 * Registers what a job's output must not show, in this process (once per job).
 *
 * Args:
 *   jobId (number): the job.
 *   form (string): its form.
 *   extravars (object): its extravars.
 *   secrets (object): its resolved secrets ({ credentials, ansible, vault }).
 *
 * Returns:
 *   Promise<void>
 */
async function registerMask(jobId, form, extravars, secrets) {
  const extra = [secrets?.ansible?.password, secrets?.vault?.password].filter((v) => typeof v === "string" && v);
  await Job.registerOutputSecrets(jobId, { form, extravars, credentials: secrets?.credentials || {}, extra });
  masked.add(jobId);
}

/**
 * The masks of a job whose items reach a node that did not send it (it took the socket over
 * after the sender went) : resolved again from the job, before anything is stored.
 *
 * Args:
 *   jobId (number): the job.
 *
 * Returns:
 *   Promise<void>
 */
async function ensureMask(jobId) {
  if (masked.has(jobId)) return;
  const rows = await mysql.do("SELECT form, extravars, credentials FROM AnsibleForms.`jobs` WHERE id=?", [jobId]);
  if (!rows?.length) return;
  const extravars = safeParse(rows[0].extravars, {}, `job.extravars id=${jobId}`);
  const secrets = await resolveJobSecrets(extravars, safeParse(rows[0].credentials, {}, `job.credentials id=${jobId}`)).catch(() => ({}));
  await registerMask(jobId, rows[0].form, extravars, secrets);
}

/**
 * Forgets what this node keeps of a job that ended here (failed, abandoned, ended) : its wait,
 * its cancel sent, its output masks.
 *
 * Args:
 *   jobId (number): the job.
 */
function forgetJob(jobId) {
  waiting.delete(jobId);
  cancelSent.delete(jobId);
  forgetJobSecrets(jobId);
  masked.delete(jobId);
}

/**
 * Fails a job that cannot run (refused, or waited too long), when it still runs
 * (runners/common.js), and forgets it.
 *
 * Args:
 *   jobId (number): the job.
 *   message (string): why.
 *
 * Returns:
 *   Promise<void>
 */
async function failJob(jobId, message) {
  await failRteJob(jobId, message);
  forgetJob(jobId);
}

/**
 * Hands one job to an RTE : claimed in the database first (jobs.host, so no second node sends
 * it), then sent. Busy : it waits and is sent again ; refused : it fails.
 *
 * Args:
 *   jobId (number): the job.
 *   entry (object): the session's entry.
 *
 * Returns:
 *   Promise<void>
 */
async function sendJob(jobId, entry) {
  // handed over already (kick and dispatch both found it) : one hand-over at a time
  if (sending.has(jobId)) return;
  sending.add(jobId);
  try {
    await handOver(jobId, entry);
  } finally {
    sending.delete(jobId);
  }
}

/**
 * One hand-over of a job to an RTE (sendJob, never twice at once for a job).
 *
 * Args:
 *   jobId (number): the job.
 *   entry (object): the session's entry.
 *
 * Returns:
 *   Promise<void>
 */
async function handOver(jobId, entry) {
  const name = entry.runner.name;
  const wait = waiting.get(jobId) || { firstWait: Date.now(), retryAt: 0, said: false };
  waiting.set(jobId, wait);
  if (Date.now() < wait.retryAt) return;
  const busy = async (why) => {
    wait.retryAt = Date.now() + RETRY_MS;
    if (queueMinutes() && Date.now() - wait.firstWait > queueMinutes() * 60000) {
      await failJob(jobId, `the RTE '${name}' stayed busy for ${queueMinutes()} minutes (RTE_QUEUE_MINUTES)`);
      return;
    }
    if (!wait.said) {
      wait.said = true;
      await sayWaitingForSlot(jobId, name, why);
    }
  };
  // a full RTE (its last health) : not sent, it waits
  const cap = entry.health?.capacity || entry.hello?.capacity;
  if (cap && cap.free === 0) return busy(`it runs ${cap.running} jobs already (RTE_MAX_JOBS)`);
  const claim = await mysql.do("UPDATE AnsibleForms.`jobs` SET host=? WHERE id=? AND status='running' AND host IS NULL", [entry.rteId, jobId]);
  if (!claim?.affectedRows) {
    // claimed elsewhere, or ended : its wait goes - its own, never one another hand-over set since
    if (waiting.get(jobId) === wait) waiting.delete(jobId);
    return;
  }
  let msg;
  try {
    msg = await runMessage(jobId, entry);
  } catch (e) {
    await failJob(jobId, `could not prepare the job for the RTE: ${e.message}`);
    return;
  }
  const answer = new Promise((resolve) => {
    const timer = setTimeout(() => settleClaim(jobId, { claimed: false, error: "no answer", lost: true }), CLAIM_TIMEOUT_MS);
    timer.unref?.();
    claims.set(jobId, { resolve, timer, runner: name, entry });
  });
  if (!entry.session.send(msg)) settleClaim(jobId, { claimed: false, error: "the socket is closed", lost: true });
  const res = await answer;
  if (res.claimed) {
    if (waiting.get(jobId) === wait) waiting.delete(jobId);
    logger.notice(`Job ${jobId}: RTE '${name}' took it`);
    return;
  }
  // not taken : the claim goes back, so it can be sent again (this node or the next holder)
  await mysql.do("UPDATE AnsibleForms.`jobs` SET host=NULL WHERE id=? AND host=? AND status='running'", [jobId, entry.rteId]);
  if (res.busy || res.lost) return busy(res.error || "busy");
  await failJob(jobId, `the RTE '${name}' did not take the job: ${res.error}`);
}

/**
 * The jobs waiting for the sockets this node holds, sent ; the aborts asked, passed on ; the
 * jobs aborted while they waited, ended.
 *
 * Returns:
 *   Promise<void>
 */
async function dispatch() {
  if (!sessions.size) return;
  // not a runner waiting for approval : it gets no job, and no cancel of another RTE's job
  const ready = [...sessions.values()].filter(canRun);
  if (!ready.length) return;
  const byName = new Map(ready.map((e) => [e.runner.name, e]));
  const rows = await mysql.do(
    "SELECT id, runner, abort_requested FROM AnsibleForms.`jobs` WHERE status='running' AND job_type='ansible' AND host IS NULL AND runner IN (?)",
    [[...byName.keys()]],
    true
  );
  for (const r of rows || []) {
    if (r.abort_requested) {
      await abortWhileWaiting(r.id);
      waiting.delete(r.id);
      continue;
    }
    if (claims.has(r.id)) continue;
    sendJob(r.id, byName.get(r.runner)).catch((e) => logger.error(`Job ${r.id}: handing it to RTE '${r.runner}' failed: ${e.message}`));
  }
  const ids = ready.map((e) => e.rteId).filter(Boolean);
  if (!ids.length) return;
  // a job's cancel goes to the RTE that holds it, of its own runner
  const aborts = await mysql.do(
    "SELECT id, host, runner FROM AnsibleForms.`jobs` WHERE status='running' AND abort_requested=1 AND host IN (?) AND runner IN (?)",
    [ids, [...byName.keys()]],
    true
  );
  for (const a of aborts || []) {
    if (cancelSent.has(a.id)) continue;
    const entry = ready.find((e) => e.rteId === a.host && e.runner.name === a.runner);
    if (entry?.session.send({ t: "cancel", jobId: a.id })) cancelSent.add(a.id);
  }
}

/**
 * A job launched on this node for a socket-mode runner : sent at once when this node holds the
 * runner's socket (else the holder sends it within DISPATCH_MS).
 *
 * Args:
 *   jobId (number): the job.
 *   runner (object): its runner.
 */
export function kick(jobId, runner) {
  const entry = sessions.get(runner.name);
  if (canRun(entry) && !claims.has(jobId)) {
    sendJob(jobId, entry).catch((e) => logger.error(`Job ${jobId}: handing it to RTE '${runner.name}' failed: ${e.message}`));
  }
}

/**
 * Asks a socket-mode RTE to stop a job now, when this node holds its socket (else the abort
 * flag reaches the holder within DISPATCH_MS).
 *
 * Args:
 *   jobId (number): the job.
 *   runner (object): its runner.
 *
 * Returns:
 *   boolean: true when the cancel was sent from here.
 */
export function cancel(jobId, runner) {
  const entry = sessions.get(runner.name);
  if (!entry?.session.send({ t: "cancel", jobId })) return false;
  cancelSent.add(jobId);
  return true;
}

// ─── what the RTEs send ───────────────────────────────────────────────────────

/**
 * Whether an RTE may write a job's items : a job of its own runner, held by it or by nobody (not
 * claimed yet, or ended : an item resent after a reconnect), or by an RTE of the same runner
 * (it came back under another id, a new container with its spool). Asked once per job and
 * socket : the answer is kept on the session.
 *
 * Args:
 *   entry (object): the session's entry.
 *   jobId (number): the job.
 *
 * Returns:
 *   Promise<boolean>
 */
function itemAllowed(entry, jobId) {
  if (!entry.allowed.has(jobId)) {
    const check = (async () => {
      const rows = await mysql.do(
        "SELECT j.runner, j.host, n.role, n.info FROM AnsibleForms.`jobs` j LEFT JOIN AnsibleForms.`nodes` n ON n.id = j.host WHERE j.id=?",
        [jobId],
        true
      );
      const row = rows?.[0];
      if (!row || row.runner !== entry.runner.name) return false;
      if (!row.host || row.host === entry.rteId) return true;
      return row.role === "rte" && safeParse(row.info, {}, `nodes.info ${row.host}`)?.runner === entry.runner.name;
    })();
    // a failed query is asked again with the next item, never kept as a refusal
    check.catch(() => entry.allowed.delete(jobId));
    entry.allowed.set(jobId, check);
  }
  return entry.allowed.get(jobId);
}

/**
 * Writes one item of a job (in order with the job's others) and acks it. A runner waiting for
 * approval writes nothing, and an RTE writes the jobs of its own runner only (itemAllowed) : what
 * it is refused is dropped, never acked.
 *
 * Args:
 *   entry (object): the session's entry.
 *   msg (object): { jobId, item: { seq, kind, ... } }.
 */
function onItem(entry, msg) {
  const jobId = Number(msg.jobId);
  const item = msg.item || {};
  if (!Number.isInteger(jobId) || jobId <= 0) return;
  if (isPending(entry)) {
    logger.warning(`Job ${jobId}: RTE '${entry.runner.name}' waits for approval and sent an item of it: dropped`);
    return;
  }
  const prev = writing.get(jobId) || Promise.resolve();
  const next = prev
    .then(async () => {
      if (!(await itemAllowed(entry, jobId))) {
        // once per job and socket in the log : a misbehaving RTE does not flood it
        if (!entry.refused.has(jobId)) {
          entry.refused.add(jobId);
          logger.warning(`Job ${jobId}: RTE '${entry.runner.name}' (${entry.rteId}) sent an item of a job that is not its own: dropped`);
        }
        return;
      }
      await ensureMask(jobId);
      await storeItem(entry, jobId, item);
      entry.session.send({ t: "ack", jobId, seq: item.seq });
    })
    .catch((e) => logger.error(`Job ${jobId}: storing what RTE '${entry.runner.name}' sent failed (sent again after a reconnect): ${e.message}`))
    .finally(() => {
      if (writing.get(jobId) === next) writing.delete(jobId);
    });
  writing.set(jobId, next);
}

/**
 * Stores one item : each kind as a database-mode RTE wrote it itself, every one of them safe to
 * store twice (an item resent after a reconnect).
 *
 * Args:
 *   entry (object): the session's entry.
 *   jobId (number): the job.
 *   item (object): { kind, ... }.
 *
 * Returns:
 *   Promise<void>
 */
async function storeItem(entry, jobId, item) {
  switch (item.kind) {
    case "output":
      await Job.createOutputOnce({ ...item.record, job_id: jobId });
      break;
    // events, the log and the process's start : as a database-mode RTE writes them (rte/jobio-db.js),
    // masked there ; the host is the RTE this socket says it is, never what the item says
    case "events":
      await dbJobIO.writeEvents(jobId, item.events);
      break;
    case "log":
      await dbJobIO.setJobLog(jobId, item.content || "");
      break;
    case "started":
      await dbJobIO.started(jobId, item.pid || null, entry.rteId);
      break;
    case "exited":
      await mysql.do("UPDATE AnsibleForms.`jobs` SET pid=NULL WHERE id=?", [jobId]);
      break;
    case "end":
      // the end, its last line and its notifications : sent from here, never from the RTE
      await Job.endJobStatus(jobId, item.order, item.stream, item.status, item.message, item.artifacts || {});
      if (item.status === "aborted") await Job.resetAbortRequested(jobId).catch(() => {});
      await mysql.do("UPDATE AnsibleForms.`jobs` SET host=NULL, pid=NULL WHERE id=?", [jobId]);
      forgetJob(jobId);
      break;
    case "abandon":
      if (await abandonJobs({ id: jobId })) {
        await Job.printJobOutput(`[ERROR]: ${item.message || "the RTE lost the job"}`, "stderr", jobId, (await Job.lastOrder(jobId)) + 1);
        publish("jobs");
      }
      forgetJob(jobId);
      break;
    default:
      logger.debug(`Job ${jobId}: an item of an unknown kind '${item.kind}' (a newer RTE) was skipped`);
  }
}

/**
 * An RTE asks for the files of a job (fetch) : sent when they are the files of a job sent to
 * it on this socket, never to a runner waiting for approval.
 *
 * Args:
 *   entry (object): the session's entry.
 *   msg (object): { hash }.
 */
function onFetch(entry, msg) {
  const hash = String(msg.hash || "");
  if (isPending(entry) || !entry.hashes.has(hash)) {
    logger.warning(`RTE '${entry.runner.name}' asked for files that were not sent to it (${hash.slice(0, 12)}): refused`);
    entry.session.send({ t: "file", hash, error: "these files were not sent to this RTE" });
    return;
  }
  sendFiles(entry, hash).catch((e) => logger.error(`RTE '${entry.runner.name}': sending files: ${e.message}`));
}

/**
 * Sends a bundle an RTE asked for, in chunks.
 *
 * Args:
 *   entry (object): the session's entry.
 *   hash (string): the bundle's hash.
 *
 * Returns:
 *   Promise<void>
 */
async function sendFiles(entry, hash) {
  const b = bundleByHash(hash);
  if (!b) {
    entry.session.send({ t: "file", hash, error: "this app node does not have these files (they changed since): the job is sent again" });
    return;
  }
  logger.info(`RTE '${entry.runner.name}': sending the job files ${hash.slice(0, 12)} (${Math.round(b.size / 1024)} KB)`);
  await readChunks(b.file, CHUNK_BYTES, async (buf, last) => {
    entry.session.send({ t: "file", hash, data: buf.toString("base64"), last, sha256: last ? b.sha256 : undefined });
    // a slow link : the socket's buffer drains before the next chunk
    while (entry.session.ws.bufferedAmount > 4 * CHUNK_BYTES && entry.session.open) await new Promise((r) => setTimeout(r, 50));
  });
}

// ─── start and stop ───────────────────────────────────────────────────────────

/**
 * Starts the app's side of the RTE sockets on an app node : takes the upgrades of the HTTP
 * server, dials the inbound RTEs whose lease it gets, and sends the jobs waiting.
 *
 * Args:
 *   httpServer (Server): the app's HTTP(S) server.
 *
 * Returns:
 *   { stop: function }: closes every socket (the process stops).
 */
export function startRteHub(httpServer) {
  if (started) return { stop: () => {} };
  started = true;
  wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });
  httpServer.on("upgrade", (req, socket, head) => {
    if (!handleUpgrade(req, socket, head)) socket.destroy();
  });
  const dispatchTimer = setInterval(() => dispatch().catch((e) => logger.debug(`RTE dispatch: ${e.message}`)), DISPATCH_MS);
  dispatchTimer.unref?.();
  const dialTimer = setInterval(() => dialInbound().catch((e) => logger.debug(`RTE inbound dial: ${e.message}`)), DIAL_MS);
  dialTimer.unref?.();
  setTimeout(() => dialInbound().catch(() => {}), 2000).unref?.();
  logger.notice(`Taking RTE sockets on ${appConfig.baseUrl || ""}${APP_SOCKET_PATH}`);
  return {
    stop() {
      clearInterval(dispatchTimer);
      clearInterval(dialTimer);
      for (const e of sessions.values()) e.session.close(CLOSE.GOING_AWAY, "the app node stops");
    },
  };
}

/**
 * Whether a runner talks over a socket.
 *
 * Args:
 *   runner (object): the runner.
 *
 * Returns:
 *   boolean
 */
export function isSocketRunner(runner) {
  return runner?.type === "rte" && SOCKET_MODES.includes(runner.rte_mode);
}

/**
 * Whether this node holds a runner's socket, open and welcomed.
 *
 * Args:
 *   name (string): the runner.
 *
 * Returns:
 *   boolean
 */
export function holdsSocket(name) {
  const e = sessions.get(name);
  return !!(e?.hello && e.session.open);
}

// for the tests
/**
 * Closes a runner's socket on this node (a runner rejected or deleted) ; another node holding it
 * closes it once the runner is gone from the database (its dispatch finds no runner).
 *
 * Args:
 *   name (string): the runner.
 *   reason (string): said to the RTE.
 */
export function dropSocket(name, reason) {
  const entry = sessions.get(name);
  if (entry) entry.session.close(CLOSE.UNAUTHORIZED, reason);
}

export { sessions, waiting, cancelSent, dialing, dispatch, dialInbound, storeItem, sendJob, onItem, onFetch, adopt, renewTick, abandonLost, NODE_DEAD_SECONDS };

export default { startRteHub, handleUpgrade, authenticate, registerHandler, kick, cancel, socketState, isSocketRunner, holdsSocket };
