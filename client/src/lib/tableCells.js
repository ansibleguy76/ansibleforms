/******************************************************************/
/*                                                                */
/*  The cells of the tables : the colours of a pill, as Bootstrap  */
/*  classes (styled by styles/tables.scss, .af-pill), and the     */
/*  width a column needs for its header.                          */
/*                                                                */
/******************************************************************/

// the colours of a pill : solid, white text and no border (styles/tables.scss) - the theme
// turns Bootstrap's bg-* into pale tints, so the pills have their own
export const PILL = {
  blue: 'af-pill-blue',
  amber: 'af-pill-amber',
  orange: 'af-pill-orange',
  green: 'af-pill-green',
  red: 'af-pill-red',
  cyan: 'af-pill-cyan',
  grey: 'af-pill-grey',
  light: 'text-bg-light fw-normal',
};

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
