// A job's log file in its Logfile card : a usual log line's timestamp quiet and its level in the
// output's colours, the playbook's ANSI colours as the theme's, nothing of the file run as HTML.
import { describe, it, expect } from 'vitest';
import { jobLogLines } from '@/lib/jobLog';

describe('jobLogLines', () => {
  it('reads a timestamp and a level, the level word in its colour', () => {
    const [line] = jobLogLines('2026-10-13 08:02:55 - INFO - Starting ONTAP health check collection for 172.16.56.1');
    expect(line.level).toBe('info');
    expect(line.html).toBe(
      '<span class="af-log-time">2026-10-13 08:02:55</span> - <span class="has-text-info af-log-level">INFO</span> - Starting ONTAP health check collection for 172.16.56.1',
    );
  });

  it('knows the usual level words and layouts', () => {
    const levels = jobLogLines(
      [
        '2026-10-13T08:02:55.123Z ERROR could not connect',
        '[2026-10-13 08:02:55] WARNING: slow',
        '2026-10-13 08:02:55,001 | DEBUG | detail',
        '2026-10-13 08:02:55 [CRITICAL] down',
        'no timestamp at all',
      ].join('\n'),
    ).map((l) => l.level);
    expect(levels).toEqual(['error', 'warning', 'debug', 'error', '']);
  });

  it('escapes the file : nothing in it is HTML', () => {
    const [line] = jobLogLines('<img src=x onerror=alert(1)> & done');
    expect(line.html).toBe('&lt;img src=x onerror=alert(1)&gt; &amp; done');
  });

  it("takes ANSI colours as the output's classes, carried over lines until a reset", () => {
    const lines = jobLogLines('\x1b[92mfirst\nsecond\x1b[0m third\n\x1b[1;31mbold red\x1b[0m');
    expect(lines.map((l) => l.html)).toEqual([
      '<span class="has-text-success">first</span>',
      '<span class="has-text-success">second</span> third',
      '<span class="has-text-weight-bold"><span class="has-text-danger">bold red</span></span>',
    ]);
  });

  it('leaves the blank lines at the end out, and nothing for no file', () => {
    expect(jobLogLines('one\n\n  \n')).toHaveLength(1);
    expect(jobLogLines('')).toEqual([]);
    expect(jobLogLines(null)).toEqual([]);
  });
});
