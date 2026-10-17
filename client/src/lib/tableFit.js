/******************************************************************/
/*                                                                */
/*  How many rows a table shows by default : the largest of the   */
/*  pager's sizes that (nearly) fits the screen under its header, */
/*  its pager in view or just under it (the smallest when none    */
/*  fits). A size the user picks in the pager wins over it        */
/*  (BsPagination keeps it in a cookie) ; until then the size     */
/*  follows the window.                                           */
/*                                                                */
/******************************************************************/

// never fewer rows than this, however short the window : a page of 2 rows is no list
export const FIT_MIN = 5;
// never more : the largest size the pager offers
export const FIT_MAX = 100;
// the room kept under the pager, as the page's own bottom padding
const BOTTOM_GAP = 16;
// a size is taken when the screen holds this share of its rows : room for 16 rows shows 20 (the
// pager a little under the fold) rather than 10 and half the screen empty
export const FIT_SHARE = 0.8;

/**
 * The rows that fit a height.
 *
 * Args:
 *   available (number): the height the rows may take, in px.
 *   rowHeight (number): one row's height, in px.
 *
 * Returns:
 *   number|null: the count, between FIT_MIN and FIT_MAX, or null without a row height.
 */
export function fitRowCount(available, rowHeight) {
  if (!(rowHeight > 0) || !Number.isFinite(available)) return null;
  return Math.min(FIT_MAX, Math.max(FIT_MIN, Math.floor(available / rowHeight)));
}

/**
 * The page size for the rows that fit : the largest size offered whose rows the screen nearly
 * holds (FIT_SHARE of them : 16 rows of room for 20), else the smallest. A size of its own (18)
 * would be one the pager does not offer.
 *
 * Args:
 *   count (number): the rows that fit.
 *   sizes (number[]): the sizes offered, smallest first.
 *
 * Returns:
 *   number: one of the sizes.
 */
export function fitSize(count, sizes) {
  return sizes.filter((size) => size * FIT_SHARE <= count).pop() ?? sizes[0];
}

/**
 * The size offered nearest to one saved before : a size no longer offered (25) becomes the closest
 * (20), the smaller on a tie.
 *
 * Args:
 *   size (number): the size saved.
 *   sizes (number[]): the sizes offered, smallest first.
 *
 * Returns:
 *   number: one of the sizes.
 */
export function nearestSize(size, sizes) {
  return sizes.reduce((best, s) => (Math.abs(s - size) < Math.abs(best - size) ? s : best), sizes[0]);
}

/**
 * The usual height of some rows : their median, the upper one of the middle two for an even count.
 *
 * Args:
 *   heights (number[]): the rows' heights, in px.
 *
 * Returns:
 *   number: the median height, 0 for none.
 */
export function typicalHeight(heights) {
  if (!heights.length) return 0;
  const sorted = [...heights].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * The element a table scrolls in : its nearest ancestor that scrolls, else none (the window).
 *
 * Args:
 *   el (Element): the table.
 *
 * Returns:
 *   Element|null: the scrolling ancestor, or null for the window.
 */
function scrollParent(el) {
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === 'auto' || overflow === 'scroll') return node;
  }
  return null;
}

/**
 * The table a pager pages : the last table before it in the page. The pager may sit under the
 * page's card (teleported out of the table's component), so it is found by order, not nesting.
 *
 * Args:
 *   pager (Element): the pager's element.
 *
 * Returns:
 *   HTMLTableElement|null: the table, or null when none comes before it.
 */
export function pagedTable(pager) {
  let found = null;
  for (const table of document.querySelectorAll('table')) {
    if (table.compareDocumentPosition(pager) & Node.DOCUMENT_POSITION_FOLLOWING) found = table;
  }
  return found;
}

/**
 * The rows that fit the screen for a pager's table, measured on the page as it is : from the top
 * of the table's rows to the bottom of what it scrolls in, less the pager under it.
 *
 * Args:
 *   pager (Element): the pager's element (its block : the range and the page boxes).
 *
 * Returns:
 *   number|null: the count, or null when the table shows no row to measure yet.
 */
export function measureFit(pager) {
  if (!pager) return null;
  const table = pagedTable(pager);
  const body = table?.tBodies?.[0];
  const rows = body ? [...body.rows].slice(0, 5) : [];
  if (!rows.length) return null;
  // the usual height of the first rows (their median) : one row whose text wraps (a note under it)
  // does not halve the page, as the others' height is what most of the page holds
  const rowHeight = typicalHeight(rows.map((r) => r.getBoundingClientRect().height));
  const scroller = scrollParent(table);
  const box = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
  const scrolled = scroller ? scroller.scrollTop : window.scrollY;
  const bodyRect = body.getBoundingClientRect();
  // where the rows start in the scrolled content, as if it were at its top
  const rowsTop = bodyRect.top - box.top + scrolled;
  // what comes under the rows down to the pager's bottom : the card's end and the pager itself
  const under = Math.max(0, pager.getBoundingClientRect().bottom - bodyRect.bottom);
  const available = box.bottom - box.top - rowsTop - under - BOTTOM_GAP;
  return fitRowCount(available, rowHeight);
}
