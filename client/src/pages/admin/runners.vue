<script setup>
import { toast } from 'vue-sonner';
import Profile from '@/lib/Profile';
import axios from 'axios';
import getSettings from '@/config/settings';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const settings = computed(() => getSettings(t));
import Helpers from '@/lib/Helpers';
import { useAppStore } from '@/stores/app';
import { useLiveEvent } from '@/composables/useLiveEvent';
import { esc } from '@/lib/tableCells';

// a runner receives the credentials of the jobs it runs : only an admin changes one (the
// server refuses the others), a user with settings access sees and tests them
const store = useAppStore();

const authenticated = ref(false);
const tests = ref({});
// the runner waiting for approval being reviewed (components/AppRunnerApproval.vue)
const reviewing = ref(null);
const list = ref(null);

// ─── the runners waiting for approval : a table of their own above the list ─────────────────
// (the list leaves them out, settings.runners.rowFilter) : the first thing on the page, never on
// some page of the list
const pending = ref([]);

/**
 * Reads the runners that asked to join and wait for approval.
 */
async function loadPending() {
  const res = await axios.get('/api/v2/runner/').catch(() => null);
  pending.value = (res?.data?.records || []).filter((r) => Number(r.pending));
}

// what each one said of itself (rteHub.askToJoin), read once per row
const info = (r) => {
  try {
    return JSON.parse(r?.pending_info || '{}') || {};
  } catch {
    return {};
  }
};
const pendingColumns = computed(() => [
  { key: 'name', label: t('settings.fields.name'), sortable: true },
  { key: 'host', label: t('settings.runners.pendingHost'), render: (r) => esc(info(r).host || '–') },
  { key: 'ip', label: t('settings.runners.pendingIp'), render: (r) => esc(info(r).ip || '–') },
  {
    key: 'mode',
    label: t('settings.runners.rteMode'),
    render: (r) => esc(info(r).mode ? t(`settings.runners.rteMode_${info(r).mode}`) : '–'),
  },
  {
    key: 'fingerprint',
    label: t('settings.runners.pendingFingerprint'),
    render: (r) => `<span class="font-monospace">${esc(info(r).fingerprint || '–')}</span>`,
  },
  {
    key: 'pending_since',
    label: t('settings.runners.pendingSince'),
    sortable: true,
    render: (r) => esc(r.pending_since ? Helpers.formatServerDate(r.pending_since) : '–'),
  },
]);

/**
 * After an approval or a rejection : both tables read again.
 */
async function decided() {
  reviewing.value = null;
  await loadPending();
  list.value?.loadItems();
}
useLiveEvent('runners', loadPending);

async function test_connection(item) {
  if (item) {
    if (!tests.value[item.id]) {
      try {
        tests.value[item.id] = t('admin.testing');
        const result = await axios.post(`/api/v2/runner/${item.id}/check`, {});
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
  await loadPending();
});
</script>
<template>
  <AppSettingsPage>
    <AppAdminMulti
      v-if="authenticated"
      :settings="settings.runners"
      @test="test_connection"
      :busyItems="tests"
      :apiVersion="2"
      :readOnly="!store.isAdmin"
      ref="list"
    >
      <!-- the runners waiting for approval : a card of its own above the runners', a click on one
           opens its review -->
      <template #aboveCard>
        <template v-if="pending.length">
          <h6 class="af-runner-requests-title">
            <FaIcon icon="hourglass-half" class="me-2" />{{
              t('settings.runners.waitingTitle', { count: pending.length })
            }}
          </h6>
          <div class="card af-runner-requests">
            <div class="card-body">
              <BsDataTable
                framed
                bare
                :items="pending"
                :columns="pendingColumns"
                :selectable="false"
                :rowClickSelects="false"
                :pageSize="50"
                linkColumn="name"
                @row-click="(r) => (reviewing = r)"
              />
            </div>
          </div>
        </template>
      </template>
    </AppAdminMulti>
    <AppRunnerApproval v-if="reviewing" :runner="reviewing" @close="reviewing = null" @decided="decided" />
  </AppSettingsPage>
</template>
<style scoped lang="scss">
/* the runners waiting for approval : a titled table above the list, in the orange of a job
   waiting for approval */
.af-runner-requests {
  margin-bottom: 1rem;
}
.af-runner-requests-title {
  font-weight: 600;
  color: #ef6009;
  margin-bottom: 0.5rem;
}
</style>
