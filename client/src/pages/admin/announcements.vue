<script setup>
/******************************************************************/
/*                                                                */
/*  Settings > Appearance > Announcements : every announcement,   */
/*  its message, its type, its start and its end, scheduled,      */
/*  showing or hidden. Add announcement opens the wizard           */
/*  (models/announcement.model.js) ; a row opens its page         */
/*  (pages/admin/announcement.vue), its row menu enables or       */
/*  disables it.                                                  */
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
    <AppAdminMulti v-if="authenticated" :apiVersion="2" :settings="settings.announcements" />
  </AppSettingsPage>
</template>
<route lang="yaml">
meta:
  layout: settings
</route>
