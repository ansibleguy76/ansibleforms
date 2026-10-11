// A form's YAML edited in place by its Visual tab (lib/formDoc.js) : each edit changes only what
// it touches - comments, quoting, the form's other keys and a field's other keys survive - and
// what cannot be rewritten safely (an alias) is not edited.
import { describe, test, expect } from 'vitest';
import YAML from 'yaml';
import {
  fieldsState,
  readFields,
  setFieldText,
  setFieldRequired,
  setFieldType,
  moveField,
  removeField,
  addField,
  setFormText,
  setFormType,
  formList,
  setFormList,
  setFormValue,
  fieldDefaultText,
  setFieldDefault,
  setFieldOutput,
  fieldValuesText,
  setFieldValues,
} from '@/lib/formDoc';

const FORM = `# the form
name: Deploy
type: ansible
playbook: deploy.yaml # the playbook
roles:
  - admin
fields:
  # who asks
  - name: user
    type: text
    label: User
    default: "007"
  - name: env
    type: enum
    values:
      - dev
      - prod
    required: true
jobs: keep me
`;

const parse = (text = FORM) => YAML.parseDocument(text);

describe("a form's fields, edited in place", () => {
  test('read as rows', () => {
    const rows = readFields(parse());
    expect(rows.map((r) => [r.name, r.type, r.label, r.required])).toEqual([
      ['user', 'text', 'User', false],
      ['env', 'enum', '', true],
    ]);
  });

  test('a rename and a label keep everything else as written', () => {
    const doc = parse();
    const [user] = readFields(doc);
    setFieldText(user.node, 'name', 'login');
    setFieldText(user.node, 'label', '');
    const out = doc.toString();
    expect(out).toContain('- name: login');
    expect(out).not.toContain('label: User');
    for (const kept of [
      '# the form',
      'playbook: deploy.yaml # the playbook',
      '# who asks',
      'default: "007"',
      'jobs: keep me',
    ])
      expect(out).toContain(kept);
  });

  test('required : true, or no key', () => {
    const doc = parse();
    const [user, env] = readFields(doc);
    setFieldRequired(user.node, true);
    setFieldRequired(env.node, false);
    const rows = readFields(doc);
    expect(rows.map((r) => r.required)).toEqual([true, false]);
    expect(doc.toString().match(/required/g)).toHaveLength(1);
  });

  test('a type change removes what the new type forbids, and tells what it lacks', () => {
    const doc = parse();
    const [, env] = readFields(doc);
    const result = setFieldType(env.node, 'text');
    expect(result.removed).toContain('values');
    expect(doc.toString()).not.toContain('- prod');
    const [user] = readFields(doc);
    expect(setFieldType(user.node, 'enum').needs).not.toBeNull();
  });

  test('moved, removed and added ; the comment travels with its field', () => {
    const doc = parse();
    expect(moveField(doc, 0, 1)).toBe(true);
    expect(readFields(doc).map((r) => r.name)).toEqual(['env', 'user']);
    expect(doc.toString()).toMatch(/# who asks\n\s*- name: user/);
    expect(moveField(doc, 1, 1)).toBe(false);
    expect(removeField(doc, 0)).toBe(true);
    expect(addField(doc)).toBe(true);
    const rows = readFields(doc);
    expect(rows.map((r) => r.name)).toEqual(['user', '']);
    expect(rows[1].noName).toBe(true);
  });

  test('a form without fields gets its list with the first one', () => {
    const doc = parse('name: X\ntype: ansible\n');
    expect(fieldsState(doc)).toBe('none');
    expect(addField(doc)).toBe(true);
    expect(fieldsState(doc)).toBe('list');
  });

  test('an alias is not edited', () => {
    const doc = parse('common: &f\n  - name: a\n    type: text\nname: X\ntype: ansible\nfields: *f\n');
    expect(fieldsState(doc)).toBe('alias');
    expect(readFields(doc)).toEqual([]);
    expect(addField(doc)).toBe(false);
    expect(moveField(doc, 0, 1)).toBe(false);
  });

  test('two fields with one name are said', () => {
    const doc = parse('name: X\ntype: ansible\nfields:\n  - name: a\n  - name: a\n');
    expect(readFields(doc).map((r) => r.duplicate)).toEqual([false, true]);
  });
});

describe('the form itself, edited in place', () => {
  test('its texts : an empty one goes, the name stays', () => {
    const doc = parse();
    setFormText(doc, 'description', 'Deploys it');
    setFormText(doc, 'playbook', '');
    setFormText(doc, 'name', '');
    const out = doc.toString();
    expect(out).toContain('description: Deploys it');
    expect(out).not.toContain('playbook');
    expect(out).toMatch(/^name: ""$/m);
    expect(out).toContain('# the form');
  });

  test('a type change removes what the new type forbids', () => {
    const doc = parse();
    expect(setFormType(doc, 'subform')).toEqual(expect.arrayContaining(['playbook', 'roles']));
    expect(doc.toString()).not.toContain('playbook');
  });

  test('its categories and roles : strings kept as written, none in Default', () => {
    const doc = parse('name: X\ntype: ansible\nroles:\n  - "admin" # admins\ncategories:\n  - Demo\n');
    expect(formList(doc, 'roles')).toEqual(['admin']);
    setFormList(doc, 'roles', ['admin', 'public']);
    expect(doc.toString()).toContain('- "admin" # admins');
    setFormList(doc, 'categories', []);
    expect(doc.toString()).not.toContain('categories');
    expect(formList(parse('roles:\n  - name: x\n'), 'roles')).toBe(null);
  });
});

describe('the rest, edited in place', () => {
  test('a flag : true, or no key ; a number ; a list', () => {
    const doc = parse();
    setFormValue(doc, 'check', true);
    setFormValue(doc, 'order', 3);
    setFormValue(doc, 'instanceGroups', ['a', 'b']);
    setFormValue(doc, 'check', undefined);
    const out = doc.toString();
    expect(out).not.toContain('check');
    expect(out).toContain('order: 3');
    expect(out).toMatch(/instanceGroups:\n\s+- a\n\s+- b/);
  });

  test("a field's default : typed as the fields editor types it, a list left alone", () => {
    const doc = parse();
    const [user] = readFields(doc);
    expect(fieldDefaultText(user.node)).toBe('007');
    setFieldDefault(user.node, '42');
    expect(user.node.get('default')).toBe(42);
    setFieldDefault(user.node, '0755');
    expect(user.node.get('default')).toBe('0755');
    setFieldDefault(user.node, '');
    expect(user.node.has('default')).toBe(false);
    expect(fieldDefaultText(parse('fields:\n  - name: a\n    default: [1, 2]\n').get('fields').items[0])).toBe(null);
  });

  test("a field's output and values", () => {
    const doc = parse();
    const [user, env] = readFields(doc);
    setFieldOutput(user.node, false);
    expect(user.node.get('output')).toBe(false);
    setFieldOutput(user.node, true);
    expect(user.node.has('output')).toBe(false);
    expect(fieldValuesText(env.node)).toBe('- dev\n- prod');
    expect(setFieldValues(doc, env.node, '- a\n- name: b')).toBe('');
    expect(env.node.get('values').toJSON()).toEqual(['a', { name: 'b' }]);
    expect(setFieldValues(doc, env.node, 'a: 1')).not.toBe('');
    expect(setFieldValues(doc, env.node, '')).toBe('');
    expect(env.node.has('values')).toBe(false);
  });
});
