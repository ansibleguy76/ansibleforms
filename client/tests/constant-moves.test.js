// The constants' moves (config/constants.js) : ↑ ↓ among their own, → under the key above
// only when that one holds subkeys or no value (a value would be lost), ← right after it.
import { describe, test, expect } from 'vitest';
import {
  canMoveConstant,
  moveConstant,
  canIndentConstant,
  indentConstant,
  canOutdentConstant,
  outdentConstant,
} from '@/config/constants';

const row = (key, value = '', children = []) => ({ key, value, children });
const keys = (rows) => rows.map((r) => (r.children.length ? `${r.key}{${keys(r.children)}}` : r.key)).join(',');

describe('moving a constant', () => {
  test('up and down among its own only', () => {
    const a = row('a', '1');
    const b = row('b', '2');
    const tree = [a, b];
    expect(canMoveConstant(tree, a, -1)).toBe(false);
    expect(moveConstant(tree, a, 1)).toBe(true);
    expect(keys(tree)).toBe('b,a');
  });

  test('→ only under a key with subkeys or no value, ← right after it', () => {
    const withValue = row('url', 'https://x');
    const empty = row('group');
    const c = row('c', '3');
    const tree = [withValue, empty, c];
    // under a key holding a value : refused, the value would be lost
    expect(canIndentConstant(tree, empty)).toBe(false);
    expect(indentConstant(tree, c)).toBe(true);
    expect(keys(tree)).toBe('url,group{c}');
    expect(canOutdentConstant(tree, c)).toBe(true);
    expect(outdentConstant(tree, c)).toBe(true);
    expect(keys(tree)).toBe('url,group,c');
    expect(canOutdentConstant(tree, c)).toBe(false);
  });
});
