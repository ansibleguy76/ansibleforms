/******************************************************************/
/*                                                                */
/*  The way back from a single sign-on provider (Entra ID, OIDC)  */
/*                                                                */
/*  The server sends the browser back into the app with a one-    */
/*  time handoff in the fragment (/#token=...), not to the login  */
/*  page. This module is the first main.js loads, before the      */
/*  router reads the address : it takes the handoff out, puts the */
/*  page the user wanted in its place (a link to a form or a job, */
/*  kept while at the provider ; else the forms page, the start   */
/*  page), and swaps the handoff for the session's tokens in the  */
/*  background. The app is drawn at once - the header, and the    */
/*  page with its loading indicator - while the api requests wait */
/*  for the swap (waitForSso), so the user goes from the provider */
/*  straight there, never seeing the login form again. A refused  */
/*  handoff lands on the login page with the reason, as before.   */
/*                                                                */
/******************************************************************/

import BaseUrl from '@/lib/BaseUrl';
import TokenStorage from '@/lib/TokenStorage';

// the page the user wanted before the sign-in (the login page's ?from=, a link to a form or a
// job), kept in this tab while the browser is at the provider
const FROM_KEY = 'af_sso_from';
// set by the login page right after a sign-out : the next visit may not go straight to SSO
const SIGNED_OUT = 'af_signed_out';

/**
 * Whether an address may be gone to after the sign-in : a page of this app (a path), not the
 * login or logout page, and never another site ('//host' or a scheme).
 *
 * Args:
 *   from (string): the address.
 *
 * Returns:
 *   boolean: true when it is a page of the app to go back to.
 */
function isAppPage(from) {
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//') || from.includes('\\')) return false;
  const path = from.split(/[?#]/)[0];
  return path !== '/login' && path !== '/logout';
}

/**
 * Remembers the page to go to once the provider sends the user back (the login page's ?from=),
 * or forgets an older one : without it, the forms page.
 *
 * Args:
 *   from (string): the address the user wanted, or nothing.
 */
export function rememberSsoOrigin(from) {
  try {
    if (isAppPage(from)) sessionStorage.setItem(FROM_KEY, from);
    else sessionStorage.removeItem(FROM_KEY);
  } catch {
    // no storage (a private window) : the forms page
  }
}

/** A value of the browser's storage, or nothing when there is no storage. */
function stored(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Swaps the handoff for the session's tokens.
 *
 * Args:
 *   handoff (string): the one-time handoff from the address.
 *   provider (string): 'azuread' or 'oidc', the provider the login page went to.
 *
 * Returns:
 *   Promise<void>: resolved once the tokens are stored ; on a refusal the browser goes to the
 *     login page with the reason (and the promise never resolves, nothing is to run meanwhile).
 */
async function swap(handoff, provider) {
  const endpoint = provider === 'oidc' ? 'oidc' : 'entraid';
  let reason = 'The sign-in failed';
  try {
    // fetch, not axios : the api requests wait for this one (waitForSso)
    const res = await fetch(`${BaseUrl}/api/v2/auth/${endpoint}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: handoff }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.token) {
      TokenStorage.storeToken(data.token);
      TokenStorage.storeRefreshToken(data.refreshtoken);
      try {
        sessionStorage.removeItem(SIGNED_OUT);
      } catch {
        // no storage : nothing to forget
      }
      return;
    }
    // the server's message and, when it sent them, its details (the provider's reason), as
    // Helpers.parseAxiosResponseError reads an api answer
    const message = data?.error || data?.message || reason;
    reason = data?.details ? `${message}: ${data.details}` : message;
  } catch (err) {
    reason = err?.message || reason;
  }
  window.location.replace(`${BaseUrl}/login?error=${encodeURIComponent(reason)}`);
  return new Promise(() => {});
}

/**
 * Takes the handoff out of the address, before anything else reads it.
 *
 * Returns:
 *   Promise<void>: the swap, or nothing to wait for when the address carries no handoff.
 */
function takeHandoff() {
  const handoff = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token');
  if (!handoff) return Promise.resolve();
  const provider = stored(localStorage, 'authIssuer') === 'oidc' ? 'oidc' : 'azuread';
  // the page the user wanted (a link to a form or a job), else the forms page, the start page
  const from = stored(sessionStorage, FROM_KEY);
  try {
    sessionStorage.removeItem(FROM_KEY);
  } catch {
    // see above
  }
  // that page in the address instead : the router starts there, and the history never keeps the
  // handoff (the server takes it only once anyway)
  window.history.replaceState(null, '', `${BaseUrl}${isAppPage(from) ? from : '/forms/all'}`);
  return swap(handoff, provider);
}

// on the way back from a provider : the app may draw its header before the tokens are stored
export const ssoReturning = new URLSearchParams(window.location.hash.replace(/^#/, '')).has('token');
const pending = takeHandoff();

/**
 * Makes every request of an axios instance wait for the swap, so a page drawn meanwhile loads
 * its data with the new tokens. Installed after the app's own interceptors, so it runs first.
 *
 * Args:
 *   instance (object): the axios instance (the app's default one).
 */
export function waitForSso(instance) {
  // axios runs the request interceptors installed last first : this one waits, then the app's
  // own (plugins/index.js) reads the token, the new one by then
  instance.interceptors.request.use(async (config) => {
    // the start-up check of the database needs no user : it goes at once, so the app draws its
    // page (and header) instead of its own full-screen loading
    if (!String(config.url || '').startsWith('/api/v2/schema')) await pending;
    return config;
  });
}

/**
 * Waits until the way back from the provider is done : the tokens stored (or the browser on its
 * way to the login page). Nothing to wait for on any other load.
 *
 * Returns:
 *   Promise<void>: the swap.
 */
export function ssoSettled() {
  return pending;
}

export default { rememberSsoOrigin, waitForSso, ssoSettled, ssoReturning };
