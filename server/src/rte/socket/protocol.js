/******************************************************************/
/*                                                                */
/*  The RTE socket's protocol (contract 3) : one WebSocket per    */
/*  RTE, opened by the RTE (outbound) or by the app (inbound),    */
/*  the same messages both ways whoever dialed. JSON text frames, */
/*  { t: <type>, ... }.                                           */
/*                                                                */
/*  RTE -> app                                                    */
/*    hello    who it is : id, version, contract, ansible,        */
/*             capacity, the jobs it runs and the ones it still   */
/*             has items for                                      */
/*    health   every 20 s : the jobs it runs, its free slots      */
/*    claimed  it took a job ; refused : it did not (busy, ...)   */
/*    item     one numbered item of a job : output, events, log,  */
/*             started, exited, end, abandon ; kept on its disk   */
/*             until the app acks it, resent after a reconnect    */
/*    fetch    the files of a job it has not cached (a hash)      */
/*                                                                */
/*  app -> RTE                                                    */
/*    welcome  the hello accepted                                 */
/*    run      a job : what it used to read in the database, its  */
/*             secrets sealed for it, and its files' hashes       */
/*    cancel   stop a job                                         */
/*    ack      the items of a job stored, up to a number          */
/*    file     a chunk of the files asked for (base64)            */
/*                                                                */
/******************************************************************/

import { createHash } from "crypto";

// the contract of a socket-mode RTE ; a database-mode RTE speaks rte/contract.js's
export const SOCKET_CONTRACT = 3;

/**
 * A token's fingerprint : the first 8 hexadecimal digits of its SHA-256, as abcd-ef12. The RTE
 * logs it, the installer prints it and the Runners page shows it on a runner waiting for
 * approval, so an admin can tell it is the RTE they started without seeing the token.
 *
 * Args:
 *   token (string): the RTE's token.
 *
 * Returns:
 *   string: the fingerprint.
 */
export function fingerprint(token) {
  const hex = createHash("sha256").update(String(token || "")).digest("hex");
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

// where the app takes an RTE's socket (under BASE_URL), and where an inbound RTE takes the app's
export const APP_SOCKET_PATH = "/api/v2/rte/socket";
export const RTE_SOCKET_PATH = "/rte/v1/socket";

// the modes an RTE runs in (RTE_MODE)
export const MODES = ["outbound", "inbound", "database"];
// the modes that talk over this socket (a runner's rte_mode) ; database is the deprecated one
export const SOCKET_MODES = ["outbound", "inbound"];

// ─── the app's side : how long a job waits for an RTE ─────────────────────────
// (runners/rte.js and runners/rteHub.js both follow these ; kept here, where nothing is imported)

/**
 * How long a job waits for a free RTE (RTE_QUEUE_MINUTES, 60 by default, 0 : for ever), read
 * each time so a change applies without a restart.
 *
 * Returns:
 *   number: the minutes.
 */
export const queueMinutes = () => Math.max(0, parseInt(process.env.RTE_QUEUE_MINUTES ?? 60, 10) || 0);
// how often a job an RTE refused as busy is offered again
export const RETRY_MS = 10000;

// why a socket was closed : the reason goes with it, for the log on the other side
export const CLOSE = {
  // the token, the name or the join token was refused
  UNAUTHORIZED: 4401,
  // the RTE's id (its hello) is another node's, or the RTE of another runner uses it
  ID_TAKEN: 4403,
  // the other side speaks another contract
  CONTRACT: 4409,
  // a newer socket of the same RTE took over (it reconnected, to this node or another)
  REPLACED: 4000,
  // this node no longer holds the RTE's lease
  LEASE_LOST: 4001,
  // a message that could not be read
  PROTOCOL: 4002,
  // the process stops
  GOING_AWAY: 1001,
};

// the closes and the refusals of the handshake (HTTP status) that dialing again soon will not
// change : the runner was rejected or removed, the token or the join token refused, another
// contract. An outbound RTE waits REFUSED_REDIAL_MS before it dials again, not its usual 1 to
// 30 seconds : an admin has to act first. An id taken (ID_TAKEN) is not one of them : it frees
// itself once the node that had it stops answering
export const REFUSED_CLOSES = [CLOSE.UNAUTHORIZED, CLOSE.CONTRACT];
export const REFUSED_STATUSES = [401, 403, 409];
export const REFUSED_REDIAL_MS = 10 * 60 * 1000;

// a ping every 20 s keeps proxies from closing an idle socket ; nothing heard for 60 s : gone
export const PING_MS = 20000;
export const DEAD_MS = 60000;
// a job's items in flight, not acked yet, at most : beyond it the RTE waits for acks
export const WINDOW = 64;
// the size of a file chunk, before base64
export const CHUNK_BYTES = 256 * 1024;
// a message's size at most (a batch of output is 64 KB, a file chunk 256 KB, both in base64/JSON)
export const MAX_PAYLOAD = 8 * 1024 * 1024;

/**
 * Writes a message as a frame.
 *
 * Args:
 *   msg (object): the message, with its type in t.
 *
 * Returns:
 *   string: the frame's text.
 */
export function encode(msg) {
  return JSON.stringify(msg);
}

/**
 * Reads a frame.
 *
 * Args:
 *   data (string|Buffer): the frame.
 *
 * Returns:
 *   object|null: the message, null when it is not one (no type).
 */
export function decode(data) {
  try {
    const msg = JSON.parse(typeof data === "string" ? data : data.toString("utf8"));
    return msg && typeof msg === "object" && typeof msg.t === "string" ? msg : null;
  } catch {
    return null;
  }
}

/**
 * The address an outbound RTE dials : the app's address as people know it (APP_URL,
 * https://forms.example.com, with its BASE_URL if any) as a WebSocket address to its socket.
 *
 * Args:
 *   appUrl (string): the app's address (http or https ; ws and wss are taken as they are).
 *
 * Returns:
 *   string: the socket's address (wss://forms.example.com/api/v2/rte/socket).
 *
 * Raises:
 *   Error: not an address.
 */
export function socketUrl(appUrl) {
  const url = new URL(String(appUrl || "").trim());
  if (url.protocol === "https:") url.protocol = "wss:";
  else if (url.protocol === "http:") url.protocol = "ws:";
  else if (url.protocol !== "wss:" && url.protocol !== "ws:") throw new Error(`APP_URL must be an http or https address, not ${appUrl}`);
  const base = url.pathname.replace(/\/+$/, "");
  // the socket's own path given already : kept
  url.pathname = base.endsWith(APP_SOCKET_PATH) ? base : base + APP_SOCKET_PATH;
  url.search = "";
  url.hash = "";
  return url.toString();
}

/**
 * The address the app dials for an inbound RTE : its runner's address (RTE_URL, as today) as a
 * WebSocket address to its socket.
 *
 * Args:
 *   uri (string): the runner's address (http://rte:8000).
 *
 * Returns:
 *   string: the socket's address (ws://rte:8000/rte/v1/socket).
 */
export function inboundUrl(uri) {
  const url = new URL(String(uri || "").trim());
  url.protocol = url.protocol === "https:" ? "wss:" : url.protocol === "http:" ? "ws:" : url.protocol;
  url.pathname = url.pathname.replace(/\/+$/, "") + RTE_SOCKET_PATH;
  return url.toString();
}

export default { SOCKET_CONTRACT, APP_SOCKET_PATH, RTE_SOCKET_PATH, MODES, SOCKET_MODES, queueMinutes, RETRY_MS, CLOSE, PING_MS, DEAD_MS, WINDOW, CHUNK_BYTES, MAX_PAYLOAD, encode, decode, socketUrl, inboundUrl };
