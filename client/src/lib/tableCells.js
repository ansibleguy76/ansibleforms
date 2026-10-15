/******************************************************************/
/*                                                                */
/*  The cells of the tables : the colours of a pill, as Bootstrap  */
/*  classes (styled by styles/tables.scss, .af-pill), the width   */
/*  a column needs for its header, and a column's width set with  */
/*  the mouse (its header's separator dragged).                   */
/*                                                                */
/******************************************************************/

// an empty cell of every table : an en dash, so a blank never reads as a cell not drawn yet
export const EMPTY_CELL = '–';

/**
 * A cell's html, or the en dash of an empty cell : every table draws its cells through it.
 *
 * Args:
 *   html (string|null|undefined): the cell's html, escaped already.
 *
 * Returns:
 *   string: the html, or EMPTY_CELL when it is empty (or only spaces).
 */
export function orEmpty(html) {
  const s = html == null ? '' : String(html);
  return s.trim() === '' ? EMPTY_CELL : s;
}

// the colours of a pill : solid, white text and no border (styles/tables.scss) - the theme
// turns Bootstrap's bg-* into pale tints, so the pills have their own
export const PILL = {
  blue: 'af-pill-blue',
  amber: 'af-pill-amber',
  orange: 'af-pill-orange',
  // a repository not pushed : the designer's push button's orange
  unpushed: 'af-pill-unpushed',
  green: 'af-pill-green',
  red: 'af-pill-red',
  cyan: 'af-pill-cyan',
  grey: 'af-pill-grey',
  light: 'text-bg-light fw-normal',
};

/**
 * A pill of the shared tables, as markup : the one place its markup is written, so every pill
 * (a status, a state, a type) looks the same.
 *
 * Args:
 *   color (string): its colour, one of PILL (grey when none).
 *   label (string): its text, escaped here.
 *   title (string): its tooltip, escaped here (optional).
 *
 * Returns:
 *   string: the pill's HTML.
 */
export function pill(color, label, title = '') {
  const tip = title ? ` title="${esc(title)}"` : '';
  return `<span class="badge rounded-pill fw-semibold af-pill ${color || PILL.grey}"${tip}><span class="af-pill-label">${esc(label)}</span></span>`;
}

/**
 * A value escaped for HTML, for a cell or a label built as markup.
 *
 * Args:
 *   value (any): the value.
 *
 * Returns:
 *   string: its text, with & < > " ' escaped.
 */
export function esc(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

/**
 * The width a column needs to show its header whole : the header measured in a hidden
 * table's header cell, in the table's own font and capitals, with room for its sort icon.
 *
 * Args:
 *   label (string): the header.
 *   sortable (boolean): it has a sort icon after it.
 *   fallback (string): the width when nothing can be measured (no document, no layout).
 *   end (boolean): a right-aligned column (a count) : measured with the room such a column
 *     keeps from its neighbours (styles/tables.scss), so that room does not cut its header.
 *
 * Returns:
 *   string: a CSS width, in px.
 */
export function headerWidth(label, sortable = true, fallback = '8rem', end = false) {
  if (typeof document === 'undefined' || !document.body) return fallback;
  // ------------------------------------------------------------------
  // Step 1 : the header in a header cell of a hidden table, as the lists show it
  // ------------------------------------------------------------------
  const table = document.createElement('table');
  table.className = 'table table-sm mb-0 bs-dt-table af-table';
  table.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:0;width:auto';
  const icon = sortable ? '<span class="ms-1" style="font-size:0.7em;display:inline-block;width:1em"></span>' : '';
  // a right-aligned column between another one and a text column : both its paddings widened
  const th = `<th class="${end ? 'text-end' : ''}" data-measure style="white-space:nowrap">${esc(label)}${icon}</th>`;
  table.innerHTML = end
    ? `<thead><tr><th class="text-end"></th>${th}<th></th></tr></thead>`
    : `<thead><tr>${th}</tr></thead>`;
  document.body.appendChild(table);
  // ------------------------------------------------------------------
  // Step 2 : its width, padding included, and 10px of slack : the real sort icon is wider than
  // the room kept for it here, and fonts differ a little between systems
  // ------------------------------------------------------------------
  const width = table.querySelector('th[data-measure]').getBoundingClientRect().width;
  table.remove();
  return width > 0 ? `${Math.ceil(width) + 10}px` : fallback;
}

/**
 * The width a column of pills needs : its widest pill (the app's .af-pill, as AppStatusPill
 * draws it) and the cell's padding, so a language with short labels gets a narrow column.
 *
 * Args:
 *   labels (string[]): every label the column may show, in the language shown.
 *   padding (number): the cell's left and right padding together, in px.
 *   fallback (string): the width when nothing can be measured (no document).
 *
 * Returns:
 *   string: a CSS width in px.
 */
export function pillWidth(labels, padding, fallback = '10rem') {
  if (typeof document === 'undefined' || !document.body) return fallback;
  const box = document.createElement('div');
  box.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:0;white-space:nowrap';
  box.innerHTML = labels
    .map(
      (l) => `<span class="badge rounded-pill fw-semibold af-pill"><span class="af-pill-label">${esc(l)}</span></span>`,
    )
    .join('<br>');
  document.body.appendChild(box);
  const widest = Math.max(0, ...[...box.querySelectorAll('.af-pill')].map((el) => el.getBoundingClientRect().width));
  box.remove();
  // a little slack : fonts differ a little between systems
  return widest > 0 ? `${Math.ceil(widest + padding) + 4}px` : fallback;
}

/**
 * A width in px, from a CSS width in px (headerWidth's).
 *
 * Args:
 *   width (string): '123px'.
 *
 * Returns:
 *   number: 123 ; 128 when it is not in px.
 */
export function pxOf(width) {
  return parseInt(width, 10) || 128;
}

/**
 * The width the widest of some cells needs in a table : each measured in a hidden cell of a table
 * like the lists', in its font and padding - as text, or as the html a column renders (a pill, a
 * badge : their own padding counted).
 *
 * Args:
 *   values (string[]): the cells, as the table shows them.
 *   html (boolean): the values are html (a column's render, escaped by it), not text.
 *
 * Returns:
 *   number: the widest one's width, in px (0 when nothing can be measured).
 */
export function widestCell(values, html = false) {
  if (typeof document === 'undefined' || !document.body) return 0;
  const table = document.createElement('table');
  table.className = 'table table-sm mb-0 bs-dt-table af-table';
  table.style.cssText = 'position:absolute;visibility:hidden;left:-9999px;top:0;width:auto';
  table.innerHTML = '<tbody><tr><td style="white-space:nowrap"></td></tr></tbody>';
  document.body.appendChild(table);
  const td = table.querySelector('td');
  let widest = 0;
  // each text once ; a few hundred at most (a list's page or its filtered rows)
  for (const value of [...new Set(values)].slice(0, 500)) {
    if (html) td.innerHTML = value;
    else td.textContent = value;
    widest = Math.max(widest, td.getBoundingClientRect().width);
  }
  table.remove();
  return Math.ceil(widest);
}

// ─── a column's width set with the mouse ─────────────────────────────────────
// Every table laid out by v-fit-columns (directives/fitColumns.js) : the separator at a header's
// right edge dragged to resize its column (styles/tables.scss, .af-col-grip), double-clicked to give
// it back its own width. The width is kept in this browser, per page and column (its header).

// how near a header's right edge the pointer grabs its separator, in px
const GRIP = 6;
// the least a column is dragged to, in px
const MIN_DRAG = 40;
const STORE = 'af-col-widths:';

/**
 * Where a table's widths are kept : its data-fit-id, else the page (its first two path parts, so
 * every record's page shares one).
 *
 * Args:
 *   table (HTMLTableElement): the table.
 *
 * Returns:
 *   string: the localStorage key.
 */
function storeKey(table) {
  const id = table.getAttribute('data-fit-id');
  if (id) return STORE + id;
  return STORE + window.location.pathname.split('/').filter(Boolean).slice(0, 2).join('/');
}

/**
 * The widths set with the mouse for a table's page : its columns' headers -> px.
 *
 * Args:
 *   table (HTMLTableElement): the table.
 *
 * Returns:
 *   object: the widths ; {} when none, or the browser keeps nothing.
 */
export function columnWidths(table) {
  try {
    const kept = JSON.parse(localStorage.getItem(storeKey(table)) || '{}');
    return kept && typeof kept === 'object' ? kept : {};
  } catch {
    return {};
  }
}

/**
 * Keeps a column's width set with the mouse, or forgets it.
 *
 * Args:
 *   table (HTMLTableElement): the table.
 *   label (string): the column's header.
 *   width (number|null): px, or null to give it back its own width.
 */
export function keepColumnWidth(table, label, width) {
  const widths = columnWidths(table);
  if (width == null) delete widths[label];
  else widths[label] = Math.round(width);
  try {
    if (Object.keys(widths).length) localStorage.setItem(storeKey(table), JSON.stringify(widths));
    else localStorage.removeItem(storeKey(table));
  } catch {
    // a browser keeping nothing : the width lasts until the page is left
  }
}

/**
 * A column's header, as its width is kept by : its text, on one line.
 *
 * Args:
 *   th (HTMLTableCellElement): the header.
 *
 * Returns:
 *   string: the label ; '' for a column without one.
 */
export function columnLabel(th) {
  return (th?.textContent || '').trim().replace(/\s+/g, ' ');
}

/**
 * The column whose separator is under the pointer : a header's right edge, or the left edge of the
 * one after it.
 *
 * Args:
 *   table (HTMLTableElement): the table.
 *   event (PointerEvent|MouseEvent): the pointer.
 *   canResize (function): (index) => whether that column can be resized.
 *
 * Returns:
 *   number: the column, or -1.
 */
function gripAt(table, event, canResize) {
  const row = table.tHead?.rows[0];
  const th = event.target?.closest?.('th');
  if (!row || !th || th.parentElement !== row) return -1;
  const rect = th.getBoundingClientRect();
  let index = th.cellIndex;
  if (event.clientX < rect.left + GRIP) index -= 1;
  else if (event.clientX < rect.right - GRIP) return -1;
  return index >= 0 && canResize(index) ? index : -1;
}

/**
 * Lets a table's columns be resized with the mouse : a separator dragged, double-clicked to reset.
 *
 * Args:
 *   table (HTMLTableElement): the table.
 *   options (object): canResize (index) => whether a column can be ; onResize () => called when a
 *     width changed (the table laid out again).
 *
 * Returns:
 *   function: removes the listeners (the table unmounted).
 */
export function columnResizer(table, { canResize, onResize }) {
  let drag = null;
  const hover = (event) => {
    if (!drag) table.classList.toggle('af-col-grip', gripAt(table, event, canResize) >= 0);
  };
  const leave = () => {
    if (!drag) table.classList.remove('af-col-grip');
  };
  const down = (event) => {
    if (event.button !== 0) return;
    const index = gripAt(table, event, canResize);
    if (index < 0) return;
    const th = table.tHead.rows[0].cells[index];
    event.preventDefault();
    drag = { label: columnLabel(th), x: event.clientX, width: th.getBoundingClientRect().width, moved: false };
    table.classList.add('af-col-resizing');
  };
  const move = (event) => {
    if (!drag) return;
    // the pointer held by the table once it moves : not before, or a double click would land on
    // the table, not on the header it resets
    if (!drag.moved && Math.abs(event.clientX - drag.x) > 2) {
      drag.moved = true;
      table.setPointerCapture?.(event.pointerId);
    }
    if (!drag.moved) return;
    keepColumnWidth(table, drag.label, Math.max(MIN_DRAG, drag.width + event.clientX - drag.x));
    onResize();
  };
  const up = (event) => {
    if (!drag) return;
    if (drag.moved) table.releasePointerCapture?.(event.pointerId);
    table.classList.remove('af-col-resizing');
    // the click on a separator (a drag, or one of a double click's) : never a sort
    const swallow = (click) => {
      click.stopPropagation();
      click.preventDefault();
    };
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
    drag = null;
  };
  // a double click on a separator : the column back to its own width
  const reset = (event) => {
    const index = gripAt(table, event, canResize);
    if (index < 0) return;
    event.preventDefault();
    event.stopPropagation();
    keepColumnWidth(table, columnLabel(table.tHead.rows[0].cells[index]), null);
    onResize();
  };
  const listeners = [
    ['pointermove', hover],
    ['pointerleave', leave],
    ['pointerdown', down],
    ['pointermove', move],
    ['pointerup', up],
    ['pointercancel', up],
    ['dblclick', reset],
  ];
  for (const [type, handler] of listeners) table.addEventListener(type, handler);
  return () => {
    for (const [type, handler] of listeners) table.removeEventListener(type, handler);
  };
}
