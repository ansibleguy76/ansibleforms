<script setup>
/******************************************************************/
/*                                                                */
/*  Settings > Appearance > Labels : the labels beside the        */
/*  header's logo (PRODUCTION, EU...), each its text, its colour, */
/*  shown or hidden, in their order. Add label opens the dialog   */
/*  (models/label.model.js) ; a row opens its page                */
/*  (pages/admin/label.vue), its row menu enables, disables or    */
/*  moves it (config/settings.js : enableActions, moveActions).   */
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
    <AppAdminMulti v-if="authenticated" :apiVersion="2" :settings="settings.labels" />
  </AppSettingsPage>
</template>
<route lang="yaml">
meta:
  layout: settings
</route>
