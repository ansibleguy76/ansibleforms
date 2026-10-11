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
/*  Measured again when the table's frame changes width and when  */
/*  its rows change (a tab's rows loaded, a row removed).         */
/*                                                                */
/******************************************************************/

// the columns that keep their own width : a row's checkbox, its menu
const FIXED = [
  'bs-dt-select',
  'bs-dt-row-actions',
  'af-role-remove-col',
  'af-group-menu-col',
  'af-jobs-select',
  'action',
];
// the air after a column that gives way when everything fits, in px (2rem)
const AIR = 32;

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
    return pxOf(th.getAttribute('data-fit-keep')) || Math.ceil(th.getBoundingClientRect().width);
  });
  table.style.width = '100%';
  table.style.tableLayout = 'fixed';

  const fixed = natural.map((_, i) => isFixed(table, i));
  const flex = natural.map((_, i) => i).filter((i) => !fixed[i]);
  // the table's width : its frame's, or its own minimum when it has one (the jobs list scrolls
  // sideways in its frame below it)
  const width = Math.max(frame.clientWidth, parseFloat(getComputedStyle(table).minWidth) || 0);
  const room = width - natural.reduce((sum, w, i) => sum + (fixed[i] ? w : 0), 0);
  const shared = shareWidths(
    flex.map((i) => natural[i]),
    room,
  );
  // all fit : each its own width, and the room left to the last column with content (a kept one
  // too : a duration at the far right) ; not to a checkbox or a row menu
  const content = natural.map((_, i) => i).filter((i) => !isControl(table, i));
  const spacer = natural.findIndex((_, i) => ths[i].classList.contains('af-fit-spacer'));
  const takesRest = shared ? -1 : spacer >= 0 ? spacer : content[content.length - 1];
  natural.forEach((w, i) => {
    if (fixed[i]) ths[i].style.width = i === takesRest ? '' : `${w}px`;
  });
  // and, when the room allows, a little air after the columns that give way (a form's name)
  const used = natural.reduce((a, b) => a + b, 0);
  const air = !shared && used + AIR * flex.length <= width ? AIR : 0;
  flex.forEach((col, k) => {
    if (!shared) ths[col].style.width = col === takesRest ? '' : `${natural[col] + air}px`;
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
