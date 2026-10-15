<script setup>
/******************************************************************/
/*                                                                */
/*  A notification channel's page (/settings/notifications/<id>), */
/*  opened from the channels' list : the steps of its dialog as   */
/*  tabs, by its type, the tab kept in the url -                  */
/*    Details     its name, description, whether it is sent to    */
/*                (Enabled), and for mail whether it is the one   */
/*                the app sends with (Active)                     */
/*    Type        what it is (it stays), the types as radio       */
/*                buttons                                         */
/*    mail        Sender (the from address), Credentials (its     */
/*                smtp credential : the mail server, its port and */
/*                TLS, and the login)                             */
/*    slack/teams Webhook (its address, a secret)                 */
/*    telegram    Bot (its token's credential, the chat, the Bot  */
/*                API)                                            */
/*    webhook     Endpoint (url, method, token, TLS check),       */
/*                Payload (headers, the JSON template)            */
/*  Send test (a dialog : to whom for mail, then how it went),    */
/*  Delete and Save top right. ?test=1 opens the test dialog (the */
/*  list's Send test). A channel of the config seed is read only, */
/*  and can be tested.                                            */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';
import Profile from '@/lib/Profile';
import Helpers from '@/lib/Helpers';
import getSettings, {
  CHANNEL_ICONS,
  CHANNEL_TYPES,
  DEFAULT_PAYLOAD,
  PAYLOAD_PLACEHOLDERS,
  channelType,
  channelAddress,
} from '@/config/settings';
import { useUnsavedGuard } from '@/composables/useUnsavedGuard';
import { useRouteTab } from '@/composables/useRouteTab';
import { recordButtons } from '@/lib/recordButtons';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authenticated = ref(false);
const loaded = ref(false);

// ─── the channel ──────────────────────────────────────────────────────────────
const channelId = computed(() => String(route.params.id || ''));
const channel = ref(null); // as saved
const edit = ref(null); // as edited
const type = computed(() => channelType(channel.value));
// the fields each type edits, besides its name and description
const EDITED_BY_TYPE = {
  mail: ['from_address', 'credential'],
  slack: ['webhook_url'],
  teams: ['webhook_url'],
  telegram: ['token_credential', 'chat_id', 'api_url'],
  webhook: ['url', 'method', 'token_credential', 'verify_tls', 'headers', 'payload'],
};
// Enabled, and Default for mail, saved with Save as the rest
const edited = computed(() => [
  'name',
  'description',
  'enabled',
  ...(type.value === 'mail' ? ['is_active'] : []),
  ...EDITED_BY_TYPE[type.value],
]);

/**
 * The fields of a channel as this page edits them.
 *
 * Args:
 *   record (object): the channel.
 *
 * Returns:
 *   object: the edited fields.
 */
function editable(record) {
  return {
    name: record.name ?? '',
    description: record.description ?? '',
    enabled: !!record.enabled,
    is_active: !!record.is_active,
    from_address: record.from_address ?? '',
    credential: record.credential ?? '',
    // masked by the API : sent back as it is, it stays
    webhook_url: record.webhook_url ?? '',
    token_credential: record.token_credential ?? '',
    chat_id: record.chat_id ?? '',
    api_url: record.api_url ?? '',
    url: record.url ?? '',
    method: record.method || 'POST',
    verify_tls: record.verify_tls === undefined || record.verify_tls === null ? true : !!record.verify_tls,
    headers: record.headers ?? '',
    payload: record.payload ?? '',
  };
}

const managed = computed(() => !!channel.value?.managed);
const dirty = computed(
  () =>
    !!channel.value &&
    edited.value.some((k) => String(edit.value[k] ?? '') !== String(editable(channel.value)[k] ?? '')),
);
// leaving with the channel changed and unsaved asks first
useUnsavedGuard(
  dirty,
  () => t('settings.common.unsavedChanges'),
  () => save(),
);

// the credentials its logins and tokens are : smtp ones for mail, api ones for a token ; none first
const credentials = ref([]);
const credentialsOf = (credentialType) => [
  { name: '' },
  ...credentials.value.filter((c) => c.credential_type === credentialType).map((c) => ({ name: c.name })),
];
const METHODS = ['POST', 'PUT'].map((value) => ({ value, label: value }));

/**
 * Loads the credentials the dropdowns offer.
 */
async function loadCredentials() {
  const res = await axios.get('/api/v2/credential/').catch(() => null);
  credentials.value = res?.data?.records || [];
}

/**
 * Loads the channel and the credentials.
 */
async function load() {
  try {
    const res = await axios.get(`/api/v2/notificationchannel/${encodeURIComponent(channelId.value)}`);
    const record = res.data.records ? res.data.records[0] : res.data;
    channel.value = record?.id ? record : null;
    edit.value = channel.value ? editable(record) : null;
  } catch {
    channel.value = null;
  }
  await loadCredentials();
  loaded.value = true;
}

/**
 * Saves fields of the channel.
 *
 * Args:
 *   data (object): the fields.
 *
 * Returns:
 *   Promise<boolean>: whether they were saved.
 */
async function update(data) {
  try {
    await axios.put(`/api/v2/notificationchannel/${encodeURIComponent(channelId.value)}`, data);
    return true;
  } catch (err) {
    toast.error(err.response?.data?.message || err.response?.data?.error || err.message);
    return false;
  }
}

// Add credential : the credentials' own dialog, over this page ; what it creates is chosen in the
// field it was asked for
const credentialsSettings = computed(() => getSettings(t).credentials);
const creator = ref(null);
const creatingFor = ref('credential');

/**
 * Opens the credentials' dialog, its type preset, for a field.
 *
 * Args:
 *   key (string): credential or token_credential.
 *   credentialType (string): smtp or api.
 */
function newCredential(key, credentialType) {
  creatingFor.value = key;
  creator.value?.newItem({ credential_type: credentialType });
}

/**
 * Chooses the credential just created in the credentials' dialog.
 *
 * Args:
 *   name (string): the new credential's name.
 */
async function onCredentialCreated(name) {
  await loadCredentials();
  edit.value[creatingFor.value] = name;
}

// ─── tabs ─────────────────────────────────────────────────────────────────────
// mail : where it sends and as whom are its smtp credential (the server, port, TLS, login)
const TABS_BY_TYPE = {
  mail: [
    { key: 'sender', label: 'stepSender', icon: 'envelope' },
    { key: 'credentials', label: 'tabCredentials', icon: 'key' },
  ],
  slack: [{ key: 'connection', label: 'stepWebhook', icon: 'link' }],
  teams: [{ key: 'connection', label: 'stepWebhook', icon: 'link' }],
  telegram: [{ key: 'connection', label: 'stepBot', icon: 'robot' }],
  webhook: [
    { key: 'connection', label: 'stepEndpoint', icon: 'globe' },
    { key: 'payload', label: 'stepPayload', icon: 'code' },
  ],
};
const tabs = computed(() => [
  { key: 'details', label: t('settings.common.tabDetails'), icon: 'sliders' },
  { key: 'type', label: t('settings.notificationChannels.stepType'), icon: 'shapes' },
  ...TABS_BY_TYPE[type.value].map((x) => ({
    ...x,
    label:
      x.label === 'tabCredentials'
        ? t('settings.common.tabCredentials')
        : t(`settings.notificationChannels.${x.label}`),
  })),
]);
const { activeTab, tabLink } = useRouteTab('details', (key) => tabs.value.some((x) => x.key === key));

// the title : Notifications › <name>, each step a link
const pageCrumbs = computed(() => [
  { title: t('sidebar.notifications'), icon: 'bell', to: '/settings/notifications' },
  {
    title: channel.value?.name || (loaded.value ? channelId.value : null),
    icon: CHANNEL_ICONS[type.value],
    to: `/settings/notifications/${channelId.value}`,
  },
]);
// and the open tab last, as every page in tabs names it : Users › admin › Groups
const crumbs = computed(() => {
  const tab = tabs.value.find((x) => x.key === activeTab.value);
  return tab ? [...pageCrumbs.value, { title: tab.label, icon: tab.icon, to: tabLink(tab.key) }] : pageCrumbs.value;
});

// ─── actions ──────────────────────────────────────────────────────────────────
/**
 * Saves the fields of every tab : its name and description, and its type's.
 */
async function save() {
  const e = edit.value;
  if (!e.name.trim()) {
    toast.warning(t('settings.notificationChannels.fieldsRequired'));
    return;
  }
  const data = { name: e.name.trim(), description: e.description.trim(), enabled: e.enabled ? 1 : 0 };
  // the default mail channel : made it here, the one before stops being it (never unmade here)
  if (type.value === 'mail' && e.is_active && !channel.value.is_active) data.is_active = 1;
  for (const key of EDITED_BY_TYPE[type.value]) {
    const value = e[key];
    if (typeof value === 'boolean') data[key] = value ? 1 : 0;
    else data[key] = typeof value === 'string' ? value.trim() : value;
  }
  if (await update(data)) {
    toast.success(`${data.name} ${t('settings.common.isUpdated')}`);
    await load();
  }
}

// Send test : a dialog - for mail the address (the one typed last offered again, this browser
// only), for the others where it goes - then a notification through the channel as saved, and
// how it went
const TEST_TO_KEY = 'af.mailTestTo';
const readTestTo = () => {
  try {
    return localStorage.getItem(TEST_TO_KEY) || '';
  } catch {
    return '';
  }
};
const testOpen = ref(false);
const testTo = ref(readTestTo());
const testing = ref(false);
// how the last test went : { ok, text }
const testResult = ref(null);

/**
 * Opens the test dialog.
 */
function openTest() {
  testResult.value = null;
  testOpen.value = true;
}

/**
 * Sends a test notification and says how it went, in the dialog.
 */
async function sendTest() {
  if (type.value === 'mail' && !testTo.value.trim()) {
    toast.warning(t('admin.mail.enterDestination'));
    return;
  }
  testing.value = true;
  testResult.value = null;
  try {
    const res = await axios.post(
      `/api/v2/notificationchannel/${encodeURIComponent(channelId.value)}/test`,
      type.value === 'mail' ? { to: testTo.value.trim() } : {},
    );
    testResult.value = { ok: true, text: res.data.message || res.data.result?.message };
    if (type.value === 'mail') {
      try {
        localStorage.setItem(TEST_TO_KEY, testTo.value.trim());
      } catch {
        // no storage here : the address is asked again next time
      }
    }
  } catch (err) {
    testResult.value = { ok: false, text: Helpers.parseAxiosResponseError(err) };
  } finally {
    testing.value = false;
  }
}

// Delete asks first
const confirmDelete = ref(false);

/**
 * Deletes the channel, then goes back to the channels.
 */
async function deleteChannel() {
  confirmDelete.value = false;
  try {
    await axios.delete(`/api/v2/notificationchannel/${encodeURIComponent(channelId.value)}`);
    channel.value = null;
    router.push('/settings/notifications');
  } catch (err) {
    toast.error(err.response?.data?.message || err.response?.data?.error || err.message);
  }
}

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
  if (!authenticated.value) return;
  await load();
  // the list's Send test : its dialog open at once
  if (channel.value && route.query.test) {
    openTest();
    router.replace({ query: { ...route.query, test: undefined } });
  }
});
</script>
<template>
  <!-- Send test : for mail to whom ; then Send, and how it went -->
  <BsModal v-if="testOpen" size="md" @close="testOpen = false" icon="paper-plane">
    <template #title>{{ t('settings.notificationChannels.sendTest') }}</template>
    <template #default>
      <form v-if="type === 'mail'" @submit.prevent="sendTest()">
        <BsInput
          v-model="testTo"
          type="email"
          icon="envelope"
          placeholder="you@example.com"
          :isFloating="false"
          :required="true"
          :label="t('admin.mail.mailTo')"
          :help="t('settings.notificationChannels.testHelpMail', { name: channel?.name })"
        />
      </form>
      <p v-else class="mb-0">
        {{ t('settings.notificationChannels.testHelp', { name: channel?.name, to: channelAddress(t, channel) }) }}
      </p>
      <div
        v-if="testResult"
        class="alert py-2 mt-3 mb-0"
        :class="testResult.ok ? 'alert-success' : 'alert-danger'"
        role="status"
      >
        <FaIcon :icon="testResult.ok ? 'circle-check' : 'triangle-exclamation'" class="me-2" />{{ testResult.text }}
      </div>
    </template>
    <template #footer>
      <BsButton icon="paper-plane" :disabled="testing || (type === 'mail' && !testTo.trim())" @click="sendTest()">{{
        t('settings.notificationChannels.send')
      }}</BsButton>
    </template>
  </BsModal>
  <BsModal v-if="confirmDelete" size="md" @close="confirmDelete = false" icon="trash">
    <template #title> {{ t('common.delete') }} {{ channel?.name }} </template>
    <template #default>
      <p class="mb-0 fs-6 user-select-none">
        {{ t('settings.common.deleteConfirm') }} <strong>{{ channel?.name }}</strong
        >?
      </p>
    </template>
    <template #footer>
      <BsButton icon="trash" @click="deleteChannel()">{{ t('common.delete') }}</BsButton>
    </template>
  </BsModal>
  <!-- Add credential : the credentials' dialog only, its type preset -->
  <div class="af-nested-dialogs">
    <AppAdminMulti
      ref="creator"
      dialogOnly
      :apiVersion="2"
      :settings="credentialsSettings"
      @created="onCredentialCreated"
    />
  </div>
  <AppSettingsPage>
    <AppSettings
      v-if="authenticated"
      :icon="CHANNEL_ICONS[type]"
      :title="channel?.name || channelId"
      :crumbs="crumbs"
      :description="t('settings.notificationChannels.description')"
    >
      <template v-if="channel" #tabs>
        <ul class="nav nav-tabs mb-0">
          <li v-for="tab in tabs" :key="tab.key" class="nav-item">
            <a
              class="nav-link"
              :class="{ active: activeTab === tab.key }"
              href="#"
              @click.prevent="activeTab = tab.key"
            >
              <FaIcon :icon="tab.icon" class="me-1" />
              {{ tab.label }}
            </a>
          </li>
        </ul>
      </template>
      <!-- the record loading : its tabs as grey placeholders -->
      <template v-else-if="!loaded" #tabs>
        <AppSkeleton shape="tabs" :count="tabs.length" />
      </template>
      <template #default>
        <div v-if="loaded && !channel" class="empty-state">
          <FaIcon icon="bell" class="empty-state-icon" />
          <span>{{ t('settings.notificationChannels.notFound', { id: channelId }) }}</span>
        </div>
        <!-- the record loading : its fields as grey placeholders, where they come -->
        <AppSkeleton v-else-if="!loaded && !channel" shape="form" :count="3" />
        <div v-else-if="channel && edit" class="af-channel-tab">
          <!-- a channel of the config seed : read only here -->
          <div v-if="managed" class="alert alert-secondary py-2">
            <FaIcon icon="lock" class="me-2" />{{ t('settings.common.seedManagedNotice') }}
          </div>
          <fieldset :disabled="managed">
            <!-- Details : what it is called, whether it is sent to (and for mail, used) -->
            <template v-if="activeTab === 'details'">
              <BsInput
                class="af-channel-field"
                v-model="edit.name"
                icon="heading"
                :isFloating="false"
                :required="true"
                :label="t('settings.fields.name')"
              />
              <BsInput
                class="af-channel-field"
                v-model="edit.description"
                icon="info-circle"
                :isFloating="false"
                :label="t('settings.fields.description')"
              />
              <div v-if="type === 'mail'" class="mb-3">
                <label class="form-label fw-bold d-block" for="af-channel-active">{{
                  t('settings.notificationChannels.active')
                }}</label>
                <!-- turned on, saved with Save ; turned off by making another the default -->
                <div class="form-check form-switch mb-0">
                  <input
                    id="af-channel-active"
                    v-model="edit.is_active"
                    class="form-check-input"
                    type="checkbox"
                    role="switch"
                    :disabled="!!channel.is_active"
                  />
                </div>
                <div class="form-text">{{ t('settings.notificationChannels.activeHelp') }}</div>
              </div>
            </template>

            <!-- Type : what it is, set when it was made -->
            <template v-else-if="activeTab === 'type'">
              <div v-for="kind in CHANNEL_TYPES" :key="kind" class="form-check af-short-check">
                <input
                  :id="'af-chtype-' + kind"
                  :checked="kind === type"
                  class="form-check-input"
                  type="radio"
                  name="af-channel-type"
                  :value="kind"
                  disabled
                />
                <label class="form-check-label" :for="'af-chtype-' + kind">
                  <span class="af-short-label"
                    ><FaIcon :icon="CHANNEL_ICONS[kind]" class="me-2" fixedwidth />{{
                      t(`settings.notificationChannels.type_${kind}`)
                    }}</span
                  >
                  <span class="text-body-secondary small">{{
                    t(`settings.notificationChannels.typeHint_${kind}`)
                  }}</span>
                </label>
              </div>
            </template>
            <!-- mail : Sender, the from address -->
            <template v-else-if="type === 'mail' && activeTab === 'sender'">
              <BsInput
                class="af-channel-field"
                v-model="edit.from_address"
                type="email"
                icon="envelope"
                placeholder="noreply@example.com"
                :isFloating="false"
                :required="true"
                :help="t('settings.mail.mailFromHelp')"
                :label="t('settings.mail.mailFrom')"
              />
            </template>
            <!-- mail : Credentials, its smtp credential (the mail server, its port and TLS, the login) -->
            <template v-else-if="type === 'mail' && activeTab === 'credentials'">
              <BsInput
                class="af-channel-field"
                v-model="edit.credential"
                type="select"
                icon="key"
                :isFloating="false"
                :values="credentialsOf('smtp')"
                valueKey="name"
                labelKey="name"
                :required="true"
                :help="t('settings.notificationChannels.helpCredential')"
                :label="t('settings.notificationChannels.credential')"
              />
              <BsButton v-if="!managed" icon="plus" @click="newCredential('credential', 'smtp')">{{
                t('settings.repositories.newCredential')
              }}</BsButton>
            </template>

            <!-- slack, teams : Webhook, its address (a secret : shown masked, kept unless retyped) -->
            <template v-else-if="(type === 'slack' || type === 'teams') && activeTab === 'connection'">
              <BsInput
                class="af-channel-field"
                v-model="edit.webhook_url"
                type="password"
                icon="link"
                placeholder="https://"
                :isFloating="false"
                :required="true"
                :help="t(`settings.notificationChannels.webhookUrlHelp_${type}`)"
                :label="t('settings.notificationChannels.webhookUrl')"
              />
            </template>

            <!-- telegram : Bot, its token's credential, the chat, the Bot API -->
            <template v-else-if="type === 'telegram' && activeTab === 'connection'">
              <BsInput
                class="af-channel-field"
                v-model="edit.token_credential"
                type="select"
                icon="key"
                :isFloating="false"
                :required="true"
                :values="credentialsOf('api')"
                valueKey="name"
                labelKey="name"
                :help="t('settings.notificationChannels.tokenCredentialHelp_telegram')"
                :label="t('settings.notificationChannels.tokenCredential_telegram')"
              />
              <BsButton v-if="!managed" class="mb-3" icon="plus" @click="newCredential('token_credential', 'api')">{{
                t('settings.repositories.newCredential')
              }}</BsButton>
              <BsInput
                class="af-channel-field"
                v-model="edit.chat_id"
                icon="comments"
                placeholder="-1001234567890"
                :isFloating="false"
                :required="true"
                :help="t('settings.notificationChannels.chatIdHelp')"
                :label="t('settings.notificationChannels.chatId')"
              />
              <BsInput
                class="af-channel-field"
                v-model="edit.api_url"
                icon="globe"
                placeholder="https://api.telegram.org"
                :isFloating="false"
                :help="t('settings.notificationChannels.apiUrlHelp')"
                :label="t('settings.notificationChannels.apiUrl')"
              />
            </template>

            <!-- webhook : Endpoint, where and how it is sent -->
            <template v-else-if="type === 'webhook' && activeTab === 'connection'">
              <BsInput
                class="af-channel-field"
                v-model="edit.url"
                icon="globe"
                placeholder="https://hooks.example.com/ansibleforms"
                :isFloating="false"
                :required="true"
                :help="t('settings.notificationChannels.urlHelp')"
                :label="t('settings.notificationChannels.url')"
              />
              <BsInput
                class="af-channel-field"
                v-model="edit.method"
                type="select"
                icon="arrow-right"
                :isFloating="false"
                :values="METHODS"
                valueKey="value"
                labelKey="label"
                :label="t('settings.notificationChannels.method')"
              />
              <BsInput
                class="af-channel-field"
                v-model="edit.token_credential"
                type="select"
                icon="key"
                :isFloating="false"
                :values="credentialsOf('api')"
                valueKey="name"
                labelKey="name"
                :help="t('settings.notificationChannels.tokenCredentialHelp_webhook')"
                :label="t('settings.notificationChannels.tokenCredential_webhook')"
              />
              <BsButton v-if="!managed" class="mb-3" icon="plus" @click="newCredential('token_credential', 'api')">{{
                t('settings.repositories.newCredential')
              }}</BsButton>
              <div class="form-check form-switch mb-3">
                <input
                  id="af-channel-verify"
                  v-model="edit.verify_tls"
                  class="form-check-input"
                  type="checkbox"
                  role="switch"
                />
                <label class="form-check-label" for="af-channel-verify">{{
                  t('settings.notificationChannels.verifyTls')
                }}</label>
                <div class="form-text mt-1">{{ t('settings.notificationChannels.verifyTlsHelp') }}</div>
              </div>
            </template>
            <!-- webhook : Payload, its headers and the JSON it sends -->
            <template v-else-if="type === 'webhook' && activeTab === 'payload'">
              <BsInput
                class="af-channel-field af-channel-code"
                v-model="edit.headers"
                type="textarea"
                :rows="3"
                placeholder='{ "X-Source": "ansibleforms" }'
                :isFloating="false"
                :help="t('settings.notificationChannels.headersHelp')"
                :label="t('settings.notificationChannels.headers')"
              />
              <BsInput
                class="af-channel-field af-channel-code"
                v-model="edit.payload"
                type="textarea"
                :rows="10"
                :placeholder="DEFAULT_PAYLOAD"
                :isFloating="false"
                :help="t('settings.notificationChannels.payloadHelp', { placeholders: PAYLOAD_PLACEHOLDERS })"
                :label="t('settings.notificationChannels.payload')"
              />
            </template>
          </fieldset>
        </div>
      </template>
      <template v-if="channel" #actions>
        <!-- a notification through it, as saved : unsaved changes are saved first -->
        <BsButton
          icon="paper-plane"
          cssClass="text-nowrap"
          :disabled="dirty"
          :title="dirty ? t('settings.notificationChannels.testSaveFirst') : ''"
          @click="openTest()"
          >{{ t('settings.notificationChannels.sendTest') }}</BsButton
        >
        <template v-if="!managed">
          <BsButton icon="trash" @click="confirmDelete = true">{{ t('common.delete') }}</BsButton>
          <BsButton icon="save" :disabled="!dirty" @click="save()">{{ t('settings.common.save') }}</BsButton>
        </template>
      </template>
      <!-- the record loading : its buttons as grey placeholders, so the title line keeps its
           height and nothing moves when they come -->
      <template v-else-if="!loaded" #actions>
        <AppSkeleton shape="buttons" :widths="recordButtons('notifications', channelId)" />
      </template>
    </AppSettings>
  </AppSettingsPage>
</template>
<style scoped>
/* the wide fields' width of the settings pages, as a runner's and a credential's */
.af-channel-field :deep(.input-group),
.af-channel-field :deep(textarea) {
  max-width: 40rem;
}
/* a JSON template reads as code */
.af-channel-code :deep(textarea) {
  font-family: var(--bs-font-monospace);
  font-size: 0.875rem;
}
/* the tab ends a little above the card's edge, as every record's page (24px in all) */
.af-channel-tab {
  padding-bottom: 0.5rem;
}
/* the fields sit in a fieldset (read only for the config seed's channels) : the card cannot reach
   its last field's margin to zero it, so it is zeroed here */
.af-channel-tab fieldset > :last-child,
.af-channel-tab fieldset > :last-child :deep(.mb-3:last-child) {
  margin-bottom: 0 !important;
}
/* the radio buttons : their labels one width, so the grey hints line up, as a credential's */
.af-short-check {
  margin-bottom: 0.6rem;
}
.af-short-label {
  display: inline-block;
  min-width: 12rem;
}
</style>
<route lang="yaml">
meta:
  layout: settings
</route>
