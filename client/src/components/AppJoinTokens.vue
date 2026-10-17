<script setup>
/******************************************************************/
/*                                                                */
/*  Join tokens (Connections > Runners > Join tokens) : what an   */
/*  RTE in a socket mode presents once (RTE_JOIN_TOKEN) to add    */
/*  itself as a runner, its own token then kept in an RTE         */
/*  credential. The list (never the tokens : only their first     */
/*  characters), and for an admin a new one - shown once, with    */
/*  the installer's command and an RTE container's settings -     */
/*  revoke and delete.                                            */
/*                                                                */
/*  @props:                                                       */
/*      readOnly: Boolean - a user who is not an admin : the list */
/*  @emit:                                                        */
/*      close - the dialog closed                                 */
/*                                                                */
/******************************************************************/
import axios from 'axios';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';
import Helpers from '@/lib/Helpers';
import BaseUrl from '@/lib/BaseUrl';
import { pill, PILL } from '@/lib/tableCells';
import Time from '@/lib/Time';

const props = defineProps({
  readOnly: { type: Boolean, default: false },
});
const emit = defineEmits(['close']);
const { t } = useI18n();

// ─── the list ─────────────────────────────────────────────────────────────────

const tokens = ref([]);
const loading = ref(true);

/**
 * Reads the join tokens.
 */
async function load() {
  loading.value = true;
  try {
    const res = await axios.get('/api/v2/runner/jointoken');
    tokens.value = res.data?.records || res.data?.data?.output || [];
  } catch (err) {
    toast.error(Helpers.parseAxiosResponseError(err, t('settings.runners.joinTokensFailed')));
  } finally {
    loading.value = false;
  }
}
onMounted(load);

/**
 * A date as the app writes dates, or "never".
 *
 * Args:
 *   value (string|null): the date.
 *
 * Returns:
 *   string
 */
const when = (value) => (value ? Time.format(value, 'YYYY-MM-DD HH:mm') : t('settings.runners.joinTokenNever'));

/**
 * A token's state as a pill : usable, revoked, or expired / used up.
 *
 * Args:
 *   row (object): the token.
 *
 * Returns:
 *   string: the pill's HTML.
 */
function statePill(row) {
  if (row.revoked) return pill(PILL.grey, t('settings.runners.joinTokenRevoked'));
  if (!row.usable) return pill(PILL.amber, t('settings.runners.joinTokenSpent'));
  return pill(PILL.green, t('settings.runners.joinTokenUsable'));
}

const columns = computed(() => [
  { key: 'name', label: t('settings.runners.joinTokenName') },
  {
    key: 'prefix',
    label: t('settings.runners.joinTokenPrefix'),
    value: (r) => `${r.prefix}…`,
    class: 'font-monospace',
  },
  { key: 'state', label: t('settings.runners.joinTokenStatus'), html: statePill, keep: true },
  {
    key: 'uses',
    label: t('settings.runners.joinTokenUses'),
    value: (r) => (r.max_uses ? `${r.uses} / ${r.max_uses}` : String(r.uses)),
    keep: true,
  },
  { key: 'expires_at', label: t('settings.runners.joinTokenExpires'), value: (r) => when(r.expires_at), keep: true },
  { key: 'created_by', label: t('settings.runners.joinTokenCreatedBy') },
]);

/**
 * Revokes a token : it adds no runner any more.
 *
 * Args:
 *   row (object): the token.
 */
async function revoke(row) {
  try {
    await axios.post(`/api/v2/runner/jointoken/${row.id}/revoke`);
    toast.success(t('settings.runners.joinTokenRevokedToast', { name: row.name }));
    await load();
  } catch (err) {
    toast.error(Helpers.parseAxiosResponseError(err, t('settings.runners.joinTokensFailed')));
  }
}

/**
 * Deletes a token.
 *
 * Args:
 *   row (object): the token.
 */
async function remove(row) {
  try {
    await axios.delete(`/api/v2/runner/jointoken/${row.id}`);
    toast.success(t('settings.runners.joinTokenDeletedToast', { name: row.name }));
    await load();
  } catch (err) {
    toast.error(Helpers.parseAxiosResponseError(err, t('settings.runners.joinTokensFailed')));
  }
}

const rowActions = computed(() =>
  props.readOnly
    ? []
    : [
        { title: t('settings.runners.joinTokenRevoke'), icon: 'ban', enabledWhen: (r) => !r.revoked, run: revoke },
        { title: t('common.delete'), icon: 'trash', danger: true, run: remove },
      ],
);

// ─── a new one ────────────────────────────────────────────────────────────────

const creating = ref(false);
const form = ref({ name: '', hours: 24, maxUses: '' });
const made = ref(null);
const VALIDITY = [1, 24, 168, 720, 0];
const validity = computed(() => VALIDITY.map((h) => ({ value: h, label: t(`settings.runners.joinTokenValid_${h}`) })));
const canCreate = computed(() => !!form.value.name.trim());

/**
 * Makes the token : shown once, with how to use it.
 */
async function create() {
  if (!canCreate.value) return;
  try {
    const res = await axios.post('/api/v2/runner/jointoken', {
      name: form.value.name.trim(),
      expiresInHours: Number(form.value.hours) || 0,
      maxUses: Number(form.value.maxUses) || 0,
    });
    made.value = res.data?.data?.output || res.data?.output || res.data;
    toast.success(t('settings.runners.joinTokenMadeToast'));
    await load();
  } catch (err) {
    toast.error(Helpers.parseAxiosResponseError(err, t('settings.runners.joinTokensFailed')));
  }
}

// the app's address as an RTE dials it : this page's, with its base path
const appUrl = computed(() => `${window.location.origin}${BaseUrl}`);
// what the installer takes (--join) : the app's address and the token, in one string
const joinString = computed(() =>
  made.value
    ? `afjoin2.${btoa(JSON.stringify({ u: appUrl.value, t: made.value.token }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')}`
    : '',
);
const installCommand = computed(
  () => `curl -fsSL https://ansibleforms.com/install | sh -s -- install --role runner --join ${joinString.value}`,
);
const containerEnv = computed(() =>
  [
    'AF_ROLE=rte',
    'RTE_MODE=outbound',
    `APP_URL=${appUrl.value}`,
    `RTE_JOIN_TOKEN=${made.value?.token || ''}`,
    'RTE_NAME=<runner-name>',
    'RTE_TOKEN=<a secret of at least 16 characters>',
  ].join('\n'),
);

/**
 * Copies a text, and says so.
 *
 * Args:
 *   text (string): the text.
 */
async function copy(text) {
  try {
    await Helpers.copyToClipboard(text);
    toast.success(t('settings.runners.joinTokenCopied'));
  } catch {
    toast.error(t('settings.runners.joinTokenCopyFailed'));
  }
}

/** back to the list from the form or the token shown */
function backToList() {
  creating.value = false;
  made.value = null;
  form.value = { name: '', hours: 24, maxUses: '' };
}
</script>

<template>
  <BsModal size="xl" icon="ticket" :footerClose="false" @close="emit('close')">
    <template #title>{{ creating ? t('settings.runners.newJoinToken') : t('settings.runners.joinTokens') }}</template>
    <template #default>
      <!-- the token made : shown once, with the installer's command and a container's settings -->
      <div v-if="made">
        <label class="form-label fw-semibold" for="af-join-token">{{ made.name }}</label>
        <div class="input-group mb-2">
          <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="ticket" /></span>
          <input
            id="af-join-token"
            class="form-control font-monospace"
            :value="made.token"
            readonly
            @focus="$event.target.select()"
          />
          <button type="button" class="btn btn-outline-primary" @click="copy(made.token)">
            <FaIcon icon="copy" class="me-1" />{{ t('settings.runners.joinTokenCopy') }}
          </button>
        </div>
        <div class="alert alert-warning d-flex align-items-start gap-2 py-2 mb-4">
          <FaIcon icon="triangle-exclamation" class="mt-1" /><span>{{ t('settings.runners.joinTokenOnce') }}</span>
        </div>
        <p class="mb-2 text-body-secondary">{{ t('settings.runners.joinTokenInstaller') }}</p>
        <div class="d-flex gap-2 align-items-start mb-4">
          <pre class="af-join-example flex-grow-1 mb-0"><code>{{ installCommand }}</code></pre>
          <button
            type="button"
            class="btn btn-outline-primary"
            :title="t('settings.runners.joinTokenCopy')"
            @click="copy(installCommand)"
          >
            <FaIcon icon="copy" />
          </button>
        </div>
        <p class="mb-2 text-body-secondary">{{ t('settings.runners.joinTokenContainer') }}</p>
        <div class="d-flex gap-2 align-items-start">
          <pre class="af-join-example flex-grow-1 mb-0"><code>{{ containerEnv }}</code></pre>
          <button
            type="button"
            class="btn btn-outline-primary"
            :title="t('settings.runners.joinTokenCopy')"
            @click="copy(containerEnv)"
          >
            <FaIcon icon="copy" />
          </button>
        </div>
      </div>
      <!-- a new one : its name, how long it is valid, how many runners it may add -->
      <div v-else-if="creating">
        <BsInput
          v-model="form.name"
          :isHorizontal="true"
          :isFloating="false"
          type="text"
          icon="tag"
          :required="true"
          :label="t('settings.runners.joinTokenName')"
          :help="t('settings.runners.joinTokenNameHelp')"
          @keyup_enter="create"
        />
        <BsInput
          v-model="form.hours"
          :isHorizontal="true"
          :isFloating="false"
          type="select"
          icon="hourglass-half"
          :required="true"
          :values="validity"
          valueKey="value"
          labelKey="label"
          :label="t('settings.runners.joinTokenValidFor')"
          :help="t('settings.runners.joinTokenValidForHelp')"
        />
        <BsInput
          v-model="form.maxUses"
          :isHorizontal="true"
          :isFloating="false"
          type="number"
          icon="users"
          :label="t('settings.runners.joinTokenMaxUses')"
          :help="t('settings.runners.joinTokenMaxUsesHelp')"
        />
      </div>
      <!-- the list -->
      <div v-else>
        <p class="text-body-secondary">{{ t('settings.runners.joinTokensHelp') }}</p>
        <AppSkeleton v-if="loading" shape="table" :count="3" />
        <AppLinkedTable
          v-else
          :columns="columns"
          :rows="tokens"
          :rowActions="rowActions"
          search=""
          :empty="t('settings.runners.joinTokenNone')"
        />
      </div>
    </template>
    <template #footer>
      <BsButton v-if="creating || made" icon="arrow-left" @click="backToList">{{
        t('settings.runners.joinTokensBack')
      }}</BsButton>
      <BsButton
        v-if="creating && !made"
        icon="ticket"
        :colorClass="canCreate ? 'primary' : 'secondary'"
        :disabled="!canCreate"
        @click="create"
        >{{ t('settings.runners.joinTokenCreate') }}</BsButton
      >
      <BsButton v-if="!creating && !made && !readOnly" icon="plus" @click="creating = true">{{
        t('settings.runners.newJoinToken')
      }}</BsButton>
      <BsButton v-if="!creating && !made" colorClass="secondary" icon="xmark" @click="emit('close')">{{
        t('common.close')
      }}</BsButton>
    </template>
  </BsModal>
</template>

<style scoped>
/* the installer's command and a container's settings, as the API token's example */
.af-join-example {
  padding: 0.75rem 1rem;
  border-radius: var(--bs-border-radius);
  background-color: var(--bs-tertiary-bg);
  border: 1px solid var(--bs-border-color);
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
