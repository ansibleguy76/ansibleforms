<script setup>
/******************************************************************/
/*                                                                */
/*  Settings > System > Backups : the backups, each opening its   */
/*  own page (backup.vue) from its row or its row menu's Show     */
/*  backup ; Download, Restore and Delete in the row menu too.    */
/*                                                                */
/******************************************************************/
import { toast } from 'vue-sonner';
import { ref, onMounted } from 'vue';
import getSettings from '@/config/settings';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const settings = computed(() => getSettings(t));
import Profile from '@/lib/Profile';
import Helpers from '@/lib/Helpers.js';

const adminMulti = ref(null);
const authenticated = ref(false);
// the backup whose Restore dialog is open (AppBackupRestore) ; null : none
const restoring = ref(null);

/**
 * Downloads a backup as a .tar.gz (GET /api/v2/backup/<folder>/download).
 *
 * Args:
 *   item (object): the backup.
 */
async function download(item) {
  try {
    await Helpers.downloadFile(`/api/v2/backup/${item.folder}/download`);
  } catch (err) {
    // the server's reason (downloadFile decodes its error body), else a translated fallback
    toast.error(Helpers.parseAxiosResponseError(err, t('common.downloadFailed')));
  }
}

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
});
</script>

<template>
  <AppBackupRestore :backup="restoring" @close="restoring = null" @restored="adminMulti?.loadItems()" />
  <AppSettingsPage>
    <AppAdminMulti
      v-if="authenticated"
      ref="adminMulti"
      :settings="settings.backups"
      apiVersion="2"
      @trigger="restoring = $event"
      @download="download"
      @reset="null"
    />
    <!-- the user being checked : the title and placeholders where the list comes -->
    <AppPageSkeleton v-else />
  </AppSettingsPage>
</template>
