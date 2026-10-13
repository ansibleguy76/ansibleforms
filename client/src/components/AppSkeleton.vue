<script setup>
/******************************************************************/
/*                                                                */
/*  A page's content while it loads, as grey placeholders         */
/*                                                                */
/*  The shape of what comes (the forms' tiles, a table's rows,    */
/*  lines of text) in grey bars with a light shimmer, in place of */
/*  a spinner : the page's layout is already there, and the real  */
/*  content takes the same spot. The colours are the theme's      */
/*  (light, dark, colour) ; the shimmer stops for a user who asks */
/*  the system for reduced motion.                                */
/*                                                                */
/*  @props:                                                       */
/*      shape: String - 'tiles' (the forms page), 'table' (a      */
/*             list : its header and rows) or 'lines' (text)      */
/*      count: Number - how many tiles, rows or lines             */
/*                                                                */
/******************************************************************/

import { useI18n } from 'vue-i18n';

// INIT

const { t } = useI18n();

// PROPS

defineProps({
  shape: { type: String, default: 'lines' },
  count: { type: Number, default: 6 },
});

// the bars of a row or a line : uneven widths, as real text is, the same on every load
const WIDTHS = ['72%', '48%', '85%', '60%', '38%', '66%', '54%', '78%'];
const width = (i) => WIDTHS[i % WIDTHS.length];
</script>

<template>
  <div class="af-skeleton" role="status" aria-busy="true">
    <span class="visually-hidden">{{ t('common.loading') }}</span>
    <!-- the forms page : its grid of tiles, an icon square and two lines in each -->
    <div v-if="shape === 'tiles'" class="row align-content-stretch g-4">
      <div v-for="i in count" :key="i" class="col-md-6 col-lg-4 col-xxl-3">
        <div class="card h-100 p-4">
          <div class="d-flex gap-3">
            <div class="af-sk af-sk-icon"></div>
            <div class="flex-grow-1">
              <div class="af-sk af-sk-title" :style="{ width: width(i) }"></div>
              <div class="af-sk af-sk-line"></div>
              <div class="af-sk af-sk-line" :style="{ width: width(i + 3) }"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- a list : the frame of its table, the header, then rows of three cells -->
    <div v-else-if="shape === 'table'" class="af-sk-table">
      <div class="af-sk-row af-sk-head">
        <div class="af-sk af-sk-cell" style="width: 18%"></div>
        <div class="af-sk af-sk-cell" style="width: 12%"></div>
        <div class="af-sk af-sk-cell" style="width: 26%"></div>
      </div>
      <div v-for="i in count" :key="i" class="af-sk-row">
        <div class="af-sk af-sk-cell" :style="{ width: `calc(${width(i)} * 0.28)` }"></div>
        <div class="af-sk af-sk-cell" :style="{ width: `calc(${width(i + 2)} * 0.18)` }"></div>
        <div class="af-sk af-sk-cell" :style="{ width: `calc(${width(i + 5)} * 0.45)` }"></div>
      </div>
    </div>
    <!-- text -->
    <div v-else>
      <div v-for="i in count" :key="i" class="af-sk af-sk-line" :style="{ width: width(i) }"></div>
    </div>
  </div>
</template>

<style scoped>
/* a bar : the theme's secondary background, a lighter band sweeping across it */
.af-sk {
  border-radius: 0.375rem;
  background: linear-gradient(90deg, var(--bs-secondary-bg) 0%, var(--bs-tertiary-bg) 40%, var(--bs-secondary-bg) 80%);
  background-size: 300% 100%;
  animation: af-sk-shimmer 1.4s ease-in-out infinite;
}
@keyframes af-sk-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: 0 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .af-sk {
    animation: none;
  }
}
.af-sk-icon {
  width: 3rem;
  height: 3rem;
  flex-shrink: 0;
}
.af-sk-title {
  height: 1rem;
  margin-bottom: 0.9rem;
}
.af-sk-line {
  height: 0.75rem;
  margin-bottom: 0.6rem;
}
/* the list's frame, as the tables' (af-list-frame) */
.af-sk-table {
  border: 1px solid var(--bs-border-color);
  border-radius: 0.375rem;
  overflow: hidden;
}
.af-sk-row {
  display: flex;
  gap: 2rem;
  align-items: center;
  padding: 0.85rem 1rem;
  border-top: 1px solid var(--bs-border-color);
}
.af-sk-head {
  border-top: 0;
  background: var(--bs-tertiary-bg);
}
.af-sk-cell {
  height: 0.75rem;
}
</style>
