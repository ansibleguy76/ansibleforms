<script setup>
/******************************************************************/
/*                                                                */
/*  The Refresh button of a page : clicked, its two arrows turn   */
/*  and it says Refreshing... while its reload runs, and at least */
/*  a second so it can be read (useRefreshing).                   */
/*                                                                */
/*  @props:                                                       */
/*      action: Function - the reload, sync or async              */
/*      label: String - its words, the page's own Refresh         */
/*      cssClass: String - passed to the button                   */
/*                                                                */
/******************************************************************/
import { useI18n } from 'vue-i18n';
import { useRefreshing } from '@/composables/useRefreshing';

const props = defineProps({
  action: { type: Function, required: true },
  label: { type: String, required: true },
  cssClass: { type: String, default: 'text-nowrap' },
});

const { t } = useI18n();
const { refreshing, refresh } = useRefreshing();
</script>

<template>
  <!-- not disabled while it turns : it keeps its colour, and a second click does nothing -->
  <BsButton icon="refresh" :spin="refreshing" :cssClass="cssClass" @click="refresh(props.action)">{{
    refreshing ? t('common.refreshing') : label
  }}</BsButton>
</template>
