import { describe, it, expect } from 'vitest';
import { fitRowCount, fitSize, nearestSize, typicalHeight, FIT_MIN, FIT_MAX } from '../src/lib/tableFit.js';

// the rows a table shows by default : as many as fit the room under its header
describe('fitRowCount', () => {
  it('counts the whole rows that fit', () => {
    expect(fitRowCount(600, 37)).toBe(16);
    expect(fitRowCount(370, 37)).toBe(10);
  });

  it('keeps a short window to a few rows and a tall one to the largest size offered', () => {
    expect(fitRowCount(50, 37)).toBe(FIT_MIN);
    expect(fitRowCount(-20, 37)).toBe(FIT_MIN);
    expect(fitRowCount(100000, 37)).toBe(FIT_MAX);
  });

  it('gives nothing without a row to measure', () => {
    expect(fitRowCount(600, 0)).toBeNull();
    expect(fitRowCount(600, undefined)).toBeNull();
    expect(fitRowCount(NaN, 37)).toBeNull();
  });
});

// the page size the screen picks : one the pager offers, never a count of its own
describe('fitSize', () => {
  const sizes = [10, 20, 50, 100];

  it('takes the largest size the screen nearly holds', () => {
    expect(fitSize(15, sizes)).toBe(10);
    expect(fitSize(16, sizes)).toBe(20);
    expect(fitSize(18, sizes)).toBe(20);
    expect(fitSize(39, sizes)).toBe(20);
    expect(fitSize(40, sizes)).toBe(50);
    expect(fitSize(80, sizes)).toBe(100);
  });

  it('takes the smallest when none fits', () => {
    expect(fitSize(7, sizes)).toBe(10);
  });
});

// a size saved before the sizes changed : the nearest one offered now
describe('nearestSize', () => {
  const sizes = [10, 20, 50, 100];

  it('keeps a size still offered', () => {
    expect(nearestSize(50, sizes)).toBe(50);
  });

  it('moves a size no longer offered to the closest', () => {
    expect(nearestSize(25, sizes)).toBe(20);
    expect(nearestSize(75, sizes)).toBe(50);
    expect(nearestSize(500, sizes)).toBe(100);
  });
});

describe('typicalHeight', () => {
  it('takes the median, so one wrapped row does not count as every row', () => {
    expect(typicalHeight([37, 59, 37, 37, 37])).toBe(37);
  });
  it('takes the upper middle one of an even count', () => {
    expect(typicalHeight([30, 40])).toBe(40);
  });
  it('is 0 for no rows', () => {
    expect(typicalHeight([])).toBe(0);
  });
});
