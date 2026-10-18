/******************************************************************/
/*                                                                */
/*  The settings of a socket-mode RTE an admin sets on its        */
/*  runner (Connections > Runners > the runner > RTE) : how many  */
/*  playbooks it runs at once, the size of its job files cache,   */
/*  where it gets a job's files and how long a stop waits. The    */
/*  app sends them over the socket (a settings message) once it   */
/*  welcomes the RTE and whenever they change. They win over the  */
/*  same variables set on the RTE, which are its fallback when a  */
/*  field of the runner page is empty.                            */
/*                                                                */
/*  Shared by the app (runners/rteHub.js, models/runner.model.js) */
/*  and the RTE (rte/socket/rte-socket.js).                       */
/*                                                                */
/******************************************************************/

/**
 * The settings : their key in the messages, their column on the runner, the variable that sets
 * them on the RTE, and their default.
 *   - maxJobs : the playbooks it runs at once, 0 no limit
 *   - cacheMb : the size of its job files cache, in MB ; 0 keeps none
 *   - files : transfer (the app sends the job's files) or local (its own folders)
 *   - drainSeconds : how long a stop waits for the running playbooks
 */
export const RTE_SETTINGS = [
  { key: "maxJobs", column: "rte_max_jobs", env: "RTE_MAX_JOBS", type: "int", min: 0, max: 1000, def: 10 },
  { key: "cacheMb", column: "rte_cache_mb", env: "RTE_CACHE_MB", type: "int", min: 0, max: 1048576, def: 1024 },
  { key: "files", column: "rte_files", env: "RTE_FILES", type: "enum", values: ["transfer", "local"], def: "transfer" },
  { key: "drainSeconds", column: "rte_drain_seconds", env: "RTE_DRAIN_SECONDS", type: "int", min: 0, max: 3600, def: 25 },
];

/**
 * A setting's value read, or undefined when it is empty or not valid.
 *
 * Args:
 *   setting (object): one of RTE_SETTINGS.
 *   raw (any): the value - from a message, a column or a variable.
 *
 * Returns:
 *   number|string|undefined
 */
export function parseSetting(setting, raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") return undefined;
  if (setting.type === "enum") {
    const v = String(raw).trim().toLowerCase();
    return setting.values.includes(v) ? v : undefined;
  }
  const n = Number(String(raw).trim());
  if (!Number.isInteger(n) || n < setting.min || n > setting.max) return undefined;
  return n;
}

/**
 * The settings a runner sets : its columns that hold a value, by key.
 *
 * Args:
 *   runner (object): the runner, as stored.
 *
 * Returns:
 *   object: { maxJobs?, cacheMb?, files?, drainSeconds? }.
 */
export function settingsOfRunner(runner) {
  const out = {};
  for (const s of RTE_SETTINGS) {
    const v = parseSetting(s, runner?.[s.column]);
    if (v !== undefined) out[s.key] = v;
  }
  return out;
}

/**
 * The settings a set of variables sets (the RTE's environment) : its own values, used where the
 * runner page leaves a field empty.
 *
 * Args:
 *   env (object): the variables (process.env).
 *
 * Returns:
 *   object: { maxJobs?, cacheMb?, files?, drainSeconds? }.
 */
export function settingsOfEnv(env = process.env) {
  const out = {};
  for (const s of RTE_SETTINGS) {
    const v = parseSetting(s, env[s.env]);
    if (v !== undefined) out[s.key] = v;
  }
  return out;
}

/**
 * The settings in effect : the runner's, else the variable on the RTE, else the default.
 *
 * Args:
 *   fromEnv (object): settingsOfEnv.
 *   fromRunner (object): what the app sent (settingsOfRunner).
 *
 * Returns:
 *   object: { maxJobs, cacheMb, files, drainSeconds }.
 */
export function effectiveSettings(fromEnv = {}, fromRunner = {}) {
  const out = {};
  for (const s of RTE_SETTINGS) out[s.key] = fromRunner[s.key] ?? fromEnv[s.key] ?? s.def;
  return out;
}

/**
 * A runner's columns checked as the api or the seed sends them : empty is null (the default), a
 * value out of range refused.
 *
 * Args:
 *   data (object): the runner's fields ; changed in place.
 *
 * Returns:
 *   string|null: why a value is refused, null when all are fine.
 */
export function normalizeRunnerSettings(data) {
  for (const s of RTE_SETTINGS) {
    if (data[s.column] === undefined) continue;
    const raw = data[s.column];
    if (raw === null || String(raw).trim() === "") {
      data[s.column] = null;
      continue;
    }
    const v = parseSetting(s, raw);
    if (v === undefined) {
      return s.type === "enum"
        ? `${s.column} must be one of ${s.values.join(", ")}, or empty`
        : `${s.column} must be a whole number from ${s.min} to ${s.max}, or empty`;
    }
    data[s.column] = v;
  }
  return null;
}

export default { RTE_SETTINGS, parseSetting, settingsOfRunner, settingsOfEnv, effectiveSettings, normalizeRunnerSettings };
