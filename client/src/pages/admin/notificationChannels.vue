<script setup>
/******************************************************************/
/*                                                                */
/*  Settings > Notifications : the channels notifications go to - */
/*  SMTP servers (one of them active : the app sends its mail     */
/*  with it), Slack, Microsoft Teams, Telegram and webhooks. A    */
/*  row opens the channel's page (notification-channel.vue), Add  */
/*  the wizard. A config seed that sets the mail settings is said */
/*  above the list : the app sends with those while no mail       */
/*  channel is active.                                            */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';
import Profile from '@/lib/Profile';
import getSettings from '@/config/settings';

const { t } = useI18n();
const settings = computed(() => getSettings(t));
const authenticated = ref(false);
// the mail settings come from the config seed (a seeded instance)
const seeded = ref(false);

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
  if (!authenticated.value) return;
  const res = await axios.get('/api/v2/settings/').catch(() => null);
  seeded.value = !!(res?.data?.managed && res?.data?.mail_server);
});
</script>
<template>
  <AppSettingsPage>
    <!-- min-width 0 : a flex item, it keeps the page's width instead of growing with its list (the
         list's columns then fit the room, as every list's) -->
    <div v-if="authenticated" class="flex-grow-1 d-flex flex-column af-channels-page">
      <div v-if="seeded" class="alert alert-secondary py-2 mx-4 mt-3 mb-0">
        <FaIcon icon="lock" class="me-2" />{{ t('settings.notificationChannels.fromSeed') }}
      </div>
      <AppAdminMulti :settings="settings.notificationChannels" :apiVersion="2" />
    </div>
  </AppSettingsPage>
</template>
<style scoped>
.af-channels-page {
  min-width: 0;
}
</style>
