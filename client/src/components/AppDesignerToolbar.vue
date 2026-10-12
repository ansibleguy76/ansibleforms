<script setup>
/******************************************************************/
/*                                                                */
/*  The designer's toolbar : the actions a section offers, drawn  */
/*  with the icon, the title and in the place config/             */
/*  designerActions.js gives each - the same in every section.    */
/*                                                                */
/*  @props:                                                       */
/*      actions: Array - { key, run, disabled, show, title,       */
/*         color } (toolbarButtons)                               */
/*                                                                */
/******************************************************************/
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { toolbarButtons } from '@/config/designerActions';

const props = defineProps({
  actions: { type: Array, default: () => [] },
});
const { t } = useI18n();
const buttons = computed(() => toolbarButtons(props.actions, t));
</script>
<template>
  <div class="d-flex gap-1 flex-wrap designer-toolbar">
    <BsButton
      v-for="b in buttons"
      :key="b.key"
      :icon="b.icon"
      :isIconButton="true"
      :colorClass="b.color || 'primary'"
      :disabled="b.disabled"
      :title="b.title"
      @click="b.run()"
    />
  </div>
</template>
