/******************************************************************/
/*                                                                */
/*  A form's YAML edited in place, for its Visual tab in the      */
/*  designer (components/AppFormVisualEditor.vue) : the form's    */
/*  name, type, description, playbook or template, icon,          */
/*  categories and roles ; its fields read as rows, a field's     */
/*  name, type, label and required set, fields moved, removed     */
/*  and added - each edit on the YAML                             */
/*  document itself, so comments, quoting and every other key of  */
/*  the form and of its fields stay as they were written.         */
/*                                                                */
/******************************************************************/
import YAML from 'yaml';
import { forbiddenFieldKeys, requiredFieldKeys, forbiddenFormKeys } from '@/config/formFields';

/**
 * Sets a key of a map : an existing scalar keeps its node (its quoting, its comment) ;
 * undefined removes the key.
 *
 * Args:
 *   map (object): the YAML map.
 *   key (string): the key.
 *   value (any): the value, or undefined.
 */
export function setKey(map, key, value) {
  if (value === undefined) {
    map.delete(key);
    return;
  }
  const node = map.get(key, true);
  if (YAML.isScalar(node)) node.value = value;
  else map.set(key, value);
}

/**
 * Whether the form's fields can be edited here : 'list', 'none' (no fields yet), or why not -
 * 'alias' (a list, or a field, written as an alias : rewriting it would expand it) or
 * 'unreadable' (not a list of maps).
 *
 * Args:
 *   doc (object): the form's YAML document.
 *
 * Returns:
 *   string: 'list', 'none', 'alias' or 'unreadable'.
 */
export function fieldsState(doc) {
  if (!doc || !YAML.isMap(doc.contents)) return 'unreadable';
  const seq = doc.get('fields', true);
  if (seq === undefined || seq === null) return 'none';
  if (YAML.isAlias(seq)) return 'alias';
  if (!YAML.isSeq(seq)) return 'unreadable';
  if (seq.items.some((item) => YAML.isAlias(item))) return 'alias';
  if (seq.items.some((item) => !YAML.isMap(item))) return 'unreadable';
  return 'list';
}

/**
 * The form's fields as rows : each its node, name, type, label, required, and whether its name
 * is missing or another field's.
 *
 * Args:
 *   doc (object): the form's YAML document.
 *
 * Returns:
 *   object[]: the rows ; none when the fields cannot be edited here.
 */
export function readFields(doc) {
  if (fieldsState(doc) !== 'list') return [];
  const seq = doc.get('fields', true);
  const names = seq.items.map((node) => String(node.get('name') ?? '').trim());
  return seq.items.map((node, i) => ({
    node,
    name: String(node.get('name') ?? ''),
    type: String(node.get('type') ?? '') || 'text',
    label: String(node.get('label') ?? ''),
    required: node.get('required') === true,
    noName: !names[i],
    duplicate: !!names[i] && names.indexOf(names[i]) !== i,
  }));
}

/**
 * Sets a field's name or label : an empty label removes the key, a name always stays.
 *
 * Args:
 *   node (object): the field.
 *   key (string): 'name' or 'label'.
 *   value (string): the text.
 */
export function setFieldText(node, key, value) {
  setKey(node, key, key === 'name' ? value : value === '' ? undefined : value);
}

/**
 * Sets whether a field is required : required: true, or no key at all.
 *
 * Args:
 *   node (object): the field.
 *   on (boolean): required or not.
 */
export function setFieldRequired(node, on) {
  setKey(node, 'required', on ? true : undefined);
}

/**
 * Changes a field's type : the keys the new type forbids are removed (the schema refuses the
 * form with them), and what the new type needs but the field lacks is told.
 *
 * Args:
 *   node (object): the field.
 *   type (string): the new type.
 *
 * Returns:
 *   object: { removed: the keys removed, needs: the key sets it needs, none present ; or null }.
 */
export function setFieldType(node, type) {
  setKey(node, 'type', type);
  const removed = [];
  for (const key of forbiddenFieldKeys[type] || []) {
    if (node.has(key)) {
      node.delete(key);
      removed.push(key);
    }
  }
  const sets = requiredFieldKeys[type];
  const needs = sets && !sets.some((set) => set.every((key) => node.has(key))) ? sets : null;
  return { removed, needs };
}

/**
 * A comment between 'fields:' and the first '-' belongs to the list : it goes onto the first
 * field, so it travels with that field when the list changes (as the fields editor does).
 *
 * Args:
 *   seq (object): the fields' list.
 */
function hoistComment(seq) {
  if (!seq.commentBefore) return;
  const first = seq.items[0];
  if (!first || typeof first !== 'object') return;
  first.commentBefore = first.commentBefore ? `${seq.commentBefore}\n${first.commentBefore}` : seq.commentBefore;
  seq.commentBefore = null;
}

/**
 * Moves a field one place up or down.
 *
 * Args:
 *   doc (object): the form's YAML document.
 *   index (number): the field.
 *   step (number): -1 up, 1 down.
 *
 * Returns:
 *   boolean: true when it moved.
 */
export function moveField(doc, index, step) {
  if (fieldsState(doc) !== 'list') return false;
  const seq = doc.get('fields', true);
  const to = index + step;
  if (index < 0 || index >= seq.items.length || to < 0 || to >= seq.items.length) return false;
  hoistComment(seq);
  seq.items.splice(to, 0, seq.items.splice(index, 1)[0]);
  return true;
}

/**
 * Removes a field, with everything it holds.
 *
 * Args:
 *   doc (object): the form's YAML document.
 *   index (number): the field.
 *
 * Returns:
 *   boolean: true when it was removed.
 */
export function removeField(doc, index) {
  if (fieldsState(doc) !== 'list') return false;
  const seq = doc.get('fields', true);
  if (index < 0 || index >= seq.items.length) return false;
  hoistComment(seq);
  seq.items.splice(index, 1);
  return true;
}

/**
 * Adds a field at the end : a text field without a name yet ; the form's first field makes its
 * fields list.
 *
 * Args:
 *   doc (object): the form's YAML document.
 *
 * Returns:
 *   boolean: true when it was added.
 */
export function addField(doc) {
  const state = fieldsState(doc);
  const field = { name: '', type: 'text', label: '' };
  if (state === 'list') doc.get('fields', true).items.push(doc.createNode(field));
  else if (state === 'none') doc.set('fields', doc.createNode([field]));
  else return false;
  return true;
}

// ─── the form itself ──────────────────────────────────────────────────────────

/**
 * Sets a text key of the form : empty removes it, but the name (the schema requires it).
 *
 * Args:
 *   doc (object): the form's YAML document.
 *   key (string): the key (name, description, playbook, template, icon).
 *   value (string): the text.
 */
export function setFormText(doc, key, value) {
  const text = String(value ?? '').trim();
  setKey(doc.contents, key, key === 'name' || text ? text : undefined);
}

/**
 * Changes the form's type : the keys the new type forbids are removed (the schema refuses the
 * form with them), as the form settings do.
 *
 * Args:
 *   doc (object): the form's YAML document.
 *   type (string): the new type.
 *
 * Returns:
 *   string[]: the keys removed.
 */
export function setFormType(doc, type) {
  setKey(doc.contents, 'type', type);
  const removed = [];
  for (const key of forbiddenFormKeys[type] || []) {
    if (doc.contents.has(key)) {
      doc.contents.delete(key);
      removed.push(key);
    }
  }
  return removed;
}

/**
 * A list of strings of the form (its categories, its roles), or null when it holds anything
 * else (it is then edited in the YAML).
 *
 * Args:
 *   doc (object): the form's YAML document.
 *   key (string): 'categories' or 'roles'.
 *
 * Returns:
 *   string[]|null: the strings.
 */
export function formList(doc, key) {
  const node = doc.get(key, true);
  if (node === undefined || node === null) return [];
  if (!YAML.isSeq(node) || !node.items.every((i) => YAML.isScalar(i) && typeof i.value === 'string')) return null;
  return node.items.map((i) => i.value);
}

/**
 * Sets a list of strings of the form, keeping the node of every string it already held (its
 * quoting, its comment). No categories : the key goes (the form is then in Default) ; roles
 * stay, empty, as the schema requires them.
 *
 * Args:
 *   doc (object): the form's YAML document.
 *   key (string): 'categories' or 'roles'.
 *   list (string[]): the strings.
 *
 * Returns:
 *   boolean: false when the list holds anything else (an alias, a map) : not changed.
 */
export function setFormList(doc, key, list) {
  if (formList(doc, key) === null) return false;
  if (!list.length && key === 'categories') {
    doc.contents.delete(key);
    return true;
  }
  const seq = doc.get(key, true);
  if (!YAML.isSeq(seq)) {
    doc.set(key, doc.createNode(list));
    return true;
  }
  const kept = new Map(seq.items.map((i) => [i.value, i]));
  seq.items = list.map((v) => kept.get(v) || doc.createNode(v));
  return true;
}

/**
 * Sets any key of the form : a number, a flag (true, or no key), a list ; undefined removes it.
 *
 * Args:
 *   doc (object): the form's YAML document.
 *   key (string): the key.
 *   value (any): the value, or undefined.
 */
export function setFormValue(doc, key, value) {
  setKey(doc.contents, key, value);
}

// ─── a field's other properties ───────────────────────────────────────────────

/**
 * A field's default as text : a scalar as it reads ; null for a list or a map (edited in the
 * YAML, a text would flatten it).
 *
 * Args:
 *   node (object): the field.
 *
 * Returns:
 *   string|null: the text, or null.
 */
export function fieldDefaultText(node) {
  const def = node.get('default', true);
  if (def === undefined || def === null) return '';
  if (YAML.isScalar(def)) return def.value === null || def.value === undefined ? '' : String(def.value);
  return null;
}

/**
 * Sets a field's default from text : a whole number that spells itself back, true and false
 * are typed as such (as the fields editor does : '0755' stays a string) ; empty removes it.
 *
 * Args:
 *   node (object): the field.
 *   text (string): the text.
 */
export function setFieldDefault(node, text) {
  const d = String(text ?? '');
  if (!d.trim()) {
    node.delete('default');
    return;
  }
  const n = Number(d.trim());
  let value = d;
  if (d.trim() === 'true') value = true;
  else if (d.trim() === 'false') value = false;
  else if (Number.isInteger(n) && String(n) === d.trim()) value = n;
  setKey(node, 'default', value);
}

/**
 * Sets whether a field's value goes to the job : output: false, or no key (it does).
 *
 * Args:
 *   node (object): the field.
 *   on (boolean): in the output or not.
 */
export function setFieldOutput(node, on) {
  setKey(node, 'output', on ? undefined : false);
}

/**
 * A field's values as YAML text, or null when they are an alias (rewriting would expand it).
 *
 * Args:
 *   node (object): the field.
 *
 * Returns:
 *   string|null: the text ('' for none), or null.
 */
export function fieldValuesText(node) {
  const values = node.get('values', true);
  if (values === undefined || values === null) return '';
  if (YAML.isAlias(values)) return null;
  return YAML.stringify(values.toJSON()).trimEnd();
}

/**
 * Sets a field's values from YAML text : a list of strings or of maps ; empty removes them.
 *
 * Args:
 *   doc (object): the form's YAML document.
 *   node (object): the field.
 *   text (string): the YAML.
 *
 * Returns:
 *   string: '' when set, else why not (not YAML, not a list).
 */
export function setFieldValues(doc, node, text) {
  if (!String(text ?? '').trim()) {
    node.delete('values');
    return '';
  }
  let parsed;
  try {
    parsed = YAML.parse(text);
  } catch (e) {
    return e?.message || String(e);
  }
  if (!Array.isArray(parsed)) return 'not a list';
  node.set('values', doc.createNode(parsed));
  return '';
}

// ─── a field's properties of its type (config/fieldProperties.js) ─────────────

/**
 * A property of a field as its input shows it : text, a number, a flag, a choice, a scalar (text
 * or a number), or YAML text for a list or an object.
 *
 * Args:
 *   node (object): the field.
 *   prop (object): the property ({ key, kind }).
 *
 * Returns:
 *   any: the value as its input takes it.
 */
export function fieldPropValue(node, prop) {
  const value = node.get(prop.key, true);
  if (value === undefined || value === null) return prop.kind === 'switch' ? false : '';
  const json = YAML.isNode(value) ? value.toJSON() : value;
  if (prop.kind === 'yaml') return typeof json === 'string' ? json : YAML.stringify(json).trimEnd();
  if (prop.kind === 'switch') return json === true;
  return json === null || json === undefined ? '' : String(json);
}

/**
 * Sets a property of a field from its input : a number as a number (empty removes it), a flag
 * as true or false, YAML as what it says (a list, an object, a value) ; a scalar keeps its node.
 *
 * Args:
 *   doc (object): the form's YAML document.
 *   node (object): the field.
 *   prop (object): the property ({ key, kind }).
 *   input (any): what was typed or picked.
 *
 * Returns:
 *   string: '' when set, else why not (YAML that does not parse, not a number).
 */
export function setFieldProp(doc, node, prop, input) {
  if (prop.kind === 'switch') {
    setKey(node, prop.key, !!input);
    return '';
  }
  if (prop.kind === 'number') {
    const text = String(input ?? '').trim();
    if (!text) {
      node.delete(prop.key);
      return '';
    }
    const n = Number(text);
    if (isNaN(n)) return 'not a number';
    setKey(node, prop.key, n);
    return '';
  }
  if (prop.kind === 'yaml') {
    let parsed;
    try {
      parsed = YAML.parse(String(input ?? ''));
    } catch (e) {
      return e?.message || String(e);
    }
    if (parsed === null || parsed === undefined) parsed = '';
    if (typeof parsed === 'object') node.set(prop.key, doc.createNode(parsed));
    else setKey(node, prop.key, parsed);
    return '';
  }
  // text or a number (minValue, maxLength...) : a whole number that spells itself back is one
  if (prop.kind === 'scalar') {
    const text = String(input ?? '').trim();
    const n = Number(text);
    setKey(node, prop.key, text !== '' && Number.isFinite(n) && String(n) === text ? n : text);
    return '';
  }
  setKey(node, prop.key, String(input ?? ''));
  return '';
}

/**
 * Adds a property to a field, with what a new one starts as : empty text, 0, on, the first
 * choice, an empty list or object.
 *
 * Args:
 *   doc (object): the form's YAML document.
 *   node (object): the field.
 *   prop (object): the property ({ key, kind, options, init }).
 */
export function addFieldProp(doc, node, prop) {
  if (node.has(prop.key)) return;
  const start = {
    text: '',
    scalar: '',
    number: 0,
    switch: true,
    select: prop.options?.[0] ?? '',
    yaml: prop.init ?? '',
  }[prop.kind];
  node.set(prop.key, typeof start === 'object' ? doc.createNode(start) : start);
}
