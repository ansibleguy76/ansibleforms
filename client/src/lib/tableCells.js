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
 * A column width that follows the table : a share of the room the other columns leave, never
 * more than a cap. A wide screen keeps the column at the cap (the table's spacer takes the
 * rest), a narrow one shrinks it, so the table never gets wider than its frame.
 *
 * Args:
 *   share (number): the share of the room left, 0 to 1 (the shared columns' together : 1 or less).
 *   cap (number): the most, in px.
 *   reserve (number): the px the other columns take (the checkbox, the counts, the row menu).
 *
 * Returns:
 *   Function: (tableWidth px) => a CSS width, for a BsDataTable column's width.
 */
export function shareUpTo(share, cap, reserve = 0) {
  return (tableWidth) => `${Math.round(Math.max(0, Math.min(cap, (tableWidth - reserve) * share)))}px`;
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
