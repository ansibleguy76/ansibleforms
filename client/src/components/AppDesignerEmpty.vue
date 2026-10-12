<script setup>
/******************************************************************/
/*                                                                */
/*  A designer section's empty message : a large faint icon, a    */
/*  title and a line under it, in the middle of the card, both    */
/*  ways - the same in every section (no file open, no files,     */
/*  a section still to build).                                    */
/*                                                                */
/*  @props:                                                       */
/*      icon: String|Array - the Font Awesome icon                */
/*      title: String - the title, bold                           */
/*      text: String - the line under it (optional)               */
/*                                                                */
/******************************************************************/
defineProps({
  icon: { type: [String, Array], default: 'file-lines' },
  title: { type: String, required: true },
  text: { type: String, default: '' },
});
</script>
<template>
  <div class="af-designer-empty text-muted">
    <FaIcon :icon="icon" class="mb-3 af-designer-empty-icon" />
    <p class="mb-2 fw-semibold fs-5">{{ title }}</p>
    <p v-if="text" class="mb-0">{{ text }}</p>
  </div>
</template>
<style scoped>
/* the whole height left, so it stands in the middle of the card, both ways */
.af-designer-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1 1 auto;
  padding: 3rem 0;
}
.af-designer-empty-icon {
  font-size: 2.5rem;
  opacity: 0.3;
}
</style>
