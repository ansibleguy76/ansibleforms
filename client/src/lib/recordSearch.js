/******************************************************************/
/*                                                                */
/*  recordSearch : the text a record page's search looks for, in  */
/*  words and in a table's cells. A row matches by what its table */
/*  shows (AppLinkedTable's cells), never by its raw values : an  */
/*  id or a flag the table does not show would keep a row nobody  */
/*  can see the word in.                                          */
/*                                                                */
/******************************************************************/
import { htmlToText } from '@/lib/dataTable';

/**
 * A cell's plain text : its column's html() without the tags, its value(), or its field, as
 * AppLinkedTable shows and filters it.
 *
 * Args:
 *   col (object): the column.
 *   row (object): the item.
 *
 * Returns:
 *   string: the text, empty for none.
 */
export function cellText(col, row) {
  const v = col.html ? htmlToText(col.html(row)) : col.value ? col.value(row) : row?.[col.key];
  return v === null || v === undefined ? '' : String(v);
}

/**
 * Whether one of the texts has the query, ignoring case ; an empty query keeps everything.
 *
 * Args:
 *   query (string): the word searched (trimmed here).
 *   texts (Array): the texts (any value : null and undefined are empty).
 *
 * Returns:
 *   boolean: whether one of them has it.
 */
export function textsMatch(query, texts) {
  const q = String(query ?? '')
    .trim()
    .toLowerCase();
  return (
    !q ||
    texts.some((x) =>
      String(x ?? '')
        .toLowerCase()
        .includes(q),
    )
  );
}

/**
 * Whether a table keeps a row : one of its cells (cellText) with the query, as AppLinkedTable
 * filters them.
 *
 * Args:
 *   query (string): the word searched.
 *   rows (object[]): the table's rows.
 *   columns (object[]): its columns.
 *
 * Returns:
 *   boolean: whether some row matches.
 */
export function tableMatches(query, rows, columns) {
  return (rows || []).some((row) =>
    textsMatch(
      query,
      (columns || []).map((c) => cellText(c, row)),
    ),
  );
}

export default { cellText, textsMatch, tableMatches };
