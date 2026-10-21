// What a Pull all did (lib/pullResults.js) : a repository whose changes are not pushed yet is
// refused by the server with a 409 and said as skipped, apart from the pulls that failed, and
// the others are pulled as before.
import { describe, it, expect } from 'vitest';
import { sortPulls, skippedPulls } from '@/lib/pullResults';

const refused = (status) => ({ status: 'rejected', reason: { response: { status } } });

describe("the settings' Pull all", () => {
  it('sorts each repository into pulled, skipped (409) and failed', () => {
    const repos = [{ name: 'alpha' }, { name: 'beta' }, { name: 'gamma' }, { name: 'delta' }];
    const settled = [
      { status: 'fulfilled' },
      refused(409),
      refused(500),
      { status: 'rejected', reason: new Error('offline') },
    ];
    expect(sortPulls(repos, settled)).toEqual({ pulled: ['alpha'], skipped: ['beta'], failed: ['gamma', 'delta'] });
  });

  it('all pulled : nothing skipped, nothing failed', () => {
    expect(sortPulls([{ name: 'a' }], [{ status: 'fulfilled' }])).toEqual({ pulled: ['a'], skipped: [], failed: [] });
  });
});

describe("the designer's pull", () => {
  it('names the repositories the server skipped', () => {
    expect(skippedPulls({ results: [], skipped: ['beta'] })).toEqual(['beta']);
    expect(
      skippedPulls({
        results: [
          { name: 'alpha', status: 'success' },
          { name: 'beta', status: 'skipped' },
        ],
      }),
    ).toEqual(['beta']);
  });

  it('a single pull answers nothing : none skipped', () => {
    expect(skippedPulls(null)).toEqual([]);
    expect(skippedPulls('')).toEqual([]);
  });
});
