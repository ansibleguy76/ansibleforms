<script setup>
/******************************************************************/
/*                                                                */
/*  A preview of the header's labels : the header's logo, and     */
/*  the labels as the header shows them (AppLabels), on the       */
/*  header's background. Used by a label's page and the New label */
/*  dialog.                                                       */
/*                                                                */
/*  @props:                                                       */
/*      labels: Array of { name, color } - the labels, in order   */
/*                                                                */
/******************************************************************/
import { computed } from 'vue';
import Theme from '@/lib/Theme';
import { PILL } from '@/lib/tableCells';
import { useAppStore } from '@/stores/app';

defineProps({
  labels: { type: Array, default: () => [] },
});

// the header's logo, as the header picks it (BsNavBar) : the uploaded one, else the theme's own
const store = useAppStore();
const logo = computed(() => {
  if (!store.logoIsDefault && store.customLogo) return store.customLogo;
  const theme = store.theme || Theme.load();
  return `img/logo_${theme === 'dark' || theme === 'light' ? theme : 'color'}.svg`;
});
</script>
<template>
  <div class="af-labels-preview">
    <img :src="logo" class="af-labels-preview-logo" alt="" />
    <span
      v-for="(l, i) in labels"
      :key="i"
      class="badge rounded-pill fw-semibold af-pill af-labels-preview-pill"
      :class="PILL[l.color] || PILL.grey"
    >
      <span class="af-pill-label">{{ l.name || 'PRODUCTION' }}</span>
    </span>
  </div>
</template>
<style scoped>
/* the header's background (the current theme's, live), its logo, the labels 20px from it and 6px
   apart, as there (AppLabels) */
.af-labels-preview {
  background-color: var(--af-bg-navbar);
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 0.75rem 1.25rem;
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius);
}
.af-labels-preview-logo {
  max-width: 200px;
  max-height: 33px;
  margin-right: 14px;
}
.af-labels-preview-pill {
  font-size: 12px;
}
.af-labels-preview-pill .af-pill-label {
  letter-spacing: 0.06em;
}
</style>
