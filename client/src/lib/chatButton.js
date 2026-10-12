// Whether the chat assistant's button shows, in the bottom-right corner : AppChat draws it, and
// App.vue lifts the toasts above it only then - without it they sit in the corner themselves.

// the pages that never show it : an expired session sends the user to the login page without
// resetting store.authenticated, so the chat goes away on the pages outside a login too
export const NO_CHAT_ROUTES = new Set(['/login', '/logout', '/error', '/schema']);

/**
 * Whether the chat button shows : signed in, the assistant enabled, the user's roles allowing
 * it, and a page inside a login.
 *
 * Args:
 *   store (object): the app store (authenticated, chatEnabled, profile).
 *   routeName (string): the current route's name.
 *
 * Returns:
 *   boolean: true when it shows.
 */
export function chatButtonShown(store, routeName) {
  return !!(
    store.authenticated &&
    store.chatEnabled &&
    store.profile?.options?.allowChat !== false &&
    !NO_CHAT_ROUTES.has(routeName)
  );
}
