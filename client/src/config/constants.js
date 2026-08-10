// Shared constant helpers used by the settings constants page (via
// useFormsConfig) and the designer's constant add/edit modals. Keep these pure
// so both can import the same round-trip logic instead of duplicating it.

export function constantValueDisplay(v) {
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) return '';
  return typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function coerceConstantValue(raw) {
  const v = String(raw ?? '');
  const trimmed = v.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try { return JSON.parse(trimmed); } catch { return v; }
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (String(Number(v)) === v && Number.isFinite(Number(v))) return Number(v);
  return v;
}

// Recursively convert a constants object to an editable tree of rows.
// Each row: { key, value, _orig, _display, children }
// - leaf (non-object value): value is the display string, children is empty
// - parent (plain-object value): value is '', children holds sub-rows
export function constantsToArray(obj) {
  if (!obj || !isPlainObject(obj)) return [];
  return Object.entries(obj).map(([k, v]) => {
    if (isPlainObject(v)) {
      return { key: k, value: '', _orig: v, _display: '', children: constantsToArray(v) };
    }
    const value = constantValueDisplay(v);
    return { key: k, value, _orig: v, _display: value, children: [] };
  });
}

// Rebuild the constants object from the editable tree.
// Keys are trimmed : a form references a constant as `$(MY_KEY)`, so a stray
// space would store a key nothing can ever resolve. Callers are expected to
// refuse a keyless row before getting here (it would be dropped, value and all).
export function arrayToConstants(arr) {
  const obj = {};
  for (const row of arr) {
    const key = String(row.key ?? '').trim();
    if (!key) continue;
    if (row.children && row.children.length > 0) {
      obj[key] = arrayToConstants(row.children);
      continue;
    }
    // Untouched leaf : write the original value back verbatim (keeps 1.10, quoted
    // numbers, ... exactly as they were). Never for a row that WAS a parent : its
    // children have all been deleted, so restoring the original object would
    // resurrect the whole subtree the user just removed.
    if (row._orig !== undefined && !isPlainObject(row._orig) && row.value === row._display) {
      obj[key] = row._orig;
      continue;
    }
    obj[key] = coerceConstantValue(row.value);
  }
  return obj;
}

// Flatten a constants tree into a list with depth for display purposes.
// Each entry holds { row, depth } where row is the ORIGINAL object (not a
// copy), so mutations and reference-based lookups (indexOf) work correctly.
export function flattenConstants(arr, depth = 0) {
  const result = [];
  for (const row of arr) {
    result.push({ row, depth });
    if (row.children && row.children.length > 0) {
      result.push(...flattenConstants(row.children, depth + 1));
    }
  }
  return result;
}
