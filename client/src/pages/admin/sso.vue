<script setup>
/******************************************************************/
/*                                                                */
/*  Settings > SSO : the SSO providers (Microsoft Entra ID, Open  */
/*  ID). Each one is enabled or not, the default of its type is   */
/*  the one its login button signs in with (Use for sign-in in    */
/*  its row menu), and one may skip the login page ; all three on */
/*  its own page's Details tab.                                   */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import Profile from '@/lib/Profile';
import getSettings from '@/config/settings';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const settings = computed(() => getSettings(t));
const authenticated = ref(false);

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
});
</script>
<template>
  <AppSettingsPage>
    <AppAdminMulti v-if="authenticated" :apiVersion="2" :settings="settings.oauth2_providers" />
  </AppSettingsPage>
</template>
<route lang="yaml">
meta:
  layout: settings
</route>
