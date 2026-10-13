<script>
// ------------------------------------------------------------------
// the placeholders on screen, shared by every AppSkeleton : how many show, on which page, and
// when the last one went. A page that loads in steps (its title, then its record) swaps one
// for the next in the same moment : the next shows at once instead of waiting its delay again
// ------------------------------------------------------------------
const seen = { visible: 0, path: null, at: 0 };
// how long after the last one went the next one still follows it, in milliseconds
const FOLLOW_MS = 400;

/**
 * Whether placeholders show, or just went, on this page.
 *
 * Args:
 *   path (string): the page's address.
 *
 * Returns:
 *   boolean: true when a new placeholder takes over from one on screen.
 */
function followsShown(path) {
  return seen.path === path && (seen.visible > 0 || Date.now() - seen.at < FOLLOW_MS);
}
</script>

<script setup>
/******************************************************************/
/*                                                                */
/*  A page's content while it loads, as grey placeholders         */
/*                                                                */
/*  The shape of what comes (the forms' tiles, a table's rows, a  */
/*  record's fields, a job's output) in grey bars with a light    */
/*  shimmer, in place of a spinner : the page's layout is already */
/*  there, and the real content takes the same spot. The colours  */
/*  are the theme's (light, dark, colour) ; the shimmer stops for */
/*  a user who asks the system for reduced motion.                */
/*                                                                */
/*  Nothing shows for a short moment first (delay) : the space is */
/*  kept, so a page that loads fast never flashes its placeholders*/
/*  ; one that takes longer shows them, in the same spot. Once    */
/*  placeholders show on a page, the next ones of the same page   */
/*  show at once (the title read, then the record) : they follow  */
/*  each other without a blank moment between.                    */
/*                                                                */
/*  @props:                                                       */
/*      shape: String - the shape of what comes :                 */
/*             'tiles'  the forms page's grid of tiles            */
/*             'table'  a list : its header and rows              */
/*             'lines'  text                                      */
/*             'form'   fields : a label over each field (a form, */
/*                      a record's tab, a settings page)          */
/*             'detail' label and value rows (a profile, checks)  */
/*             'facts'  a job's heading and its framed facts      */
/*             'output' a job's output panel : its toolbar, then  */
/*                      numbered lines                            */
/*             'editor' lines beside a gutter (the designer, the  */
/*                      server log)                               */
/*             'tabs'   a row of tabs, the first one open         */
/*             'inline' one bar in a line of text (a title that   */
/*                      is not known yet)                         */
/*      count: Number - how many tiles, rows, fields, lines...    */
/*      delay: Number - milliseconds before anything shows (0 :   */
/*             at once, as the start-up screen)                   */
/*      width: String - the bar's width, for 'inline'             */
/*                                                                */
/*  The fields of 'form' are at most 40rem wide, as the settings  */
/*  pages' ; --af-sk-field-max on a parent changes it (a form's   */
/*  fields take the whole card : none).                           */
/*                                                                */
/******************************************************************/

import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';

// INIT

const { t } = useI18n();

// PROPS

const props = defineProps({
  shape: { type: String, default: 'lines' },
  count: { type: Number, default: 6 },
  delay: { type: Number, default: 150 },
  width: { type: String, default: '8em' },
});

// ------------------------------------------------------------------
// the delay : hidden (its space kept) until it passed, unless placeholders already show on
// this page (seen) - then at once
// ------------------------------------------------------------------
const path = window.location.pathname;
const shown = ref(props.delay <= 0 || followsShown(path));
let timer = null;
let counted = false;
// shown : counted as on screen, for the placeholders that come next on the page
function show() {
  shown.value = true;
  counted = true;
  seen.visible++;
  seen.path = path;
}
onMounted(() => {
  if (shown.value) show();
  else timer = setTimeout(show, props.delay);
});
onBeforeUnmount(() => {
  clearTimeout(timer);
  if (!counted) return;
  seen.visible--;
  seen.at = Date.now();
});

// ------------------------------------------------------------------
// the bars' widths : uneven, as real text is, the same on every load
// ------------------------------------------------------------------
const WIDTHS = ['72%', '48%', '85%', '60%', '38%', '66%', '54%', '78%'];
const share = (i) => WIDTHS[i % WIDTHS.length];
// a label is a word or two : a width in rem rather than a share of the row
const LABELS = ['7rem', '10rem', '6rem', '9rem', '12rem', '8rem', '5.5rem', '11rem'];
const label = (i) => LABELS[i % LABELS.length];
// a code line's indent, in steps of two characters : the nesting of yaml
const INDENTS = [0, 1, 1, 2, 2, 2, 1, 2, 3, 3, 1, 0, 1, 1, 2, 2];
const indent = (i) => `${INDENTS[i % INDENTS.length] * 1.5}rem`;

// 'inline' sits in a line of text (a title) : a span, the others a block
const inline = computed(() => props.shape === 'inline');
</script>

<template>
  <component
    :is="inline ? 'span' : 'div'"
    class="af-skeleton"
    :class="[`af-skeleton-${shape}`, { 'af-sk-waiting': !shown }]"
    role="status"
    aria-busy="true"
  >
    <span class="visually-hidden">{{ t('common.loading') }}</span>
    <!-- a word of a title : one bar, as tall as the text's small letters -->
    <span v-if="inline" class="af-sk af-sk-inline" :style="{ width }"></span>
    <!-- the forms page : its grid of tiles, an icon square and two lines in each -->
    <div v-else-if="shape === 'tiles'" class="row align-content-stretch g-4">
      <div v-for="i in count" :key="i" class="col-md-6 col-lg-4 col-xxl-3">
        <div class="card h-100 p-4">
          <div class="d-flex gap-3">
            <div class="af-sk af-sk-icon"></div>
            <div class="flex-grow-1">
              <div class="af-sk af-sk-title" :style="{ width: share(i) }"></div>
              <div class="af-sk af-sk-line"></div>
              <div class="af-sk af-sk-line" :style="{ width: share(i + 3) }"></div>
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
        <div class="af-sk af-sk-cell" :style="{ width: `calc(${share(i)} * 0.28)` }"></div>
        <div class="af-sk af-sk-cell" :style="{ width: `calc(${share(i + 2)} * 0.18)` }"></div>
        <div class="af-sk af-sk-cell" :style="{ width: `calc(${share(i + 5)} * 0.45)` }"></div>
      </div>
    </div>
    <!-- fields : a label, the field under it, as BsInput lays them out -->
    <div v-else-if="shape === 'form'">
      <div v-for="i in count" :key="i" class="af-sk-field">
        <div class="af-sk af-sk-label" :style="{ width: label(i) }"></div>
        <div class="af-sk af-sk-input"></div>
      </div>
    </div>
    <!-- label and value rows : the label in a column of its own, a line between the rows -->
    <div v-else-if="shape === 'detail'">
      <div v-for="i in count" :key="i" class="af-sk-pair">
        <div class="af-sk-pair-label">
          <div class="af-sk af-sk-cell" :style="{ width: label(i) }"></div>
        </div>
        <div class="af-sk af-sk-cell af-sk-pair-value" :style="{ width: `calc(${share(i + 1)} * 0.6)` }"></div>
      </div>
    </div>
    <!-- a job at a glance : its name and two pills, then its facts in a framed grid -->
    <div v-else-if="shape === 'facts'" class="af-sk-facts-wrap">
      <div class="af-sk-heading">
        <div class="af-sk af-sk-heading-title"></div>
        <div class="af-sk af-sk-pill"></div>
        <div class="af-sk af-sk-pill"></div>
      </div>
      <div class="af-sk-facts">
        <div v-for="i in count" :key="i" class="af-sk-fact">
          <div class="af-sk af-sk-fact-label" :style="{ width: label(i + 2) }"></div>
          <div class="af-sk af-sk-cell" :style="{ width: share(i) }"></div>
        </div>
      </div>
    </div>
    <!-- an output : its panel, the toolbar on top, then numbered lines in a gutter -->
    <div v-else-if="shape === 'output'" class="af-sk-panel">
      <div class="af-sk-toolbar">
        <div class="af-sk af-sk-cell" style="width: 6rem"></div>
        <div class="af-sk af-sk-cell ms-auto" style="width: 5rem"></div>
        <div class="af-sk af-sk-cell" style="width: 5rem"></div>
        <div class="af-sk af-sk-cell" style="width: 6rem"></div>
      </div>
      <div class="af-sk-lines">
        <div v-for="i in count" :key="i" class="af-sk-code">
          <div class="af-sk-gutter"><div class="af-sk af-sk-number"></div></div>
          <div class="af-sk af-sk-mono" :style="{ width: `calc(${share(i * 3)} * 0.9)` }"></div>
        </div>
      </div>
    </div>
    <!-- code : a gutter of line numbers, the lines indented as yaml nests -->
    <div v-else-if="shape === 'editor'" class="af-sk-editor af-sk-lines">
      <div v-for="i in count" :key="i" class="af-sk-code">
        <div class="af-sk-gutter"><div class="af-sk af-sk-number"></div></div>
        <div class="af-sk af-sk-mono" :style="{ marginLeft: indent(i), width: `calc(${share(i * 5)} * 0.55)` }"></div>
      </div>
    </div>
    <!-- tabs : the page's own tab bar, a grey word in each, the first one open -->
    <ul v-else-if="shape === 'tabs'" class="nav nav-tabs mb-0">
      <li v-for="i in count" :key="i" class="nav-item">
        <span class="nav-link af-sk-tab" :class="{ active: i === 1 }">
          <span class="af-sk af-sk-inline" :style="{ width: label(i + 5) }"></span>
        </span>
      </li>
    </ul>
    <!-- text -->
    <div v-else>
      <div v-for="i in count" :key="i" class="af-sk af-sk-line" :style="{ width: share(i) }"></div>
    </div>
  </component>
</template>

<style scoped>
/* ------------------------------------------------------------------ */
/* a bar : the theme's secondary background, a lighter band sweeping  */
/* across it                                                          */
/* ------------------------------------------------------------------ */
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
/* the delay : the space taken, nothing seen */
.af-sk-waiting {
  visibility: hidden;
}
/* ------------------------------------------------------------------ */
/* the tiles and text                                                 */
/* ------------------------------------------------------------------ */
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
/* ------------------------------------------------------------------ */
/* a list's frame, as the tables' (af-list-frame)                     */
/* ------------------------------------------------------------------ */
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
/* ------------------------------------------------------------------ */
/* a field : the label's line (24px and its 8px margin), the field    */
/* (38px) and the 16px under it, as BsInput's                         */
/* ------------------------------------------------------------------ */
.af-sk-field {
  margin-bottom: 1rem;
}
.af-sk-field:last-child {
  margin-bottom: 0;
}
.af-sk-label {
  height: 0.8rem;
  margin: 0.35rem 0 0.85rem;
}
.af-sk-input {
  height: 2.375rem;
  max-width: var(--af-sk-field-max, 40rem);
}
/* ------------------------------------------------------------------ */
/* label and value rows                                               */
/* ------------------------------------------------------------------ */
.af-sk-pair {
  display: flex;
  align-items: center;
  min-height: 3.5rem;
  border-top: 1px solid var(--bs-border-color);
}
.af-sk-pair:first-child {
  border-top: 0;
}
.af-sk-pair-label {
  flex: 0 0 12rem;
}
.af-sk-pair-label .af-sk {
  max-width: calc(100% - 1.5rem);
}
.af-sk-pair-value {
  flex: 0 1 auto;
}
/* ------------------------------------------------------------------ */
/* a job's facts : the grid of its summary (pages/jobs.vue)           */
/* ------------------------------------------------------------------ */
.af-sk-facts-wrap {
  margin-bottom: 1.25rem;
}
.af-sk-heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  min-height: 2.25rem;
}
.af-sk-heading-title {
  width: 16rem;
  height: 1.4rem;
  margin-right: 0.25rem;
}
.af-sk-pill {
  width: 4rem;
  height: 1.2rem;
  border-radius: 1rem;
}
.af-sk-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1px solid var(--bs-border-color);
  border-radius: 0.5rem;
  overflow: hidden;
}
.af-sk-fact {
  padding: 0.95rem 1.125rem 1.1rem;
  box-shadow:
    -1px 0 0 var(--bs-border-color),
    0 -1px 0 var(--bs-border-color);
}
.af-sk-fact-label {
  height: 0.6rem;
  margin-bottom: 0.85rem;
}
/* ------------------------------------------------------------------ */
/* an output's panel and code lines                                   */
/* ------------------------------------------------------------------ */
.af-sk-panel {
  border: 1px solid var(--bs-border-color);
  border-radius: 0.5rem;
  overflow: hidden;
}
.af-sk-toolbar {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  height: 2.75rem;
  padding: 0 1rem;
  border-bottom: 1px solid var(--bs-border-color);
  background: var(--bs-tertiary-bg);
}
.af-sk-code {
  display: flex;
  align-items: center;
  height: 1.3rem;
}
.af-sk-gutter {
  flex: 0 0 4rem;
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 1rem;
  margin-right: 0.75rem;
  border-right: 1px solid var(--bs-border-color);
}
.af-sk-lines {
  padding: 0.5rem 0;
}
.af-sk-number {
  width: 1rem;
  height: 0.6rem;
}
.af-sk-mono {
  height: 0.65rem;
  border-radius: 0.2rem;
}
/* the designer's editor : the card's height, the lines cut at its bottom */
.af-sk-editor {
  flex: 1 1 auto;
  min-height: 12rem;
  overflow: hidden;
}
.af-skeleton-editor {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}
/* ------------------------------------------------------------------ */
/* a tab and a word of a title                                        */
/* ------------------------------------------------------------------ */
.af-sk-tab {
  cursor: default;
}
.af-sk-inline {
  display: inline-block;
  height: 0.7em;
  vertical-align: middle;
}
</style>
