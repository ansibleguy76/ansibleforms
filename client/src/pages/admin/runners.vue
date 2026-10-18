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
/**
 * A runner waiting for approval in a few words : its host, where it called from, its mode and
 * its fingerprint.
 *
 * Args:
 *   r (object): the runner.
 *
 * Returns:
 *   string: the words, joined by a dot.
 */
function describe(r) {
  const i = info(r);
  return [
    i.host,
    i.ip,
    i.mode && t(`settings.runners.rteMode_${i.mode}`),
    i.fingerprint && `${t('settings.runners.pendingFingerprint')} ${i.fingerprint}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

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
        <!-- the runners waiting for approval : an orange notice above the runners, as the review
             dialog's, each one a link that opens its review -->
        <div v-if="pending.length" class="af-runner-requests">
          <div class="fw-bold">
            <FaIcon icon="hourglass-half" class="me-2" />{{
              t('settings.runners.waitingNotice', { count: pending.length }, pending.length)
            }}
          </div>
          <ul class="af-runner-requests-list">
            <li v-for="r in pending" :key="r.id">
              <a href="#" class="fw-semibold" @click.prevent="reviewing = r">{{ r.name }}</a>
              <span class="text-body-secondary small ms-2">{{ describe(r) }}</span>
            </li>
          </ul>
        </div>
      </template>
    </AppAdminMulti>
    <AppRunnerApproval v-if="reviewing" :runner="reviewing" @close="reviewing = null" @decided="decided" />
  </AppSettingsPage>
</template>
<style scoped lang="scss">
/* the runners waiting for approval : the review dialog's orange notice (AppRunnerApproval) */
.af-runner-requests {
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  border-left: 3px solid #ef6009;
  border-radius: 0.375rem;
  background: color-mix(in srgb, #ef6009 8%, transparent);
}
.af-runner-requests-list {
  margin: 0.375rem 0 0;
  padding-left: 1.75rem;
  li + li {
    margin-top: 0.125rem;
  }
}
</style>
