<script setup>
/******************************************************************/
/*                                                                */
/*  The environment label beside the logo (PRODUCTION, TEST...) : */
/*  Settings > Appearance > Interface > Header, a pill in the     */
/*  colour chosen there. Nothing without one.                     */
/*                                                                */
/******************************************************************/
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { PILL } from '@/lib/tableCells';

const store = useAppStore();
// the pill's colour : the one chosen, grey without
const tone = computed(() => PILL[store.envLabelColor] || PILL.grey);
</script>
<template>
  <span v-if="store.envLabel" class="badge rounded-pill fw-semibold af-pill af-env-label" :class="tone">
    <span class="af-pill-label">{{ store.envLabel }}</span>
  </span>
</template>
<style scoped>
/* close to the logo, centred on it : over the room the brand keeps on its right (its padding
   and margin, 36px), 16px from the logo, that room then kept after the label */
.af-env-label {
  margin-left: -1.25rem;
  margin-right: 1.25rem;
  align-self: center;
}
</style>
