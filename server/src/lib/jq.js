// ===========================================================================
// JQ RUNNER
// ===========================================================================
// One place that runs jq for the expression functions (functions/default.js) and the
// database queries (models/query.model.js).
//
// node-jq's own runner spawns the jq binary with no time limit and buffers its whole
// output : a runaway filter (`[range(1e12)]`, a recursive `def` that never ends) kept
// a jq process spinning and the request waiting forever, and a filter producing
// gigabytes of output grew the server's memory until it died. This runner keeps
// node-jq's binary and its command line (the same flags, the same result parsing) but
// kills jq after JQ_TIMEOUT_SECONDS and when its output passes JQ_MAX_OUTPUT_BYTES.
//
// It also owns the jq definitions (jq.definitions and jq.custom.definitions, the
// fn2KB / fnRound helpers and the admin's own defs) : they are prefixed to every
// filter, joined with NEWLINES. They used to be joined by REMOVING the newlines,
// which turned one '# comment' line in the custom definitions into a comment that ran
// to the end of the filter and silently broke every jq expression of the app.
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import appConfig from "../../config/app.config.js";
import logger from "./logger.js";

const require = createRequire(import.meta.url);
// node-jq's command builder : the jq binary path (JQ_PATH or the bundled one) and the
// flags for the options, exactly as jq.run would use them
const { commandFactory } = require("node-jq/lib/command.js");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const functionsDir = path.join(__dirname, "../functions");

// the biggest jq output accepted, in bytes ; far above any form field or query result,
// low enough that a runaway filter cannot exhaust the server's memory
export const JQ_MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

/**
 * Reads one definitions file, an empty string when it is missing.
 *
 * Args:
 *   file (string): The file name inside src/functions.
 *
 * Returns:
 *   string: The file content.
 */
function readDefinitions(file) {
  try {
    return fs.readFileSync(path.join(functionsDir, file), "utf8");
  } catch (e) {
    if (e.code !== "ENOENT") logger.warning(`Could not read jq definitions '${file}': ${e.message}`);
    return "";
  }
}

// Joined with newlines (never by removing them) and ending in a newline, so a '#'
// comment in a definitions file ends at its own line and never swallows the filter
// that follows.
/**
 * Joins jq definition texts into one prefix for a filter.
 *
 * Args:
 *   parts (...string): The definition texts.
 *
 * Returns:
 *   string: The texts joined with newlines, ending in a newline.
 */
export function joinJqDefinitions(...parts) {
  return parts.join("\n") + "\n";
}
export const jqDefinitions = joinJqDefinitions(readDefinitions("jq.definitions"), readDefinitions("jq.custom.definitions"));
logger.debug("jq definitions loaded: " + jqDefinitions);

/**
 * The jq time limit, in milliseconds, from JQ_TIMEOUT_SECONDS (read on each call).
 *
 * Returns:
 *   number: The limit ; 30 seconds when the setting is missing or not above 0.
 */
function jqTimeoutMs() {
  const s = Number(appConfig.jqTimeoutSeconds);
  return (s > 0 ? s : 30) * 1000;
}

/**
 * Runs a jq filter on a JSON value, with the app's jq definitions prefixed.
 *
 * Behaves as node-jq's `jq.run(filter, input, { input: "json", output: "json" })` :
 * the output is parsed as JSON, an empty output gives undefined, and an output that
 * does not parse (several results) is returned as the raw text.
 *
 * Args:
 *   filter (string): The jq filter.
 *   input (any): The JSON value fed to jq.
 *   options (object): Optional.
 *     definitions (boolean): Prefix the jq definitions (default true).
 *     timeoutMs (number): The time limit (default JQ_TIMEOUT_SECONDS).
 *     maxOutputBytes (number): The output limit (default JQ_MAX_OUTPUT_BYTES).
 *
 * Returns:
 *   Promise<any>: What the filter produced.
 *
 * Raises:
 *   Error: jq failed (its stderr is the message), ran out of time, or produced too
 *     much output.
 */
export function runJq(filter, input, options = {}) {
  const { definitions = true, timeoutMs = jqTimeoutMs(), maxOutputBytes = JQ_MAX_OUTPUT_BYTES } = options;
  // step 1 : the command line, built by node-jq so the flags stay identical
  const { command, args, stdin } = commandFactory(
    (definitions ? jqDefinitions : "") + filter,
    input,
    { input: "json", output: "json" }
  );
  return new Promise((resolve, reject) => {
    // step 2 : spawn with an empty environment, as node-jq does
    const child = spawn(command, args, { env: {} });
    let stdout = "";
    let stderr = "";
    let outBytes = 0;
    let settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve(value);
    };
    // step 3 : the time limit
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error(`jq timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);
    // step 4 : collect the output, within the size limit
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (data) => {
      outBytes += Buffer.byteLength(data);
      if (outBytes > maxOutputBytes) {
        child.kill("SIGKILL");
        finish(new Error(`jq output exceeds ${maxOutputBytes} bytes`));
        return;
      }
      stdout += data;
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (data) => {
      // stderr only carries jq's error message ; keep a bounded part
      if (stderr.length < 65536) stderr += data;
    });
    child.on("error", (e) => finish(e));
    // step 5 : parse as node-jq does
    child.on("close", (code) => {
      if (code !== 0) return finish(new Error(stderr.replace(/\n$/, "")));
      const out = stdout.replace(/\r?\n$/, "");
      if (out === "") return finish(null, undefined);
      try {
        finish(null, JSON.parse(out));
      } catch {
        finish(null, out);
      }
    });
    // step 6 : feed the input. A jq that exits early (a syntax error) closes its stdin
    // before reading it : that EPIPE is not the error, the 'close' handler reports
    // jq's own message
    child.stdin.on("error", (e) => {
      if (e.code !== "EPIPE") finish(e);
    });
    if (stdin) child.stdin.write(stdin);
    child.stdin.end();
  });
}
