/******************************************************************/
/*                                                                */
/*  useRecordSearch : the search on a record's title line (a user,*/
/*  a runner, a credential) and on a settings page. A word typed  */
/*  narrows every tab at once : the fields whose label or help    */
/*  has it, the rows of the tables with it in one of their cells, */
/*  each under its tab's name, the tabs without it set aside.     */
/*                                                                */
/*  The page says which fields it has and what makes a tab match ;*/
/*  the rest (the word, the tabs shown, their heads) is this one, */
/*  where every page used to restate it.                          */
/*                                                                */
/******************************************************************/
import { ref, computed, unref } from 'vue';
import { textsMatch, tableMatches as rowsMatchTable } from '@/lib/recordSearch';

/**
 * A record page's search.
 *
 * Args:
 *   options (object, optional):
 *     search (Ref<string>, optional): the word, when the page already holds it (a v-model) ; a
 *       new one otherwise.
 *     tabs (Ref<object[]>|Function, optional): the page's tabs ({ key, label, icon }) ; a function
 *       when the page defines them after this call.
 *     activeTab (Ref<string>|Function, optional): the open tab, shown alone while nothing is
 *       searched (a function when the page defines it after this call).
 *     tabMatch (Function, optional): (key) => whether a tab has the word, read while searching ;
 *       it may use what the page defines after this call (it runs only when shown).
 *
 * Returns:
 *   object: {
 *     search (Ref<string>): the word typed,
 *     searching (computed): whether a word is typed,
 *     matches (...texts) => whether one of the texts has the word (all, without one),
 *     matchingKeys (fields) => the keys of the [key, ...texts] fields with the word,
 *     tableMatches (rows, columns) => whether a table keeps a row (by its shown cells),
 *     shownTabs (computed): the open tab, or while searching each tab with a match,
 *     tabShown (key) => whether a tab is shown,
 *     searchHead (key) => { tab, first } for a shown tab's name over its matches, or null,
 *   }.
 */
export function useRecordSearch({ search, tabs, activeTab, tabMatch } = {}) {
  // ------------------------------------------------------------------
  // the word, and whether one is typed
  // ------------------------------------------------------------------
  const word = search || ref('');
  const searching = computed(() => !!String(word.value ?? '').trim());

  // ------------------------------------------------------------------
  // the matches : texts, fields and table rows
  // ------------------------------------------------------------------
  const matches = (...texts) => textsMatch(word.value, texts);
  const matchingKeys = (fields) => fields.filter(([, ...texts]) => matches(...texts)).map(([key]) => key);
  const tableMatches = (rows, columns) => rowsMatchTable(word.value, rows, columns);

  // ------------------------------------------------------------------
  // the tabs shown : the active one, or while searching each one with a match
  // ------------------------------------------------------------------
  const read = (x) => (typeof x === 'function' ? x() : unref(x));
  const allTabs = () => read(tabs) || [];
  const shownTabs = computed(() =>
    searching.value
      ? allTabs().filter((tab) => (tabMatch ? tabMatch(tab.key) : true))
      : allTabs().filter((tab) => tab.key === read(activeTab)),
  );
  const tabShown = (key) => shownTabs.value.some((tab) => tab.key === key);
  // while searching, a tab's name over its matches (the first without the line above)
  const searchHead = (key) => {
    const i = shownTabs.value.findIndex((tab) => tab.key === key);
    return i < 0 ? null : { tab: shownTabs.value[i], first: i === 0 };
  };

  return { search: word, searching, matches, matchingKeys, tableMatches, shownTabs, tabShown, searchHead };
}

export default useRecordSearch;
