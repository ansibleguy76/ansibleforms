/******************************************************************/
/*                                                                */
/*  A Refresh button's moment : while what it reads again loads,  */
/*  and at least a second so it can be read, the button says      */
/*  Refreshing... (common.refreshing). AppRefreshButton uses it ; */
/*  a refresh drawn another way (a toolbar's own button) uses it  */
/*  directly.                                                     */
/*                                                                */
/******************************************************************/
import { ref } from 'vue';

// how long Refreshing... shows at the least, so a fast reload is still seen
export const REFRESHING_MIN_MS = 1000;

/**
 * A refresh that says it is refreshing.
 *
 * Args:
 *   minMs (number): how long it says so at the least, a second by default.
 *
 * Returns:
 *   object: refreshing (a ref, true while it refreshes) and refresh(fn), which runs fn
 *     (its reload) once at a time and resolves to fn's result. A click while it refreshes
 *     does nothing.
 */
export function useRefreshing(minMs = REFRESHING_MIN_MS) {
  const refreshing = ref(false);

  /**
   * Runs the reload, saying Refreshing... meanwhile and at least minMs.
   *
   * Args:
   *   fn (Function): the reload, sync or async.
   *
   * Returns:
   *   Promise<*>: what fn returned ; undefined when a refresh was already running.
   */
  async function refresh(fn) {
    if (refreshing.value) return undefined;
    refreshing.value = true;
    const started = Date.now();
    try {
      return await fn?.();
    } finally {
      // a reload faster than minMs : the words stay until it is up, so they can be read
      const left = minMs - (Date.now() - started);
      if (left > 0) await new Promise((resolve) => setTimeout(resolve, left));
      refreshing.value = false;
    }
  }

  return { refreshing, refresh };
}
