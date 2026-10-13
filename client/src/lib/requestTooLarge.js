/******************************************************************/
/*                                                                */
/*  A request the server refused as too large (HTTP 431) : one    */
/*  toast that says so, instead of pages that stay empty. Node    */
/*  answers 431 before the app sees the request, when its headers */
/*  are larger than the server accepts (#1036 : the token of a    */
/*  user in many groups). App.vue's axios interceptor calls it.   */
/*                                                                */
/******************************************************************/
import { toast } from 'vue-sonner';
import i18n from '@/plugins/i18n';

// a page loads several lists at once and every one of them fails alike : one toast for the burst,
// another only when it happens again later
export const QUIET_MS = 30 * 1000;
// the toast's id : a second one before it closes replaces it rather than stacking
const TOAST_ID = 'request-too-large';
let lastShown = -Infinity;

/**
 * Tells the user that a request was too large for the server, once per burst.
 *
 * Args:
 *   now (number): the time, in milliseconds (Date.now() by default).
 *
 * Returns:
 *   boolean: true when the toast was shown ; false when one was shown less than QUIET_MS ago.
 */
export function notifyRequestTooLarge(now = Date.now()) {
  if (now - lastShown < QUIET_MS) return false;
  lastShown = now;
  toast.error(i18n.global.t('errors.requestTooLarge'), { id: TOAST_ID, duration: 15000 });
  return true;
}

/**
 * Forgets the last toast (tests).
 */
export function resetRequestTooLarge() {
  lastShown = -Infinity;
}
