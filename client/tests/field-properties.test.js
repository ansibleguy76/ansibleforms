// A field's properties as a form's Visual tab offers them (config/fieldProperties.js), generated
// from the schema : every property of a field the schema knows is there - but the few the tab
// shows itself - with the kind of input its type takes ; and their values edited in place.
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import { fieldProperties } from '@/config/fieldProperties';
import { fieldPropValue, setFieldProp, addFieldProp } from '@/lib/formDoc';

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(readFileSync(path.join(here, '../../server/schema/form_schema.json'), 'utf8'));
const props = schema.properties.fields.items.properties;
const SHOWN = ['name', 'type', 'label', 'required', 'help', 'default', 'output', 'values'];

describe("a field's properties", () => {
  test('follow the schema : every property but those shown by the tab, none it lacks', () => {
    const listed = fieldProperties.map((p) => p.key).sort();
    const expected = Object.keys(props)
      .filter((k) => !SHOWN.includes(k))
      .sort();
    expect(listed).toEqual(expected);
  });

  test("each with the kind of input the schema's type takes", () => {
    for (const p of fieldProperties) {
      const t = props[p.key].type;
      if (p.kind === 'switch') expect(t, p.key).toBe('boolean');
      if (p.kind === 'number') expect(['number', 'integer'], p.key).toContain(t);
      if (p.kind === 'select') expect(props[p.key].enum, p.key).toEqual(p.options);
    }
  });

  test('edited in place : a number, a flag, YAML, a refused value', () => {
    const doc = YAML.parseDocument('fields:\n  - name: a\n    type: enum\n    query: select 1 # the query\n');
    const node = doc.get('fields').items[0];
    const by = (k) => fieldProperties.find((p) => p.key === k);
    expect(fieldPropValue(node, by('query'))).toBe('select 1');
    setFieldProp(doc, node, by('query'), 'select 2');
    expect(doc.toString()).toContain('query: select 2 # the query');
    addFieldProp(doc, node, by('multiple'));
    expect(node.get('multiple')).toBe(true);
    // text or a number : a whole number is stored as one
    setFieldProp(doc, node, by('minValue'), '5');
    expect(node.get('minValue')).toBe(5);
    const numeric = fieldProperties.find((p) => p.kind === 'number');
    if (numeric) expect(setFieldProp(doc, node, numeric, 'x')).not.toBe('');
    expect(setFieldProp(doc, node, by('dependencies'), '- name: b\n  values: [1]')).toBe('');
    expect(node.get('dependencies').toJSON()).toEqual([{ name: 'b', values: [1] }]);
    expect(setFieldProp(doc, node, by('dependencies'), ': : :')).not.toBe('');
  });
});
