/******************************************************************/
/*                                                                */
/*  How long a job ran, as the jobs page and a user's or a        */
/*  runner's Jobs tab show it : 6s, 2m 05s, 1h 02m 05s.           */
/*                                                                */
/******************************************************************/

/**
 * How long a job ran, from its start to its end ; none while it has no end (waiting), a running
 * job up to now.
 *
 * Args:
 *   j (object): the job, { start, end, status }.
 *   now (Date): the time a running job is counted to (the page's clock).
 *
 * Returns:
 *   number|null: the seconds, or null.
 */
export function durationSeconds(j, now = new Date()) {
  if (!j.start) return null;
  // a job still running : to now, counting up with the page's clock
  if (!j.end && j.status !== 'running') return null;
  const end = j.end ? new Date(j.end) : now;
  const s = Math.round((end - new Date(j.start)) / 1000);
  return Number.isFinite(s) && s >= 0 ? s : null;
}

/**
 * A duration in words : 6s, 2m 05s, 1h 02m 05s ; an en dash for none.
 *
 * Args:
 *   seconds (number|null): the duration.
 *
 * Returns:
 *   string: the duration as the tables show it.
 */
export function formatDuration(seconds) {
  if (seconds == null) return '–';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const sec = seconds % 60;
  const two = (n) => String(n).padStart(2, '0');
  if (h) return `${h}h ${two(m)}m ${two(sec)}s`;
  if (m) return `${m}m ${two(sec)}s`;
  return `${sec}s`;
}
