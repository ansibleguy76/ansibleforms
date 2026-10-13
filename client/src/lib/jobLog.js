/******************************************************************/
/*                                                                */
/*  A job's log file, as its Logfile card shows it : the file a   */
/*  playbook writes (.joblogs/job_log_<id>.log, the RTE stores it */
/*  on the job), line by line, in the output's look. A line of a  */
/*  usual log - a timestamp, a level, a message - shows its       */
/*  timestamp quiet and its level in the output's colours ; ANSI  */
/*  colours the playbook wrote take the theme's colours, as the   */
/*  output's own.                                                 */
/*                                                                */
/******************************************************************/

// a log line's start : a date and time (2026-10-13 08:02:55, with a T, a fraction, a zone),
// optionally in brackets, then a level word and what separates it from the message
const LOG_LINE =
  /^(\[?\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?\]?)(\s*[-|:]?\s*)(\[?(?:CRITICAL|FATAL|ERROR|ERR|WARNING|WARN|NOTICE|INFO|DEBUG|TRACE)\]?)?/i;

// a level word, as the output colours it : an error red, a warning orange, a debug line grey
const LEVEL_OF = {
  critical: 'error',
  fatal: 'error',
  error: 'error',
  err: 'error',
  warning: 'warning',
  warn: 'warning',
  notice: 'info',
  info: 'info',
  debug: 'debug',
  trace: 'debug',
};
const LEVEL_CLASS = {
  error: 'has-text-danger',
  warning: 'has-text-warning',
  info: 'has-text-info',
  debug: 'has-text-muted',
};

// ANSI's colours as the output's classes : the theme's colours, readable in light and dark
const ANSI_CLASS = {
  30: 'has-text-muted',
  31: 'has-text-danger',
  32: 'has-text-success',
  33: 'has-text-warning',
  34: 'has-text-info',
  35: 'has-text-purple',
  36: 'has-text-info',
  90: 'has-text-muted',
  91: 'has-text-danger',
  92: 'has-text-success',
  93: 'has-text-warning',
  94: 'has-text-info',
  95: 'has-text-purple',
  96: 'has-text-info',
};

/**
 * Text as HTML : its special characters escaped.
 *
 * Args:
 *   text (string): the text.
 *
 * Returns:
 *   string: the escaped text.
 */
function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * A line's ANSI colours as spans of the output's classes, the colours still open at its start
 * carried in, each line well formed. A reset closes them all ; bold (1) is kept ; any other
 * sequence (a cursor move, a 256 colour) is dropped.
 *
 * Args:
 *   html (string): the line, escaped.
 *   open (string[]): the classes still open from the lines before it.
 *
 * Returns:
 *   object: { html (the line), open (the classes still open after it) }.
 */
function ansiLine(html, open) {
  const stack = [...open];
  let out = stack.map((c) => `<span class="${c}">`).join('');
  // eslint-disable-next-line no-control-regex -- \x1B is the ANSI escape byte we are parsing
  out += html.replace(/\x1B\[([0-9;]*)m/g, (_m, codes) => {
    let html = '';
    for (const code of (codes || '0').split(';')) {
      if (code === '0' || code === '' || code === '39') {
        html += '</span>'.repeat(stack.length);
        stack.length = 0;
      } else if (code === '1') {
        stack.push('has-text-weight-bold');
        html += '<span class="has-text-weight-bold">';
      } else if (ANSI_CLASS[code]) {
        stack.push(ANSI_CLASS[code]);
        html += `<span class="${ANSI_CLASS[code]}">`;
      }
    }
    return html;
  });
  // eslint-disable-next-line no-control-regex -- \x1B is the ANSI escape byte we are parsing
  out = out.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
  return { html: out + '</span>'.repeat(stack.length), open: stack };
}

/**
 * A job's log file as lines for its card.
 *
 * Args:
 *   text (string): the log file, as the job stores it.
 *
 * Returns:
 *   object[]: each line's { html (well formed, escaped), level ('error', 'warning', 'info',
 *     'debug', or '' for a line without one) } ; the blank lines at its end left out.
 */
export function jobLogLines(text) {
  if (!text) return [];
  const raw = String(text).split(/\r?\n/);
  while (raw.length && !raw[raw.length - 1].trim()) raw.pop();
  let open = [];
  return raw.map((line) => {
    // the timestamp and level read on the text, its colours left out
    // eslint-disable-next-line no-control-regex -- \x1B is the ANSI escape byte we are parsing
    const bare = line.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
    const m = open.length ? null : bare.match(LOG_LINE);
    const level = m?.[3] ? LEVEL_OF[m[3].replace(/[[\]]/g, '').toLowerCase()] || '' : '';
    let html;
    if (m && bare === line) {
      // a plain log line : its timestamp quiet, its level word in its colour
      const rest = line.slice(m[0].length);
      html =
        `<span class="af-log-time">${escapeHtml(m[1])}</span>${escapeHtml(m[2])}` +
        (m[3] ? `<span class="${LEVEL_CLASS[level] || ''} af-log-level">${escapeHtml(m[3])}</span>` : '') +
        escapeHtml(rest);
    } else {
      const done = ansiLine(escapeHtml(line), open);
      html = done.html;
      open = done.open;
    }
    return { html, level };
  });
}

export default { jobLogLines };
