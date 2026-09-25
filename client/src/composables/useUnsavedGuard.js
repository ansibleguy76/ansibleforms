import { onMounted, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';

/**
 * Warn before unsaved changes are thrown away.
 *
 * The designer implements both halves of this itself (a beforeunload listener and an
 * onBeforeRouteLeave that reuses its dirty modal). The three visual config editors -
 * Categories, Roles and Constants - were built from the same buffers and got neither, so
 * expanding eight roles, flipping thirty switches and then clicking Users in the sidebar
 * discarded everything silently. That is the same amount of work as a designer session.
 *
 * Deliberately a plain confirm() rather than the designer's modal: these are settings
 * cards with no modal machinery of their own, and a guard that blocks navigation without
 * offering a way forward is worse than the problem. The router guard and the reload guard
 * have to be registered separately - neither covers the other.
 *
 * @param {import('vue').Ref<boolean>} isDirty
 * @param {() => string} message Lazily read, so the locale is resolved at prompt time.
 */
export function useUnsavedGuard(isDirty, message) {
  function onBeforeUnload(e) {
    if (!isDirty.value) return;
    // the browser shows its own wording ; assigning returnValue is what triggers it
    e.preventDefault();
    e.returnValue = '';
  }

  onMounted(() => window.addEventListener('beforeunload', onBeforeUnload));
  onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload));

  onBeforeRouteLeave(() => {
    if (!isDirty.value) return true;
    return window.confirm(message());
  });
}

export default useUnsavedGuard;
