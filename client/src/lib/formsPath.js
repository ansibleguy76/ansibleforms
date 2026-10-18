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
 * A category's or a form's name as it read in an address up to 7.2.
 *
 * Args:
 *   name (string): the name ('Straße').
 *
 * Returns:
 *   string: the 7.2 slug : lower case, accents dropped, every run of characters other than a
 *     Latin letter or a digit a dash, none at either end ('stra-e') ; empty for a name without
 *     any of them ('日本語').
 *
 * slugOf keeps every letter now (ß, ł, ø, æ, đ, ı, any script) and reads a percent-encoded
 * name back first, so some names have another address than they had : a bookmark or a link
 * written before still names its form or category through this, the address it had then.
 */
export function legacySlugOf(name) {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Whether an address names a name, as it reads in an address now.
 *
 * Args:
 *   name (string): the form's or category's name ('Network Ops').
 *   slug (string): the part of the address ('network-ops', 'Network Ops').
 *
 * Returns:
 *   boolean: true when both read the same in an address.
 */
export function slugMatches(name, slug) {
  return slugOf(name) === slugOf(slug);
}

/**
 * Whether an address names a name the way a 7.2 address did (legacySlugOf).
 *
 * Args:
 *   name (string): the form's or category's name ('Straße').
 *   slug (string): the part of the address ('stra-e').
 *
 * Returns:
 *   boolean: true when the address is the name's 7.2 address ; never for a name that had
 *     none (no Latin letter or digit : every such name had the same, empty, address).
 */
export function legacySlugMatches(name, slug) {
  const legacy = legacySlugOf(name);
  return !!legacy && legacy === slugOf(slug);
}

/**
 * The item an address names, among items that have a name : the address of today first, the
 * one of 7.2 next, so an older bookmark still opens what it named.
 *
 * Args:
 *   slug (string): the part of the address ('approval-demo', 'Approval demo', 'stra-e').
 *   items (Array): the items, each with a name ({ name }, { id, name }).
 *
 * Returns:
 *   object|undefined: the item whose name is exactly the address, else the first whose name
 *     reads as the address now, else the first whose name read as it in 7.2 ; undefined when
 *     no item has that address.
 */
export function findBySlug(slug, items) {
  const list = (items || []).filter((x) => x && x.name !== undefined && x.name !== null);
  const named = list.filter((x) => slugMatches(x.name, slug));
  if (named.length) return named.find((x) => x.name === slug) || named[0];
  return list.find((x) => legacySlugMatches(x.name, slug));
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
    // its address now, else the one it had in 7.2 (a bookmark from then)
    const found = findBySlug(part, level);
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
 *     read the same in an address ('Test 1', 'test-1'), then the form whose 7.2 address it is
 *     (legacySlugOf) ; null when no form has it.
 */
export function formFromPath(slug, forms) {
  // /form/Approval-Demo or /form/Approval demo is /form/approval-demo ; a 7.2 address
  // (/form/stra-e for Straße) still opens its form
  return findBySlug(slug, forms)?.name ?? null;
}
