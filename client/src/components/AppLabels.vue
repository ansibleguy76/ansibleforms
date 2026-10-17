<script setup>
/******************************************************************/
/*                                                                */
/*  The labels beside the logo (PRODUCTION, EU...) : Settings >   */
/*  Appearance > Labels, each a pill in its colour, in their      */
/*  order. The header has room for three : the others are a +N    */
/*  pill, their names in its tooltip ; on a phone the first and   */
/*  a +N. Nothing without any.                                    */
/*                                                                */
/******************************************************************/
import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import { PILL } from '@/lib/tableCells';

// as many as the header shows on a computer
const ROOM = 3;

const store = useAppStore();
const labels = computed(() => store.labels || []);
const tone = (color) => PILL[color] || PILL.grey;
// the names a +N stands for
const namesAfter = (n) =>
  labels.value
    .slice(n)
    .map((l) => l.name)
    .join(', ');
</script>
<template>
  <span v-if="labels.length" class="af-labels">
    <!-- the first always ; the second and third from the md breakpoint up -->
    <span
      v-for="(l, i) in labels.slice(0, ROOM)"
      :key="i"
      class="badge rounded-pill fw-semibold af-pill af-label"
      :class="[tone(l.color), { 'd-none d-md-inline-flex': i > 0 }]"
    >
      <span class="af-pill-label">{{ l.name }}</span>
    </span>
    <!-- the rest : on a phone all but the first, from md up all past the third -->
    <span
      v-if="labels.length > 1"
      class="badge rounded-pill fw-semibold af-pill af-label af-label-more d-md-none"
      :class="PILL.grey"
      :title="namesAfter(1)"
      >+{{ labels.length - 1 }}</span
    >
    <span
      v-if="labels.length > ROOM"
      class="badge rounded-pill fw-semibold af-pill af-label af-label-more d-none d-md-inline-flex"
      :class="PILL.grey"
      :title="namesAfter(ROOM)"
      >+{{ labels.length - ROOM }}</span
    >
  </span>
</template>
<style scoped>
/* close to the logo, centred on it : over the room the brand keeps on its right (its padding
   and margin, 36px), 20px from the logo, that room then kept after the labels ; 6px apart */
.af-labels {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: -1rem;
  margin-right: 1rem;
  align-self: center;
}
/* 12px wherever they show (the header's smaller font would make them 10.5px) */
.af-label {
  font-size: 12px;
}
/* their letters a little apart : a word in capitals, read at a glance */
.af-label .af-pill-label {
  letter-spacing: 0.06em;
}
.af-label-more {
  cursor: default;
}
</style>
