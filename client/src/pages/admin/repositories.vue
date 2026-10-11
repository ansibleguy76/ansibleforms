<script setup>
import axios from 'axios';
import { toast } from 'vue-sonner';
import Profile from '@/lib/Profile';
import getSettings from '@/config/settings';
import { useI18n } from 'vue-i18n';
import Helpers from '@/lib/Helpers';

const { t } = useI18n();
const settings = computed(() => getSettings(t));

const adminMulti = ref(null);
const authenticated = ref(false);

async function triggerClone(repo) {
  adminMulti.value.setItemProperty({ id: repo.name, key: 'status', value: 'running' });
  await axios.post(`/api/v2/repository/${repo.name}/clone`, {});
  // wait 1 second to visually see the change
  await new Promise((r) => setTimeout(r, 1000));
  adminMulti.value.loadItems();
}
// Pull all : every repository pulled (cloned when it is not there yet) at once, as its own Pull
// does ; the ones that fail are named
const pullingAll = ref(false);
async function pullAll() {
  pullingAll.value = true;
  try {
    const result = await axios.get('/api/v2/repository/');
    const repos = Array.isArray(result.data.records) ? result.data.records : [];
    for (const repo of repos) adminMulti.value.setItemProperty({ id: repo.name, key: 'status', value: 'running' });
    const pulls = await Promise.allSettled(
      repos.map((repo) => axios.post(`/api/v2/repository/${encodeURIComponent(repo.name)}/clone`, {})),
    );
    const failed = repos.filter((_, i) => pulls[i].status === 'rejected').map((repo) => repo.name);
    if (failed.length) toast.error(t('settings.repositories.pullAllFailed', { names: failed.join(', ') }));
    else toast.success(t('settings.repositories.pullAllDone', repos.length));
  } catch (err) {
    toast.error(Helpers.parseAxiosResponseError(err, 'Failed to pull the repositories'));
  } finally {
    pullingAll.value = false;
    adminMulti.value?.loadItems();
  }
}
async function triggerSync(repo) {
  adminMulti.value.setItemProperty({ id: repo.name, key: 'status', value: 'running' });
  await axios.post(`/api/v2/repository/${repo.name}/sync`, {}).catch(() => {});
  // wait 1 second to visually see the change
  await new Promise((r) => setTimeout(r, 1000));
  adminMulti.value.loadItems();
}
async function triggerReset(repo) {
  adminMulti.value.setItemProperty({ id: repo.name, key: 'status', value: 'running' });
  await axios.post(`/api/v2/repository/${repo.name}/reset`, {});
  // wait 1 second to visually see the change
  await new Promise((r) => setTimeout(r, 1000));
  adminMulti.value.loadItems();
}

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
  if (!authenticated.value) {
    return;
  }
});
</script>

<template>
  <AppSettingsPage>
    <AppAdminMulti
      v-if="authenticated"
      ref="adminMulti"
      :settings="settings.repositories"
      :apiVersion="2"
      @trigger="triggerClone"
      @reset="triggerReset"
      @sync="triggerSync"
    >
      <template #actionsBefore>
        <BsButton icon="download" :disabled="pullingAll" @click="pullAll()">{{
          t('settings.repositories.pullAll')
        }}</BsButton>
      </template>
    </AppAdminMulti>
  </AppSettingsPage>
</template>
