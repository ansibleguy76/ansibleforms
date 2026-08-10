// The constants editor round-trip (config/constants.js), shared by admin/constants.vue
// (through useFormsConfig) and the designer's constant modals.
//
// Constants are referenced from forms as $(MY_KEY), so both halves matter: the KEY has to
// come back byte-identical or the reference stops resolving, and the VALUE has to keep its
// type - a version string "1.10" silently becoming the number 1.1, or an account number
// "007" becoming 7, corrupts a config the user only opened to look at.
//
// The subtle one is the parent guard. An untouched leaf is written back from _orig
// verbatim, but a row that WAS a parent must never take that path: its children have been
// deleted, and restoring _orig would resurrect the entire subtree the user just removed.
import { describe, it, expect } from 'vitest';
import {
  constantsToArray,
  arrayToConstants,
  coerceConstantValue,
  flattenConstants,
} from '@/config/constants';

describe('a round trip changes nothing', () => {
  const original = {
    PLAIN: 'hello',
    VERSION: '1.10',
    PADDED: '007',
    EXPONENT: '1e5',
    NUMBER: 42,
    FLOAT: 1.5,
    YES: true,
    NOTHING: null,
    NESTED: { INNER: 'x', DEEPER: { LEAF: 3 } },
  };

  it('survives constantsToArray -> arrayToConstants untouched', () => {
    expect(arrayToConstants(constantsToArray(original))).toEqual(original);
  });

  it('keeps the STRING types that look like something else', () => {
    const out = arrayToConstants(constantsToArray(original));
    // each of these would be a real corruption of a config nobody edited
    expect(out.VERSION).toBe('1.10');
    expect(out.PADDED).toBe('007');
    expect(out.EXPONENT).toBe('1e5');
    expect(typeof out.NUMBER).toBe('number');
    expect(out.YES).toBe(true);
    expect(out.NOTHING).toBe(null);
  });

  it('keeps nesting', () => {
    const out = arrayToConstants(constantsToArray(original));
    expect(out.NESTED.DEEPER.LEAF).toBe(3);
  });
});

describe('editing', () => {
  it('an edited leaf is coerced, an untouched sibling is not', () => {
    const rows = constantsToArray({ EDITED: '1.10', UNTOUCHED: '1.10' });
    rows.find((r) => r.key === 'EDITED').value = '2';
    const out = arrayToConstants(rows);
    expect(out.EDITED).toBe(2);
    expect(out.UNTOUCHED).toBe('1.10');
  });

  it('trims keys, because $(KEY) is matched literally', () => {
    const rows = constantsToArray({ A: '1' });
    rows[0].key = '  SPACED  ';
    expect(Object.keys(arrayToConstants(rows))).toEqual(['SPACED']);
  });

  it('drops a keyless row instead of writing an empty key', () => {
    const rows = constantsToArray({ A: '1' });
    rows.push({ key: '   ', value: 'orphan', children: [] });
    expect(arrayToConstants(rows)).toEqual({ A: '1' });
  });

  it('emptying a parent does not resurrect its children', () => {
    const rows = constantsToArray({ GROUP: { A: '1', B: '2' } });
    // the user deleted every child row
    rows[0].children = [];
    const out = arrayToConstants(rows);
    // _orig is the original object : writing it back verbatim would undo the deletion
    expect(out.GROUP).not.toEqual({ A: '1', B: '2' });
  });
});

describe('value coercion', () => {
  it('reads the obvious scalars', () => {
    expect(coerceConstantValue('true')).toBe(true);
    expect(coerceConstantValue('false')).toBe(false);
    expect(coerceConstantValue('null')).toBe(null);
    expect(coerceConstantValue('42')).toBe(42);
    expect(coerceConstantValue('1.5')).toBe(1.5);
  });

  it('leaves anything whose text would not round-trip as a string', () => {
    for (const s of ['007', '1e5', '1.10', '+1', ' 42', '42 ', '0x10']) {
      expect(coerceConstantValue(s), `${s} must stay a string`).toBe(s);
    }
  });

  it('parses json objects and arrays, and keeps malformed json as text', () => {
    expect(coerceConstantValue('{"a":1}')).toEqual({ a: 1 });
    expect(coerceConstantValue('[1,2]')).toEqual([1, 2]);
    expect(coerceConstantValue('{not json')).toBe('{not json');
  });
});

describe('flattenConstants', () => {
  it('returns the ORIGINAL row objects, so indexOf and mutation work', () => {
    const rows = constantsToArray({ GROUP: { A: '1' } });
    const flat = flattenConstants(rows);
    expect(flat.map((f) => f.depth)).toEqual([0, 1]);
    expect(flat[0].row).toBe(rows[0]);
    expect(flat[1].row).toBe(rows[0].children[0]);
  });
});
