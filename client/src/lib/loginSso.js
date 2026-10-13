/******************************************************************/
/*                                                                */
/*  How many single sign-on buttons the sign-in card had last     */
/*  time in this browser. The card asks the server which          */
/*  providers are on (pages/login.vue) : until it knows, and on   */
/*  the sign-out page before it, the card keeps their room with   */
/*  grey buttons (AppSkeleton 'sso'), so it does not grow and     */
/*  move when they come.                                          */
/*                                                                */
/******************************************************************/

const KEY = 'af_login_sso';

/**
 * The number of single sign-on buttons the card showed last time.
 *
 * Returns:
 *   number: 0 to 2 ; 0 when nothing was remembered (or no storage).
 */
export function rememberedSso() {
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
