<script setup>
import { toast } from 'vue-sonner';
import Profile from '@/lib/Profile';
import axios from 'axios';
import getSettings from '@/config/settings';
import { useI18n } from 'vue-i18n';

const { t, locale } = useI18n();
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
 * A runner waiting for approval in a few words : its host, its IP address, its mode, its address
 * (inbound), its fingerprint and when it asked, each as key and value ; its version is in the
 * review dialog (it does not decide an approval : an RTE of another contract cannot ask to join).
 * When it asked reads as a while ago, its full date and time on hover.
 *
 * Args:
 *   r (object): the runner.
 *
 * Returns:
 *   Array<object>: { key, value, title? }, those it has.
 */
function details(r) {
  const i = info(r);
  return [
    { key: t('settings.runners.pendingHost'), value: i.host },
    { key: t('settings.runners.pendingIp'), value: i.ip },
    { key: t('settings.runners.rteMode'), value: i.mode && t(`settings.runners.rteMode_${i.mode}`) },
    { key: t('settings.fields.uri'), value: i.url },
    { key: t('settings.runners.pendingFingerprint'), value: i.fingerprint },
    {
      key: t('settings.runners.pendingSince'),
      value: r.pending_since && ago(r.pending_since),
      title: r.pending_since && Helpers.formatServerDate(r.pending_since),
    },
  ].filter((d) => d.value);
}

// now, again every 30 seconds : "a while ago" keeps up while the page is open
const now = ref(Date.now());
const clock = setInterval(() => (now.value = Date.now()), 30000);
onBeforeUnmount(() => clearInterval(clock));

/**
 * A moment as a while ago, in the language shown (2 minutes ago, yesterday).
 *
 * Args:
 *   value (string): a date as the api gives it (ISO, UTC).
 *
 * Returns:
 *   string: the words.
 */
function ago(value) {
  const seconds = Math.round((new Date(value).getTime() - now.value) / 1000);
  if (Number.isNaN(seconds)) return '';
  const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' });
  const steps = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 30],
  ];
  let amount = seconds;
  for (const [unit, size] of steps) {
    if (Math.abs(amount) < size) return rtf.format(unit === 'second' ? Math.min(amount, 0) : amount, unit);
    amount = Math.round(amount / size);
  }
  return rtf.format(amount, 'month');
}

/**
 * After an approval or a rejection : both tables read again.
 */
// reviewing them one after the other (the notice clicked) : once one is decided the next opens,
// until none is left or the dialog is closed
const inTurn = ref(false);

/**
 * Opens the review of the first runner waiting, the others to follow once it is decided.
 */
function reviewAll() {
  if (!pending.value.length) return;
  inTurn.value = true;
  reviewing.value = pending.value[0];
}

/**
 * Opens the review of one runner (its name clicked), alone.
 *
 * Args:
 *   r (object): the runner.
 */
function reviewOne(r) {
  inTurn.value = false;
  reviewing.value = r;
}

/**
 * Closes the review : the ones left wait.
 */
function closeReview() {
  reviewing.value = null;
  inTurn.value = false;
}

/**
 * After an approval or a rejection : both tables read again, and the next one waiting reviewed
 * when they are reviewed in turn.
 */
async function decided() {
  reviewing.value = null;
  await loadPending();
  list.value?.loadItems();
  if (inTurn.value && pending.value.length) reviewing.value = pending.value[0];
  else inTurn.value = false;
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
        <div
          v-if="pending.length"
          class="af-runner-requests"
          role="button"
          tabindex="0"
          @click="reviewAll()"
          @keydown.enter="reviewAll()"
        >
          <div>
            <div class="fw-bold af-runner-requests-title">
              <FaIcon icon="hourglass-half" class="me-2" />{{
                t('settings.runners.waitingNotice', { count: pending.length }, pending.length)
              }}
            </div>
            <ul class="af-runner-requests-list">
              <li v-for="r in pending" :key="r.id">
                <a href="#" class="fw-semibold" @click.prevent.stop="reviewOne(r)">{{ r.name }}</a>
                <span class="text-body-secondary small ms-2">
                  <template v-for="(d, n) in details(r)" :key="d.key"
                    ><template v-if="n"> · </template
                    ><span :title="d.title || undefined">{{ d.key }}: {{ d.value }}</span></template
                  >
                </span>
              </li>
            </ul>
            <div class="text-body-secondary small mt-1">
              {{ t('settings.runners.waitingHint', pending.length) }}
            </div>
          </div>
        </div>
      </template>
    </AppAdminMulti>
    <AppRunnerApproval
      v-if="reviewing"
      :key="reviewing.id"
      :runner="reviewing"
      @close="closeReview()"
      @decided="decided"
    />
  </AppSettingsPage>
</template>
<style scoped lang="scss">
/* the runners waiting for approval : the review dialog's orange notice (AppRunnerApproval) */
.af-runner-requests {
  /* the whole notice opens the reviews, one after the other */
  cursor: pointer;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  /* a dark orange border all around */
  border: 1px solid #c24e05;
  border-radius: 0.375rem;
  background: color-mix(in srgb, #ef6009 8%, transparent);
}
.af-runner-requests:hover {
  background: color-mix(in srgb, #ef6009 14%, transparent);
}
[data-bs-theme='dark'] .af-runner-requests {
  border-color: #ff8a3d;
}
/* its title in a darker orange, readable on the light one */
.af-runner-requests-title {
  color: #c24e05;
}
[data-bs-theme='dark'] .af-runner-requests-title {
  color: #ff8a3d;
}
/* the names as the tables' links : blue, not underlined */
.af-runner-requests-list a {
  text-decoration: none;
}
.af-runner-requests-list a:hover {
  text-decoration: underline;
}
.af-runner-requests-list {
  margin: 0.375rem 0 0;
  padding-left: 1.25rem;
  li + li {
    margin-top: 0.125rem;
  }
}
</style>
