/******************************************************************/
/*                                                                */
/*  v-fit-columns : the tables of a record's page (its Users,     */
/*  Roles, Forms, Jobs... tabs) on one line per row. Each column  */
/*  is as wide as its longest cell ; when they do not all fit,    */
/*  the widest share what is left fairly and a cell too long for  */
/*  its column ends in "…", its whole text on hover. A checkbox   */
/*  or a row menu column keeps its own width, as a column with    */
/*  data-fit-keep (its width when it names one). When everything  */
/*  fits, the spacer column takes the room left : an empty        */
/*  <th class="af-fit-spacer"> and <td> after the last column     */
/*  with content (before a row menu) ; a table without one gives  */
/*  that room to its last column with content.                    */
/*                                                                */
/*  A column never grows past 50 characters : a longer value ends */
/*  in "…" and the spacer takes the room ; nor does one shrink    */
/*  below 12, nor below its header : too narrow a frame, the      */
/*  table grows past it and the frame scrolls sideways. A table   */
/*  can hand the widths it measured itself (data-fit-natural,     */
/*  BsDataTable over all its rows, not only the page shown).      */
/*                                                                */
/*  Measured again when the table's frame changes width and when  */
/*  its rows change (a tab's rows loaded, a row removed).         */
/*                                                                */
/******************************************************************/

// the columns that keep their own width : a row's checkbox, its menu
const FIXED = ['bs-dt-select', 'bs-dt-row-actions', 'af-row-menu-col', 'af-jobs-select', 'af-expand-col'];
// the most a column that fits its values grows to, in characters of its font : a longer value
// (a description) ends in "…", the room left goes to the spacer
const CAP_CHARS = 50;
// the least a column that gives way shrinks to, in characters : below it the table gets wider than
// its frame, which scrolls sideways, rather than cutting a value to a letter or two
const MIN_CHARS = 12;
// the letters a character's average width is taken from
const SAMPLE = 'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789';
let measureContext = null;

/**
 * The width of some characters in a table's cells, their padding included.
 *
 * Args:
 *   table (HTMLTableElement): the table.
 *   chars (number): how many characters (CAP_CHARS, MIN_CHARS).
 *
 * Returns:
 *   number: the width, in px ; Infinity when it cannot be measured (no cap).
 */
function capWidth(table, chars = CAP_CHARS) {
  const cell = table.tBodies[0]?.rows[0]?.cells[0] || table;
  const style = getComputedStyle(cell);
  measureContext = measureContext || document.createElement('canvas').getContext('2d');
  if (!measureContext) return Infinity;
  measureContext.font = style.font;
  const perChar = measureContext.measureText(SAMPLE).width / SAMPLE.length;
  const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
  return perChar > 0 ? Math.ceil(perChar * chars + padding) : Infinity;
}

/**
 * Whether a column keeps its own width : its header asks to (data-fit-keep), or it or its first
 * row's cell is a checkbox or a row menu.
 *
 * Args:
 *   table (HTMLTableElement): the table.
 *   index (number): the column.
 *
 * Returns:
 *   boolean: true for a fixed column.
 */
function isFixed(table, index) {
  // a column asking to keep its width (a date, a status : never cut)
  if (table.tHead?.rows[0]?.cells[index]?.hasAttribute('data-fit-keep')) return true;
  return isControl(table, index);
}

/**
 * Whether a column is a row's checkbox or its menu : its header or its first row's cell says so.
 *
 * Args:
 *   table (HTMLTableElement): the table.
 *   index (number): the column.
 *
 * Returns:
 *   boolean: true for a checkbox or a menu column.
 */
function isControl(table, index) {
  const th = table.tHead?.rows[0]?.cells[index];
  // the spacer : no content, it takes the room left (or none)
  if (th?.classList.contains('af-fit-spacer')) return true;
  const td = table.tBodies[0]?.rows[0]?.cells[index];
  return [th, td].some((cell) => cell && FIXED.some((c) => cell.classList.contains(c)));
}

/**
 * The widths of the flexible columns in the room there is : each its natural width when they
 * all fit ; else the narrow ones whole and the wide ones sharing what is left equally.
 *
 * Args:
 *   natural (number[]): the columns' natural widths, in px.
 *   room (number): the width they share, in px.
 *
 * Returns:
 *   number[]|null: the widths, in px ; null when they all fit (the last one then takes the rest).
 */
export function shareWidths(natural, room) {
  const total = natural.reduce((a, b) => a + b, 0);
  if (total <= room) return null;
  const widths = new Array(natural.length);
  const order = natural.map((w, i) => i).sort((a, b) => natural[a] - natural[b]);
  let left = Math.max(0, room);
  for (let k = 0; k < order.length; k++) {
    const share = left / (order.length - k);
    const i = order[k];
    if (natural[i] <= share) {
      widths[i] = natural[i];
      left -= natural[i];
    } else {
      // this one and every wider one : an equal share of what is left
      for (let m = k; m < order.length; m++) widths[order[m]] = Math.floor(share);
      break;
    }
  }
  return widths;
}

/**
 * A CSS width in px : px as they are, rem at the page's font size ; 0 for none or another unit.
 *
 * Args:
 *   width (string|null): the width (13.25rem, 120px).
 *
 * Returns:
 *   number: px.
 */
function pxOf(width) {
  const n = parseFloat(width);
  if (!Number.isFinite(n)) return 0;
  if (String(width).endsWith('rem')) return n * parseFloat(getComputedStyle(document.documentElement).fontSize || '16');
  if (String(width).endsWith('px')) return n;
  return 0;
}

/**
 * Lays a table out : measures its columns at their natural width, then gives them their widths.
 *
 * Args:
 *   table (HTMLTableElement): the table.
 */
function fit(table) {
  const frame = table.parentElement;
  const ths = table.tHead?.rows[0]?.cells;
  if (!table.isConnected || !frame || !ths?.length) return;
  // their natural widths : the table laid out freely, one line per cell
  for (const th of ths) th.style.width = '';
  table.style.tableLayout = 'auto';
  table.style.width = 'max-content';
  // a spacer has no width of its own : it only takes the room left ; a column kept at a width
  // it names (data-fit-keep="13.25rem") has that one
  const natural = [...ths].map((th) => {
    if (th.classList.contains('af-fit-spacer')) return 0;
    // a row's menu : 3.5rem in every table, as BsDataTable's lists (styles/tables.scss)
    if (th.classList.contains('af-row-menu-col')) return pxOf('3.5rem');
    // a caret's column : 1.75rem, as the jobs list's (styles/tables.scss)
    if (th.classList.contains('af-expand-col')) return pxOf('1.75rem');
    // a width measured by the table itself over all its rows, not only the page shown
    // (BsDataTable : the columns keep their width from one page to the next)
    if (th.hasAttribute('data-fit-natural')) return parseFloat(th.getAttribute('data-fit-natural')) || 0;
    return pxOf(th.getAttribute('data-fit-keep')) || Math.ceil(th.getBoundingClientRect().width);
  });
  // each header in full : its label, its sort icon and its padding - no column narrower
  const headers = [...ths].map((th) => {
    const range = document.createRange();
    range.selectNodeContents(th);
    const style = getComputedStyle(th);
    return Math.ceil(
      range.getBoundingClientRect().width +
        (parseFloat(style.paddingLeft) || 0) +
        (parseFloat(style.paddingRight) || 0),
    );
  });
  table.style.width = '100%';
  table.style.tableLayout = 'fixed';

  const fixed = natural.map((_, i) => isFixed(table, i));
  const flex = natural.map((_, i) => i).filter((i) => !fixed[i]);
  // no column that fits its values wider than CAP_CHARS characters : a longer value is cut
  const cap = capWidth(table);
  for (const i of flex) natural[i] = Math.min(natural[i], cap);
  // the room they share : the frame's width less the fixed columns'
  const width = frame.clientWidth;
  const room = width - natural.reduce((sum, w, i) => sum + (fixed[i] ? w : 0), 0);
  let shared = shareWidths(
    flex.map((i) => natural[i]),
    room,
  );
  // never narrower than MIN_CHARS characters (or its own width when less), nor than its header :
  // too narrow a frame, the table grows past it and the frame scrolls sideways (.af-table-frame)
  if (shared) {
    const least = capWidth(table, MIN_CHARS);
    shared = shared.map((w, k) => Math.max(w, Math.min(natural[flex[k]], least), headers[flex[k]]));
    const total = natural.reduce((sum, w, i) => sum + (fixed[i] ? w : 0), 0) + shared.reduce((a, b) => a + b, 0);
    table.style.width = total > width ? `${total}px` : '100%';
  }
  // all fit : each its own width, and the room left to the last column with content (a kept one
  // too : a duration at the far right) ; not to a checkbox or a row menu
  const content = natural.map((_, i) => i).filter((i) => !isControl(table, i));
  const spacer = natural.findIndex((_, i) => ths[i].classList.contains('af-fit-spacer'));
  const takesRest = shared ? -1 : spacer >= 0 ? spacer : content[content.length - 1];
  natural.forEach((w, i) => {
    if (fixed[i]) ths[i].style.width = i === takesRest ? '' : `${w}px`;
  });
  flex.forEach((col, k) => {
    if (!shared) ths[col].style.width = col === takesRest ? '' : `${natural[col]}px`;
    else ths[col].style.width = `${shared[k]}px`;
  });

  // a cell cut short : its whole text on hover (a title it already has of its own is kept)
  for (const cell of table.querySelectorAll('th, td')) {
    const cut = cell.scrollWidth > cell.clientWidth + 1;
    if (cut && (!cell.title || cell.dataset.fitTitle)) {
      cell.title = cell.textContent.trim().replace(/\s+/g, ' ');
      cell.dataset.fitTitle = '1';
    } else if (!cut && cell.dataset.fitTitle) {
      cell.removeAttribute('title');
      delete cell.dataset.fitTitle;
    }
  }
}

/**
 * Lays the table out at the next frame, once however often it is asked.
 *
 * Args:
 *   table (HTMLTableElement): the table.
 */
function schedule(table) {
  if (table._fitFrame) return;
  table._fitFrame = requestAnimationFrame(() => {
    table._fitFrame = null;
    fit(table);
  });
}

export default {
  mounted(table) {
    table.classList.add('af-fit');
    schedule(table);
    // its frame wider or narrower (the window, the sidebar)
    if (typeof ResizeObserver !== 'undefined' && table.parentElement) {
      let width = table.parentElement.clientWidth;
      table._fitObserver = new ResizeObserver(() => {
        const now = table.parentElement?.clientWidth;
        if (now !== width) {
          width = now;
          schedule(table);
        }
      });
      table._fitObserver.observe(table.parentElement);
    }
  },
  // its rows changed ; a table that gives a key (v-fit-columns="key") only when its key did, so
  // a page that redraws every second (a running job's duration) is not measured every second
  updated(table, binding) {
    if (binding.value !== undefined && binding.value === binding.oldValue) return;
    schedule(table);
  },
  unmounted(table) {
    table._fitObserver?.disconnect();
    if (table._fitFrame) cancelAnimationFrame(table._fitFrame);
  },
};
