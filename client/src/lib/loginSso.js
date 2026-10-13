/******************************************************************/
/*                                                                */
/*  How many single sign-on buttons the sign-in card will have.   */
/*  The card asks the server which providers are on (pages/       */
/*  login.vue) : until it knows, and on the sign-out page before  */
/*  it, the card keeps their room with grey buttons (AppSkeleton  */
/*  'sso'), so it does not grow and move when they come.          */
/*                                                                */
/*  The server says which are on in index.html (<meta name=       */
/*  "af-sso">, server/src/lib/ssoMeta.js), read at every page     */
/*  load : right from a first visit. Without it (it could not be  */
/*  read), the number the card had last time in this browser.     */
/*                                                                */
/******************************************************************/

const KEY = 'af_login_sso';

/**
 * The single sign-on providers index.html says are on.
 *
 * Returns:
 *   number|null: how many (0 to 2) ; null when the page carries no such tag.
 */
function servedSso() {
  const tag = document.querySelector('meta[name="af-sso"]');
  if (!tag) return null;
  return (tag.getAttribute('content') || '').split(',').filter((p) => ['azuread', 'oidc'].includes(p)).length;
}

/**
 * The number of single sign-on buttons the card will show : as the server said in index.html,
 * else as it showed last time in this browser.
 *
 * Returns:
 *   number: 0 to 2 ; 0 when nothing is known (or no storage).
 */
export function rememberedSso() {
  const served = servedSso();
  if (served !== null) return served;
  try {
    const count = Number(localStorage.getItem(KEY) || 0);
    return Number.isInteger(count) && count > 0 && count <= 2 ? count : 0;
  } catch {
    return 0;
  }
}

/**
 * Remembers how many single sign-on buttons the card shows.
 *
 * Args:
 *   count (number): the providers that are on.
 */
export function rememberSso(count) {
  try {
    localStorage.setItem(KEY, String(count));
  } catch {
    // no storage (a private window) : the card grows when the buttons come
  }
}

export default { rememberedSso, rememberSso };
