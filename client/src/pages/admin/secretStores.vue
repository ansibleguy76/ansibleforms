<script setup>
import { toast } from 'vue-sonner';
import Profile from '@/lib/Profile';
import axios from 'axios';
import getSettings from '@/config/settings';
import { useI18n } from 'vue-i18n';
import { useAppStore } from '@/stores/app';

const { t } = useI18n();
const settings = computed(() => getSettings(t));
// a store's writes are an admin's (the server refuses the others) : shown read only to the rest,
// Test connection kept, as the runners' list
const store = useAppStore();
import Helpers from '@/lib/Helpers';

const authenticated = ref(false);
const tests = ref({});

async function test_connection(item) {
  if (item) {
    if (!tests.value[item.id]) {
      try {
        tests.value[item.id] = t('admin.testing');
        const result = await axios.post(`/api/v2/secretstore/${item.id}/check`, {});
        toast.success(result.data.result);
      } catch (err) {
        toast.error(Helpers.parseAxiosResponseError(err, t('admin.connectionFailed')));
      } finally {
        delete tests.value[item.id];
      }
    } else {
      toast.warning(t('admin.testInProgress'));
    }
  }
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
      :settings="settings.secretStores"
      @test="test_connection"
      :busyItems="tests"
      :apiVersion="2"
      :readOnly="!store.isAdmin"
    />
  </AppSettingsPage>
</template>
