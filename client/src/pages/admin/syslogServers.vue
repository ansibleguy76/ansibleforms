<script setup>
/******************************************************************/
/*                                                                */
/*  Settings > Syslog : the syslog servers the server log and the */
/*  audit entries are sent to, each enabled or not. A row opens   */
/*  the server's page (syslog-server.vue), Add the wizard.        */
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
    <!-- min-width 0 : a flex item, it keeps the page's width instead of growing with its list (the
         list's columns then fit the room, as every list's) -->
    <div v-if="authenticated" class="flex-grow-1 d-flex flex-column af-syslog-page">
      <AppAdminMulti :settings="settings.syslogServers" :apiVersion="2" />
    </div>
  </AppSettingsPage>
</template>
<style scoped>
.af-syslog-page {
  min-width: 0;
}
</style>
