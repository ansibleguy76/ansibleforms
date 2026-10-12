<script setup>
/******************************************************************/
/*                                                                */
/*  The button back to the end of an output that follows its new */
/*  lines (useFollowOutput) : shown while the reader scrolled up, */
/*  over the bottom of what scrolls, centred. 'Jump to latest',   */
/*  'New lines' once more came in. The server's log, a job's      */
/*  output on its page and on the form's page use it.             */
/*                                                                */
/*  Put it last inside the output : it sticks to the bottom of    */
/*  the view while the output goes on below it, and takes no      */
/*  room.                                                         */
/*                                                                */
/*  @props:                                                       */
/*      show: Boolean - scrolled up (useFollowOutput's paused)    */
/*      newLines: Boolean - more came in since                    */
/*      bottom: String - how far above the view's bottom (CSS) :  */
/*          above what sticks there (the form's Abort bar)        */
/*  @emits:                                                       */
/*      click: back to the end (useFollowOutput's jumpToEnd)      */
/*                                                                */
/******************************************************************/
defineProps({
  show: { type: Boolean, default: false },
  newLines: { type: Boolean, default: false },
  bottom: { type: String, default: '0.75rem' },
});
const emit = defineEmits(['click']);
const { t } = useI18n();
</script>
<template>
  <div v-if="show" class="af-follow" :style="{ bottom }">
    <BsButton icon="arrow-down" colorClass="primary" @click="emit('click')">{{
      newLines ? t('common.newLines') : t('common.jumpToLatest')
    }}</BsButton>
  </div>
</template>
<style scoped>
/* over the bottom of the view while it is scrolled up, centred ; no height, so the output
   does not grow when it shows - the button is lifted above the bottom instead */
.af-follow {
  position: sticky;
  height: 0;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  pointer-events: none;
  z-index: 2;
}
.af-follow :deep(.btn) {
  pointer-events: auto;
  /* a button's font, not the output's */
  font-family: var(--bs-body-font-family);
  font-size: var(--bs-body-font-size);
  background-color: var(--bs-body-bg);
  box-shadow: var(--bs-box-shadow-sm);
}
</style>
