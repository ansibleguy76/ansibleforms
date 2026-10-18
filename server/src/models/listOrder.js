/******************************************************************/
/*                                                                */
/*  The order of the records a list shows with Move up and Move   */
/*  down on each row : the labels beside the logo (Settings >     */
/*  Appearance > Labels) and the LDAP directories, in the order a */
/*  bare username is looked up in (Settings > Access > LDAP).     */
/*  One rule for both : the first and the last said, and a move   */
/*  that swaps a record with its neighbour and numbers them all   */
/*  again 1, 2, 3... in one transaction, so the order never has   */
/*  two at one place nor is written by halves.                    */
/*                                                                */
/******************************************************************/
import mysql from "./db.model.js";
import Errors from "../lib/errors.js";

// the tables whose rows are ordered by a position column : only these are written (the name
// goes into the statement, never a value a request chose)
const ORDERED_TABLES = ["labels", "ldap"];

/**
 * A list as its page shows it : each record saying whether it is the first or the last (its
 * row's Move up and Move down).
 *
 * Args:
 *   list (object[]): the records, in their order.
 *
 * Returns:
 *   object[]: copies of the records, each with isFirst and isLast.
 */
export function withEnds(list) {
  const all = list || [];
  return all.map((r, i) => ({ ...r, isFirst: i === 0, isLast: i === all.length - 1 }));
}

/**
 * Moves a record one place up or down : it and its neighbour swap places, every record then
 * numbered again 1, 2, 3... in one transaction.
 *
 * Args:
 *   table (string): the table ('labels' or 'ldap').
 *   rows (object[]): the records with their id, in their order now.
 *   id (number|string): the record moved.
 *   direction (string): 'up' (sooner) or 'down'.
 *   what (string): what a record is, for the errors ('label', 'directory').
 *
 * Returns:
 *   Promise<boolean>: true when it moved (false : already first going up, or last going down).
 *
 * Raises:
 *   Errors.BadRequestError: another direction.
 *   Errors.NotFoundError: no record has that id.
 *   Error: a table that is not ordered.
 */
export async function moveOneStep(table, rows, id, direction, what) {
  if (!ORDERED_TABLES.includes(table)) throw new Error(`The table '${table}' has no order to move in`);
  if (direction !== "up" && direction !== "down") {
    throw new Errors.BadRequestError(`A ${what} moves up or down: '${direction}' is not`);
  }
  const all = [...(rows || [])];
  const at = all.findIndex((r) => String(r.id) === String(id));
  if (at < 0) throw new Errors.NotFoundError(`No ${what} with id ${id}`);
  const to = direction === "up" ? at - 1 : at + 1;
  if (to < 0 || to >= all.length) return false;
  [all[at], all[to]] = [all[to], all[at]];
  await mysql.transaction(async (run) => {
    for (let i = 0; i < all.length; i++) {
      await run(`UPDATE AnsibleForms.\`${table}\` SET position = ? WHERE id = ?`, [i + 1, all[i].id]);
    }
  });
  return true;
}

export default { withEnds, moveOneStep };
