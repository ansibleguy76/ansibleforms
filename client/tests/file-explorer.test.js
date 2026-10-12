// The designer's file explorer : one width for every section, its handle kept between bounds.
import { describe, it, expect } from 'vitest';
import { EXPLORER_WIDTH, explorerWidthAfterDrag } from '@/config/fileExplorer';

describe('the file explorer width', () => {
  it('opens at 30% of the section', () => {
    expect(EXPLORER_WIDTH.start).toBe(30);
  });
  it('widens dragged left, narrows dragged right, within its bounds', () => {
    expect(explorerWidthAfterDrag(30, -100, 1000)).toBe(40);
    expect(explorerWidthAfterDrag(30, 100, 1000)).toBe(20);
    expect(explorerWidthAfterDrag(30, -900, 1000)).toBe(EXPLORER_WIDTH.max);
    expect(explorerWidthAfterDrag(30, 900, 1000)).toBe(EXPLORER_WIDTH.min);
  });
});
