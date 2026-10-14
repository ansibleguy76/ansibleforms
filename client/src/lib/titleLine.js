/******************************************************************/
/*                                                                */
/*  A page's title line (AppSettings) : the title and its         */
/*  controls (a table's search, its buttons, the page's own) on   */
/*  one line whenever they fit side by side with the search at    */
/*  its least - the search gives way before the controls move     */
/*  under the title. Measured, as CSS cannot weigh the title      */
/*  against the controls at their smallest and still let them    */
/*  wrap when they sit under it.                                  */
/*                                                                */
/******************************************************************/

// the class the title line takes when everything fits on one line (styles/bootstrap-override.scss)
const ONE_LINE = 'af-title-one-line';

/**
 * The flex items of the controls' box : its children, those laid out as their own children
 * (display: contents) looked through.
 *
 * Args:
 *   box (HTMLElement): the controls' box (.af-title-controls).
 *
 * Returns:
 *   HTMLElement[]: the items, in their order.
 */
function itemsOf(box) {
  const items = [];
  const walk = (el) => {
    for (const child of el.children) {
      if (getComputedStyle(child).display === 'contents') walk(child);
      else if (getComputedStyle(child).display !== 'none') items.push(child);
    }
  };
  walk(box);
  return items;
}

/**
 * The width a title's text and icons take on one line, whatever room it has now.
 *
 * Args:
 *   title (HTMLElement): the title (h3).
 *
 * Returns:
 *   number: px.
 */
function titleWidth(title) {
  const range = document.createRange();
  range.selectNodeContents(title);
  return Math.ceil(range.getBoundingClientRect().width);
}

/**
 * The least width of the controls side by side : a table's search at its min-width, every other
 * control as wide as it is, and the gaps between them.
 *
 * Args:
 *   box (HTMLElement): the controls' box.
 *
 * Returns:
 *   number: px ; 0 without controls.
 */
function controlsWidth(box) {
  const items = itemsOf(box);
  if (!items.length) return 0;
  const gap = parseFloat(getComputedStyle(box).columnGap) || 0;
  const widths = items.map((item) =>
    item.classList.contains('af-table-search')
      ? parseFloat(getComputedStyle(item).minWidth) || item.getBoundingClientRect().width
      : item.getBoundingClientRect().width,
  );
  return Math.ceil(widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1));
}

/**
 * Puts the title line on one line when the title and its controls fit side by side, the search
 * at its least ; else lets the controls move under the title, as they wrap.
 *
 * Args:
 *   line (HTMLElement): the title line (.af-title-line).
 */
export function fitTitleLine(line) {
  const title = line?.querySelector(':scope > h3');
  const box = line?.querySelector(':scope > .af-title-controls');
  if (!title || !box) {
    line?.classList.remove(ONE_LINE);
    return;
  }
  const gap = parseFloat(getComputedStyle(line).columnGap) || 0;
  const fits = titleWidth(title) + gap + controlsWidth(box) <= line.clientWidth;
  line.classList.toggle(ONE_LINE, fits);
}

/**
 * Keeps a title line fitted : when it changes width (the window, the sidebar) and when its
 * controls change (a table's toolbar moved in, a button shown).
 *
 * Args:
 *   line (HTMLElement): the title line.
 *
 * Returns:
 *   function: stops watching it.
 */
export function watchTitleLine(line) {
  if (!line) return () => {};
  let frame = null;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      fitTitleLine(line);
    });
  };
  const resized = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
  resized?.observe(line);
  const changed = typeof MutationObserver !== 'undefined' ? new MutationObserver(schedule) : null;
  changed?.observe(line, { childList: true, subtree: true, characterData: true });
  schedule();
  return () => {
    resized?.disconnect();
    changed?.disconnect();
    if (frame) cancelAnimationFrame(frame);
  };
}
