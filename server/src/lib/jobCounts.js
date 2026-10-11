// The number of stored jobs and planned jobs a user keeps, for the users list : its stored jobs
// are those whose username is `<type>/<username>` (local, or an LDAP or SSO user's source), its
// schedules those that run as it (their owner, written by Run later) ; a schedule an admin made
// has no owner, nobody's.
import CrudModel from '../models/crud.model.js';
import logger from './logger.js';

/**
 * Reads every row of a table ; none when it cannot be read (the list still shows).
 *
 * Args:
 *   table (string): stored_jobs or schedule.
 *
 * Returns:
 *   Promise<object[]>: the rows.
 */
async function rowsOf(table) {
  try {
    const rows = await CrudModel.findAll(table);
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    logger.warning(`The ${table} rows not counted, they could not be read : ${err}`);
    return [];
  }
}

/**
 * The user a schedule runs as, written type/username.
 *
 * Args:
 *   schedule (object): a schedule row, its owner a JSON user or null.
 *
 * Returns:
 *   string|null: `local/jdoe`, or null for no owner (or one that cannot be read).
 */
function ownerOf(schedule) {
  if (!schedule.owner) return null;
  try {
    const owner = JSON.parse(schedule.owner);
    return owner?.username ? `${owner.type}/${owner.username}` : null;
  } catch {
    return null;
  }
}

/**
 * Adds stored_job_count and schedule_count to each user.
 *
 * Args:
 *   users (object[]): the users, each { username, source? } - source the type (local when
 *     none).
 *   storedJobs (object[]|undefined): the stored jobs, each { username } ; read when not given.
 *   schedules (object[]|undefined): the schedules, each { owner } ; read when not given.
 *
 * Returns:
 *   Promise<object[]>: the same users, each with stored_job_count and schedule_count.
 */
export async function withUserJobCounts(users, storedJobs, schedules) {
  const stored = storedJobs || (await rowsOf('stored_jobs'));
  const planned = schedules || (await rowsOf('schedule'));
  // how many per type/username, counted once for every user
  const tally = (keys) => keys.reduce((m, k) => (k ? m.set(k, (m.get(k) || 0) + 1) : m), new Map());
  const storedBy = tally(stored.map((j) => j.username));
  const plannedBy = tally(planned.map(ownerOf));
  return users.map((u) => ({
    ...u,
    stored_job_count: storedBy.get(`${u.source || 'local'}/${u.username}`) || 0,
    schedule_count: plannedBy.get(`${u.source || 'local'}/${u.username}`) || 0,
  }));
}
