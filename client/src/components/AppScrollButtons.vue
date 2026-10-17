<script setup>
/******************************************************************/
/*                                                                */
/*  AppScrollButtons : up to the top and down to the end of a     */
/*  long page, two round outline buttons in the bottom-right      */
/*  corner. They show once the page is scrolled down (down until  */
/*  its end is reached), above the chat assistant's button when   */
/*  that shows, and above a bar held at the window's bottom       */
/*  (Running, Abort) when the page has one. A job's page and the  */
/*  form's output use it.                                         */
/*                                                                */
/*  The app's pages scroll in #app, below the header.             */
/*                                                                */
/*  @props:                                                       */
/*      overBar: Boolean - a bar is held at the window's bottom : */
/*               the buttons over it                              */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAppStore } from '@/stores/app';
import { chatButtonShown } from '@/lib/chatButton';

defineProps({
  overBar: { type: Boolean, default: false },
});
const { t } = useI18n();
const store = useAppStore();
const route = useRoute();

// the chat assistant's button in the same corner : the buttons above it
const chatShown = computed(() => chatButtonShown(store, route.name));

// ─── where the page is ───────────────────────────────────────────────────────

const scrolledDown = ref(false); // left its top (the first few pixels aside)
const moreBelow = ref(false); // its end not reached yet

const scroller = () => document.getElementById('app');

/**
 * Reads where the page is : both buttons as soon as it leaves its top, down no more at its end.
 */
function measure() {
  const app = scroller();
  if (!app) return;
  scrolledDown.value = app.scrollTop > 8;
  moreBelow.value = scrolledDown.value && app.scrollHeight - app.scrollTop - app.clientHeight > 2;
  centre();
}

// ─── in the middle of the free space at the right ─────────────────────────────
// between the output's right edge and the page's (its scrollbar left out, which takes part of
// that room in some browsers) ; with no room for them there, the corner as before (the CSS)
const right = ref(null);
const BUTTON = 36; // 2.25rem
function centre() {
  const app = scroller();
  const panel = document.querySelector('.af-output-panel');
  if (!app || !panel) {
    right.value = null;
    return;
  }
  // the window's width without its own scrollbar : where a fixed element's right is measured from
  const view = document.documentElement.clientWidth;
  const appBox = app.getBoundingClientRect();
  const inside = Math.min(view, appBox.left + app.clientWidth);
  // a scrollbar drawn thin in its wider strip (Windows 11 : about 8px in 15px) : the strip's empty
  // part reads as free space, so the room ends at the drawn bar, not at the strip's edge
  const strip = Math.max(appBox.right, window.innerWidth) - inside;
  const pageRight = inside + (strip > 8 ? (strip - 8) / 2 : 0);
  const gap = pageRight - panel.getBoundingClientRect().right;
  right.value = gap >= BUTTON + 4 ? Math.max(0, Math.round(view - pageRight + (gap - BUTTON) / 2)) : null;
}
function toTop() {
  scroller()?.scrollTo({ top: 0, behavior: 'smooth' });
}
function toEnd() {
  const app = scroller();
  app?.scrollTo({ top: app.scrollHeight, behavior: 'smooth' });
}
onMounted(() => {
  scroller()?.addEventListener('scroll', measure, { passive: true });
  window.addEventListener('resize', measure);
  measure();
});
onBeforeUnmount(() => {
  scroller()?.removeEventListener('scroll', measure);
  window.removeEventListener('resize', measure);
});

// the page grew or changed under the buttons (an output came) : read again
defineExpose({ measure });
</script>

<template>
  <div
    v-if="scrolledDown || moreBelow"
    class="af-scroll-buttons"
    :class="{ 'af-scroll-buttons-lifted': chatShown, 'af-scroll-buttons-over-bar': overBar }"
    :style="right != null && !chatShown ? { right: right + 'px' } : null"
  >
    <button
      v-if="scrolledDown"
      type="button"
      class="btn btn-outline-primary af-scroll-button"
      :title="t('jobs.backToTop')"
      :aria-label="t('jobs.backToTop')"
      @click="toTop"
    >
      <FaIcon icon="arrow-up" />
    </button>
    <button
      v-if="moreBelow"
      type="button"
      class="btn btn-outline-primary af-scroll-button"
      :title="t('jobs.toBottom')"
      :aria-label="t('jobs.toBottom')"
      @click="toEnd"
    >
      <FaIcon icon="arrow-down" />
    </button>
  </div>
</template>

<style scoped lang="scss">
/* one over the other in the bottom-right corner */
/* in the page's right margin, beside the content rather than over it (it is about 2.75rem wide) */
.af-scroll-buttons {
  position: fixed;
  right: 0.25rem;
  bottom: 1.25rem;
  z-index: 1050;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}
/* the chat assistant's button there : above it */
.af-scroll-buttons-lifted {
  bottom: calc(1.25rem + 3.5rem + 0.75rem);
  /* centred over the chat assistant's round button (3.5rem wide, 1.25rem from the edge) */
  right: calc(1.25rem + (3.5rem - 2.25rem) / 2);
}
/* a bar held at the window's bottom (Running, Abort) : above it */
.af-scroll-buttons-over-bar {
  bottom: 6rem;
}
.af-scroll-buttons-over-bar.af-scroll-buttons-lifted {
  bottom: calc(6rem + 3.5rem + 0.75rem);
}
.af-scroll-button {
  /* an outline button (btn-outline-primary : its border, its blue, its hover), round ; over the
     page, so not see-through until hovered */
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border-radius: 50%;
  font-size: 0.875rem;
  box-shadow: var(--bs-box-shadow-sm);
  &:not(:hover):not(:active):not(:focus-visible) {
    background: var(--bs-body-bg);
  }
}
</style>
