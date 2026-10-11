/******************************************************************/
/*                                                                */
/*  usePagedRows : the rows of the page shown, for a record       */
/*  page's hand-written tables (a user's Groups, a role's Users)  */
/*  under which an AppTablePager is put. Kept per table, so a     */
/*  tab's rows never show another tab's page.                     */
/*                                                                */
/******************************************************************/
import { ref } from 'vue';

/**
 * The page of each table of a page.
 *
 * Returns:
 *   object: { paged, setPaged } - paged(key, rows) the rows of the page shown of the table key
 *     (its first 25 until its pager says) ; setPaged(key, rows) what its pager says.
 */
export function usePagedRows() {
  const pages = ref({});

  /**
   * The rows of the page shown of a table.
   *
   * Args:
   *   key (string): the table (groups, roles...).
   *   rows (Array): all its rows.
   *
   * Returns:
   *   Array: the rows of its page.
   */
  function paged(key, rows) {
    return pages.value[key] ?? rows.slice(0, 25);
  }

  /**
   * The rows of the page a table's pager shows (AppTablePager's change).
   *
   * Args:
   *   key (string): the table.
   *   rows (Array): the rows of its page.
   */
  function setPaged(key, rows) {
    pages.value = { ...pages.value, [key]: rows };
  }

  return { paged, setPaged };
}
