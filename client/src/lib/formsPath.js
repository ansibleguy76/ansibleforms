/******************************************************************/
/*                                                                */
/*  The forms' addresses : every form at /forms/all, the forms of */
/*  a category at /forms/<category>, a sub category under its     */
/*  parent - /forms/demo, /forms/expressions/test1 - and a form   */
/*  at /form/<form>, whatever category it is opened from (a form  */
/*  may be in several, or in none). A name is written in the      */
/*  address as a page's would be : lower case, words joined by a  */
/*  dash ('Network Ops' is network-ops), and read back against    */
/*  the names of the forms config, whatever its case or spelling  */
/*  in the address (/forms/Network%20Ops is network-ops too).     */
/*                                                                */
/******************************************************************/

// the forms list's own name for every form, never a category's
export const ALL_FORMS = 'all';

/**
 * A category's or a form's name as it reads in an address.
 *
 * Args:
 *   name (string): the name ('Network Ops').
 *
 * Returns:
 *   string: lower case, accents dropped, every run of characters that are not a letter or a
 *     digit (in any script) a dash, none at either end ('network-ops', 'cafe-debacle',
 *     '日本語-フォーム'). A name with no letter or digit at all ('???') is written
 *     percent-encoded instead ('%3F%3F%3F'), so it still has an address of its own.
 *
 * Only Latin letters and digits used to be kept, so a name written in another script
 * (Japanese, Chinese, Greek, Cyrillic) came out empty : every such form had the same
 * address, /form/, and none of them could be opened from it.
 */
export function slugOf(name) {
  let text = String(name ?? '');
  // an address read back (or one typed percent-encoded) : its characters, so that slugOf of
  // a slug is that slug again - a name that is not valid percent-encoding stays as it is
  try {
    text = decodeURIComponent(text);
  } catch {
    // a lone '%' (a name like '100%') : not encoded, kept
  }
  const slug = text
    .toLowerCase()
    // accents off (é is e + a combining accent), then composed again : a Hangul syllable
    // or a kana with a voicing mark is one character in the address, not its parts
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug || encodeURIComponent(text);
}

/**
 * The forms list's address for a category.
 *
 * Args:
 *   category (string): the category's path of names ('Expressions/Test1') ; empty, every form.
 *
 * Returns:
 *   string: /forms/all, or /forms/<slug>/<slug>...
 */
export function formsPath(category) {
  if (!category) return `/forms/${ALL_FORMS}`;
  return '/forms/' + category.split('/').map(slugOf).join('/');
}

/**
 * The category an address names, by the names of the forms config.
 *
 * Args:
 *   slugs (string|string[]): the address after /forms/ ('expressions/test1'), or its parts.
 *   categories (Array): the config's categories, each { name, items } (items : its subs).
 *
 * Returns:
 *   string|null: the category's path of names ('Expressions/Test1') ; '' for every form
 *     (/forms/all, or nothing) ; null when no category has that address.
 */
export function categoryFromPath(slugs, categories) {
  // a part as an address writes it : a link typed by the category's name (/forms/Expressions,
  // /forms/Network Ops) names the same category as its own address
  const parts = (Array.isArray(slugs) ? slugs : String(slugs || '').split('/')).map(slugOf).filter(Boolean);
  if (!parts.length || (parts.length === 1 && parts[0] === ALL_FORMS)) return '';
  const names = [];
  let level = categories || [];
  for (const part of parts) {
    const found = level.find((c) => slugOf(c.name) === part);
    if (!found) return null;
    names.push(found.name);
    level = found.items || [];
  }
  return names.join('/');
}

/**
 * A form's address.
 *
 * Args:
 *   name (string): the form's name ('Approval demo').
 *
 * Returns:
 *   string: /form/<its name in the address> (/form/approval-demo).
 */
export function formPath(name) {
  return `/form/${slugOf(name)}`;
}

/**
 * The form an address names, by the names of the forms the user may open.
 *
 * Args:
 *   slug (string): the address after /form/ ('approval-demo').
 *   forms (Array): the forms, each { name } (the forms list, /api/v2/config/formlist).
 *
 * Returns:
 *   string|null: the form's name ('Approval demo'), its exact name first when two forms
 *     read the same in an address ('Test 1', 'test-1') ; null when no form has it.
 */
export function formFromPath(slug, forms) {
  // /form/Approval-Demo or /form/Approval demo is /form/approval-demo
  const named = (forms || []).filter((f) => slugOf(f.name) === slugOf(slug));
  if (!named.length) return null;
  return (named.find((f) => f.name === slug) || named[0]).name;
}
