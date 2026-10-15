import { describe, it, expect } from 'vitest';
import { tileColumns, tileCount } from '@/lib/formTiles';

describe('the forms page placeholders', () => {
  it('follow the grid columns', () => {
    expect(tileColumns(500)).toBe(1);
    expect(tileColumns(800)).toBe(2);
    expect(tileColumns(1200)).toBe(3);
    expect(tileColumns(1920)).toBe(4);
  });

  it('fill it : 9 on a laptop, 20 on a big screen', () => {
    expect(tileCount(500)).toBe(3);
    expect(tileCount(800)).toBe(6);
    expect(tileCount(1366)).toBe(9);
    expect(tileCount(1920)).toBe(20);
  });
});
