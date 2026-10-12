// The Preview tabs of the designer's Constants and Vars files sections : what a form (a
// constant) or a playbook (a variable) gets, and who uses it. Pure : AppConstantsPreview and
// AppVarsPreview draw them.
import YAML from 'yaml';

/**
 * What kind a value is, as the preview says it.
 *
 * Args:
 *   value (any): the value.
 *
 * Returns:
 *   string: 'map', 'list', 'text', 'number', 'boolean' or 'null'.
 */
export function kindOf(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return 'list';
  if (typeof value === 'object') return 'map';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'text';
}

/**
 * A value flattened : itself, then each of its keys (a map's) a level down, by its dotted path ;
 * a list is one entry (its items in its value).
 *
 * Args:
 *   value (object): the map.
 *   prefix (string): the path above it.
 *   depth (number): how deep it is.
 *
 * Returns:
 *   object[]: { path, depth, kind, value (text : a scalar's, a list's items, a map's keys count) }.
 */
export function flatten(value, prefix = '', depth = 0) {
  const out = [];
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 20) return out;
  for (const [key, v] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const kind = kindOf(v);
    let shown;
    if (kind === 'map') shown = Object.keys(v).length;
    else if (kind === 'list')
      shown = v.map((x) => (x && typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ');
    else shown = v === null || v === undefined ? '' : String(v);
    out.push({ path, depth, kind, value: shown });
    if (kind === 'map') out.push(...flatten(v, path, depth + 1));
  }
  return out;
}

/**
 * A YAML text read as a map, null when it is not one.
 *
 * Args:
 *   text (string): the YAML.
 *
 * Returns:
 *   object: { data (the map, or null), error (the first error's message), line }.
 */
export function readMap(text) {
  const lineCounter = new YAML.LineCounter();
  const doc = YAML.parseDocument(text || '', { lineCounter });
  if (doc.errors.length) {
    const e = doc.errors[0];
    return { data: null, error: e.message.split('\n')[0], line: e.linePos?.[0]?.line ?? null };
  }
  const data = doc.toJS();
  if (data === null || data === undefined) return { data: {}, error: '' };
  if (typeof data !== 'object' || Array.isArray(data)) return { data: null, error: 'Not a map', line: 1 };
  return { data, error: '' };
}

/**
 * The forms that reference a constant : $(PATH), or a key under it ($(PATH.key)).
 *
 * Args:
 *   path (string): the constant's path.
 *   forms (object[]): { name, text }.
 *
 * Returns:
 *   string[]: the forms' names.
 */
export function formsUsingConstant(path, forms) {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\$\\(${escaped}[).]`);
  return (forms || []).filter((f) => re.test(f.text || '')).map((f) => f.name);
}

/**
 * The forms that load a vars file : their varsFiles name it (by its path, or its name).
 *
 * Args:
 *   file (string): the vars file's path, as the explorer shows it.
 *   forms (object[]): { name, text }.
 *
 * Returns:
 *   string[]: the forms' names.
 */
export function formsUsingVarsFile(file, forms) {
  const base = String(file || '')
    .split('/')
    .pop();
  return (forms || [])
    .filter((f) => {
      let data;
      try {
        data = YAML.parse(f.text || '');
      } catch {
        return false;
      }
      const list = [].concat(data?.varsFiles || []).map((v) => String(v));
      return list.some((v) => v === file || v.endsWith(`/${file}`) || v === base || v.endsWith(`/${base}`));
    })
    .map((f) => f.name);
}
