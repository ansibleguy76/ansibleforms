<script setup>
/******************************************************************/
/*                                                                */
/*  Settings > Access > Disclaimer : the disclaimers, one per     */
/*  text as it was agreed to - the enabled one is the one users   */
/*  accept once (Enable this version in its row menu, or its      */
/*  page's switch). Add disclaimer makes a new one, not enabled ; */
/*  a row opens its page (pages/admin/disclaimer-version.vue).    */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import Profile from '@/lib/Profile';
import getSettings from '@/config/settings';

const { t } = useI18n();
const settings = computed(() => getSettings(t));
const authenticated = ref(false);

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
});
</script>
<template>
  <AppSettingsPage>
    <AppAdminMulti v-if="authenticated" :apiVersion="2" :settings="settings.disclaimerVersions" />
  </AppSettingsPage>
</template>
<route lang="yaml">
meta:
  layout: settings
</route>
