/******************************************************************/
/*                                                                */
/*  useSingleTab : a page of one tab (General on a settings page, */
/*  Details on a record's), so every settings page is a table or  */
/*  a page in tabs. The tab is kept in the address as any tab     */
/*  (useRouteTab), and named last in the title : Name › General.  */
/*                                                                */
/******************************************************************/
import { computed, unref } from 'vue';
import { useRouteTab } from '@/composables/useRouteTab';

/**
 * The single tab of a page, and the title's steps with it.
 *
 * Args:
 *   options (object):
 *     key (string): the tab's key in the address ('general', 'details').
 *     label (Function): its name, read when shown (the app's language can change).
 *     icon (string): its icon.
 *     pageCrumbs (Function): the title's steps before the tab ; their last links to the page.
 *
 * Returns:
 *   object: { tabs (computed, one tab), activeTab, crumbs (computed : the page's steps, then the
 *     tab) }.
 */
export function useSingleTab({ key, label, icon, pageCrumbs }) {
  const tabs = computed(() => [{ key, label: label(), icon }]);
  const { activeTab, tabLink } = useRouteTab(key, (k) => k === key);
  const crumbs = computed(() => [...unref(pageCrumbs()), { title: label(), icon, to: tabLink(key) }]);
  return { tabs, activeTab, crumbs };
}
