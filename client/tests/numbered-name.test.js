// fnGetNumberedName in the browser sandbox (Helpers.evalSandbox), the mirror of the
// server's : numbers sorted numerically and deduplicated, 0 counts, so fillgap never
// suggests a name that is already taken.
import { describe, it, expect } from 'vitest';
import Helpers from '@/lib/Helpers.js';

const run = (names, fillgap) =>
  Helpers.evalSandbox(`fnGetNumberedName(${JSON.stringify(names)}, 'vol_###', 'x', ${fillgap})`);

describe('fnGetNumberedName (browser)', () => {
  it('never suggests a taken name for unsorted or duplicated names', () => {
    expect(run(['vol_001', 'vol_003', 'vol_002'], true)).toBe('vol_004');
    expect(run(['vol_005', 'vol_001', 'vol_003'], true)).toBe('vol_002');
    expect(run(['vol_001', 'vol_001', 'vol_002'], true)).toBe('vol_003');
  });

  it('counts 0 as a taken number', () => {
    expect(run(['vol_000'], false)).toBe('vol_001');
    expect(run(['vol_000', 'vol_002'], true)).toBe('vol_001');
  });
});
