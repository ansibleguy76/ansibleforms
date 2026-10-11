// directives/fitColumns.js shareWidths : the columns of a record page's table in the room there
// is - each its own width when they fit, else the narrow ones whole and the wide ones sharing
// what is left.
import { describe, it, expect } from 'vitest';
import { shareWidths } from '@/directives/fitColumns';

describe('shareWidths', () => {
  it('leaves the columns alone when they fit', () => {
    expect(shareWidths([100, 200], 400)).toBeNull();
    expect(shareWidths([100, 200], 300)).toBeNull();
  });

  it('keeps the narrow columns whole and shares the rest between the wide ones', () => {
    // 100 fits its share (300) ; the two wide ones split the 800 left
    expect(shareWidths([100, 900, 1200], 900)).toEqual([100, 400, 400]);
  });

  it('cuts only the widest column when one is too wide', () => {
    expect(shareWidths([250, 1200], 800)).toEqual([250, 550]);
  });

  it('shares equally when every column is wider than its share', () => {
    expect(shareWidths([500, 600, 700], 300)).toEqual([100, 100, 100]);
  });
});
