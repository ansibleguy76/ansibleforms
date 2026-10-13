'use strict';
// The options every HTTP server of the app is created with : the web server (app-start.js),
// the RTE (rte/server.js) and the worker's health server (worker/server.js).
//
// MAX_HTTP_HEADER_SIZE : the largest request header the server accepts, in bytes. Node refuses a
// larger one with 431 before the request reaches the app, so nothing of it is in the log (#1036 :
// the access token of a user in many groups, in the Authorization header). Unset, Node's own
// limit applies : 16384, or what NODE_OPTIONS=--max-http-header-size says, which a deployment
// may already use. Read when the server is created : a change takes effect after a restart.
import logger from './logger.js';

// a header limit below this would refuse ordinary requests ; above this it is no limit at all
export const MIN_HEADER_SIZE = 1024;
export const MAX_HEADER_SIZE = 1024 * 1024;

/**
 * MAX_HTTP_HEADER_SIZE, read : a whole number of bytes from MIN_HEADER_SIZE to MAX_HEADER_SIZE.
 *
 * Args:
 *   value (string|undefined): the variable.
 *
 * Returns:
 *   number|undefined: the size ; undefined when unset, or not a number in range (logged), so
 *     Node's own limit applies.
 */
export function maxHeaderSize(value) {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  const text = String(value).trim();
  const n = Number(text);
  if (!/^\d+$/.test(text) || n < MIN_HEADER_SIZE || n > MAX_HEADER_SIZE) {
    logger.warning(`MAX_HTTP_HEADER_SIZE '${text}' is not a number of bytes from ${MIN_HEADER_SIZE} to ${MAX_HEADER_SIZE}, Node's own limit applies`);
    return undefined;
  }
  return n;
}

/**
 * The options for http.createServer / https.createServer.
 *
 * Args:
 *   env (object): the environment, the process's by default.
 *
 * Returns:
 *   object: { maxHeaderSize } when MAX_HTTP_HEADER_SIZE is set and valid ; else nothing, and
 *     Node's own limit applies.
 */
export function httpServerOptions(env = process.env) {
  const size = maxHeaderSize(env.MAX_HTTP_HEADER_SIZE);
  return size === undefined ? {} : { maxHeaderSize: size };
}
