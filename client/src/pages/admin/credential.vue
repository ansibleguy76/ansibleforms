<script setup>
/******************************************************************/
/*                                                                */
/*  A credential's page (/settings/credentials/<id>), opened from    */
/*  the credentials' list : the steps of its dialog as tabs, the  */
/*  tab kept in the url -                                         */
/*    Details     its name and description                        */
/*    Type        what it is for (SSH, Git, LDAP, SSO ...)        */
/*    Login       where it connects (SSH, a database : the host   */
/*                and port, a database's type and name), its user */
/*                and password (a CyberArk's AppID, client        */
/*                certificate and key ; an Entra ID one's tenant) */
/*                ; the password masked : left empty kept, typed  */
/*                replaced                                        */
/*    Store       where the user and password are kept : the app's*/
/*                database, or a secret store (not a CyberArk's)  */
/*  Test connection (a database), Delete and Save top right. A    */
/*  credential of the config seed is read only.                   */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';
import Profile from '@/lib/Profile';
import TokenStorage from '@/lib/TokenStorage';
import Helpers from '@/lib/Helpers';
import { CREDENTIAL_TYPES } from '@/config/settings';
import { useUnsavedGuard } from '@/composables/useUnsavedGuard';
import { useRouteTab } from '@/composables/useRouteTab';
import { recordButtons } from '@/lib/recordButtons';
import { ssoCallbackUrl, SSO_EXAMPLE_BASE } from '@/lib/ssoCallback';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authenticated = ref(false);
const loaded = ref(false);

// ─── the credential ───────────────────────────────────────────────────────────
const credentialId = computed(() => String(route.params.id || ''));
const credential = ref(null); // as saved
const edit = ref(null); // as edited
const secretStores = ref([]); // the stores a credential can read from
// what this page edits : the password has its own dialog ; a CyberArk's client key is typed
// on the Login tab, left empty to keep the stored one
const EDITED = [
  'name',
  'description',
  'credential_type',
  'user',
  'client_cert',
  'client_key',
  'tenant_id',
  'issuer',
  'redirect_uri',
  'secret_source',
  'secret_store',
  'secret_ref',
  'host',
  'port',
  'secure',
  'db_type',
  'db_name',
];
const DB_TYPES = [
  { value: 'mysql', label: 'MySQL' },
  { value: 'mssql', label: 'MSSQL' },
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'oracle', label: 'Oracle' },
  { value: 'mongodb', label: 'MongoDB' },
];

/**
 * The fields of a credential as this page edits them : its type (from is_database for an old
 * one), where its secret is kept, the client key always empty (the stored one is never sent).
 *
 * Args:
 *   record (object): the credential.
 *
 * Returns:
 *   object: the edited fields.
 */
function editable(record) {
  return {
    name: record.name ?? '',
    description: record.description ?? '',
    credential_type: CREDENTIAL_TYPES.includes(record.credential_type)
      ? record.credential_type
      : record.is_database
        ? 'database'
        : 'userpass',
    user: record.user ?? '',
    client_cert: record.client_cert ?? '',
    client_key: '',
    tenant_id: record.tenant_id ?? '',
    issuer: record.issuer ?? '',
    redirect_uri: record.redirect_uri ?? '',
    secret_source: record.secret_store ? 'store' : 'local',
    secret_store: record.secret_store ?? '',
    secret_ref: record.secret_ref ?? '',
    host: record.host ?? '',
    port: record.port ?? '',
    secure: !!record.secure,
    db_type: record.db_type || 'mysql',
    db_name: record.db_name ?? '',
  };
}

const managed = computed(() => !!credential.value?.managed);
const type = computed(() => edit.value?.credential_type);
const isCyberark = computed(() => type.value === 'cyberark');
const isDatabase = computed(() => type.value === 'database');
// read from a secret store : the user and password typed here are not kept (a CyberArk's never is)
const fromStore = computed(() => !isCyberark.value && edit.value?.secret_source === 'store');
const dirty = computed(
  () =>
    !!credential.value &&
    (EDITED.some((k) => String(edit.value[k] ?? '') !== String(editable(credential.value)[k] ?? '')) ||
      !!newPassword.value),
);
// leaving with the credential changed and unsaved asks first
useUnsavedGuard(
  dirty,
  () => t('settings.common.unsavedChanges'),
  () => save(),
);

/**
 * Loads the credential and the secret stores it can read from.
 */
async function load() {
  const auth = TokenStorage.getAuthentication();
  try {
    const res = await axios.get(`/api/v2/credential/${encodeURIComponent(credentialId.value)}`, auth);
    const record = res.data.records ? res.data.records[0] : res.data;
    credential.value = record?.id ? record : null;
    edit.value = credential.value ? editable(record) : null;
  } catch {
    credential.value = null;
  }
  const [stores, mails, repos, directories, providers, chat] = await Promise.all([
    axios.get('/api/v2/secretstore/', auth).catch(() => null),
    axios.get('/api/v2/notificationchannel/', auth).catch(() => null),
    axios.get('/api/v2/repository/', auth).catch(() => null),
    axios.get('/api/v2/ldapdirectory/', auth).catch(() => null),
    axios.get('/api/v2/oauth2/', auth).catch(() => null),
    axios.get('/api/v2/chatsettings/', auth).catch(() => null),
  ]);
  secretStores.value = [{ name: '' }, ...(stores?.data?.records || []).map((s) => ({ name: s.name }))];
  // what names a credential : a secret store (its token or login), a notification channel (a
  // mail server's smtp login, a bot's or a webhook's token), a repository (its git login), an LDAP
  // directory (its bind account), an SSO provider (its client), the chat assistant (its key) ; the
  // Used by tab keeps those naming this one
  users.value = [
    ...(stores?.data?.records || []).map((r) => ({ ...r, kind: 'secretStore', to: `/settings/secret-stores/${r.id}` })),
    ...(mails?.data?.records || []).map((r) => ({
      ...r,
      kind: 'notificationChannel',
      to: `/settings/notifications/${r.id}`,
    })),
    ...(repos?.data?.records || []).map((r) => ({ ...r, kind: 'repository', to: `/settings/repositories/${r.id}` })),
    ...(directories?.data?.records || []).map((r) => ({ ...r, kind: 'ldapDirectory', to: `/settings/ldap/${r.id}` })),
    ...(providers?.data?.records || []).map((r) => ({ ...r, kind: 'ssoProvider', to: `/settings/sso/${r.id}` })),
    ...(chat?.data?.credential
      ? [{ name: t('sidebar.chat'), credential: chat.data.credential, kind: 'chat', to: '/settings/chat' }]
      : []),
  ];
  loaded.value = true;
}

/**
 * Saves fields of the credential.
 *
 * Args:
 *   data (object): the fields.
 *
 * Returns:
 *   Promise<boolean>: whether they were saved.
 */
async function update(data) {
  try {
    await axios.put(`/api/v2/credential/${encodeURIComponent(credentialId.value)}`, data);
    return true;
  } catch (err) {
    toast.error(err.response?.data?.message || err.response?.data?.error || err.message);
    return false;
  }
}

// ─── Used by ──────────────────────────────────────────────────────────────────
// the secret stores, notification channels, repositories, LDAP directories, SSO providers and the
// chat assistant that name the credential (a channel as its login or its token) ; a row opens it
const users = ref([]);
const usedBy = computed(() =>
  credential.value ? users.value.filter((u) => [u.credential, u.token_credential].includes(credential.value.name)) : [],
);
const usedByColumns = computed(() => [
  { key: 'name', label: t('settings.fields.name') },
  { key: 'kind', label: t('settings.linked.kind'), value: (u) => t(`settings.linked.${u.kind}`) },
  { key: 'description', label: t('settings.fields.description') },
]);

// ─── tabs ─────────────────────────────────────────────────────────────────────
// the dialog's steps : Store not for a CyberArk's ; then what uses it. Where an SSH or a database
// credential connects is in its Login tab, with its user and password
const tabs = computed(() =>
  [
    { key: 'details', label: t('settings.common.tabDetails'), icon: 'sliders' },
    { key: 'type', label: t('settings.credentials.stepType'), icon: 'shapes' },
    { key: 'login', label: t('settings.credentials.stepLogin'), icon: 'user' },
    !isCyberark.value && { key: 'store', label: t('settings.credentials.stepStore'), icon: 'vault' },
    { key: 'used-by', label: t('settings.linked.usedBy'), icon: 'link', count: usedBy.value.length },
  ].filter(Boolean),
);
const { activeTab, tabLink } = useRouteTab('details', (key) =>
  ['details', 'type', 'login', 'store', 'connection', 'used-by'].includes(key),
);
// a tab the type does not have (Store of a CyberArk credential) : its first ; the Connection tab of
// before (a link kept) is the Login tab now
const shownTab = computed(() => {
  const key = activeTab.value === 'connection' ? 'login' : activeTab.value;
  return tabs.value.some((x) => x.key === key) ? key : 'details';
});
// an SSH, a database or an smtp credential connects somewhere : its host and port in its Login
// tab (an smtp one's the mail server, and its TLS)
const hasConnection = computed(() => ['ssh', 'database', 'smtp'].includes(type.value));
const isSmtp = computed(() => type.value === 'smtp');
// an Entra ID or Open ID one : the app registration of an SSO provider, its redirect URL too
const isSso = computed(() => ['entraid', 'oidc'].includes(type.value));
// the redirect URL it gets when left empty : the app's address (Settings > URL) and the callback
const appUrl = ref('');
const defaultRedirect = computed(
  () => ssoCallbackUrl(type.value, appUrl.value) || ssoCallbackUrl(type.value, SSO_EXAMPLE_BASE),
);

// the title : Credentials › <name>, each step a link
const pageCrumbs = computed(() => [
  { title: t('sidebar.credentials'), icon: 'lock', to: '/settings/credentials' },
  {
    title: credential.value?.name || (loaded.value ? credentialId.value : null),
    icon: 'lock',
    to: `/settings/credentials/${credentialId.value}`,
  },
]);
// and the open tab last, as every page in tabs names it : Users › admin › Groups
const crumbs = computed(() => {
  const tab = tabs.value.find((x) => x.key === shownTab.value);
  return tab ? [...pageCrumbs.value, { title: tab.label, icon: tab.icon, to: tabLink(tab.key) }] : pageCrumbs.value;
});

// ─── actions ──────────────────────────────────────────────────────────────────
/**
 * Saves the fields of every tab, as the dialog saves them : read from a secret store, no user
 * and password are kept ; kept in the app's database, no secret store.
 */
async function save() {
  const e = edit.value;
  if (!e.name.trim() || !e.description.trim()) {
    toast.warning(t('settings.credentials.fieldsRequired'));
    return;
  }
  const data = {
    name: e.name.trim(),
    description: e.description.trim(),
    credential_type: e.credential_type,
    host: hasConnection.value ? e.host.trim() : '',
    port: hasConnection.value && String(e.port ?? '').trim() !== '' ? e.port : null,
    // an smtp one's TLS
    secure: e.credential_type === 'smtp' && e.secure ? 1 : 0,
    db_type: isDatabase.value ? e.db_type : '',
    db_name: isDatabase.value ? e.db_name.trim() : '',
  };
  if (fromStore.value) {
    Object.assign(data, { secret_store: e.secret_store, secret_ref: e.secret_ref.trim() });
  } else {
    Object.assign(data, { secret_store: '', secret_ref: '', user: e.user.trim() });
    // an Entra ID one's tenant
    data.tenant_id = e.credential_type === 'entraid' ? e.tenant_id.trim() : '';
    // an Open ID one's issuer
    data.issuer = e.credential_type === 'oidc' ? e.issuer.trim() : '';
    // an Entra ID or Open ID one's redirect URL : empty, the app's address and the callback path
    data.redirect_uri = isSso.value ? e.redirect_uri.trim() : '';
    // its new password, typed in its Login tab
    if (newPassword.value && !isCyberark.value) data.password = newPassword.value;
  }
  if (isCyberark.value) {
    data.client_cert = e.client_cert;
    // left empty, the stored key stays
    if (e.client_key.trim()) data.client_key = e.client_key;
  }
  if (await update(data)) {
    toast.success(`${data.name} ${t('settings.common.isUpdated')}`);
    newPassword.value = '';
    await load();
  }
}

// Test connection : a database credential, one at a time
const testing = ref(false);

/**
 * Logs in to the database with the credential, and says how it went.
 */
async function testConnection() {
  testing.value = true;
  try {
    const result = await axios.get(`/api/v2/credential/testdb/${encodeURIComponent(credentialId.value)}`);
    toast.success(result.data.message);
  } catch (err) {
    toast.error(Helpers.parseAxiosResponseError(err, t('admin.connectionFailed')));
  } finally {
    testing.value = false;
  }
}

// its password, typed in its Login tab ; empty, the stored one is kept
const newPassword = ref('');
// the user and the password as its type names them : an LDAP one's bind DN and password, an SSO
// one's (Entra ID, Open ID) client id and secret, a CyberArk one's AppID
const userLabel = computed(
  () =>
    ({
      cyberark: t('settings.secretStores.appId'),
      ldap: t('settings.ldap.bindUserDn'),
      entraid: t('settings.oauth2.clientId'),
      oidc: t('settings.oauth2.clientId'),
    })[edit.value?.credential_type] || t('settings.fields.user'),
);
const passwordLabel = computed(
  () =>
    ({
      ldap: t('settings.ldap.bindUserPassword'),
      entraid: t('settings.oauth2.clientSecret'),
      oidc: t('settings.oauth2.clientSecret'),
    })[edit.value?.credential_type] || t('settings.fields.password'),
);

// Delete asks first
const confirmDelete = ref(false);

/**
 * Deletes the credential, then goes back to the credentials.
 */
async function deleteCredential() {
  confirmDelete.value = false;
  try {
    await axios.delete(`/api/v2/credential/${encodeURIComponent(credentialId.value)}`);
    credential.value = null;
    router.push('/settings/credentials');
  } catch (err) {
    toast.error(err.response?.data?.message || err.response?.data?.error || err.message);
  }
}

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
  if (!authenticated.value) return;
  await load();
  // the app's address : an SSO credential's redirect URL when left empty
  axios
    .get('/api/v2/settings')
    .then((res) => (appUrl.value = res.data?.url || ''))
    .catch(() => {});
});
</script>
<template>
  <BsModal v-if="confirmDelete" size="md" @close="confirmDelete = false" icon="trash">
    <template #title> {{ t('common.delete') }} {{ credential?.name }} </template>
    <template #default>
      <p class="mb-0 fs-6 user-select-none">
        {{ t('settings.common.deleteConfirm') }} <strong>{{ credential?.name }}</strong
        >?
      </p>
    </template>
    <template #footer>
      <BsButton icon="trash" @click="deleteCredential()">{{ t('common.delete') }}</BsButton>
    </template>
  </BsModal>
  <AppSettingsPage>
    <AppSettings
      v-if="authenticated"
      icon="lock"
      :title="credential?.name || credentialId"
      :crumbs="crumbs"
      :description="t('settings.credentials.description')"
    >
      <template v-if="credential" #tabs>
        <ul class="nav nav-tabs mb-0">
          <li v-for="tab in tabs" :key="tab.key" class="nav-item">
            <a class="nav-link" :class="{ active: shownTab === tab.key }" href="#" @click.prevent="activeTab = tab.key">
              <FaIcon :icon="tab.icon" class="me-1" />
              {{ tab.label }}
              <span v-if="tab.count !== undefined" class="badge af-tab-count ms-1">{{ tab.count }}</span>
            </a>
          </li>
        </ul>
      </template>
      <!-- the record loading : its tabs as grey placeholders -->
      <template v-else-if="!loaded" #tabs>
        <AppSkeleton shape="tabs" :count="tabs.length" />
      </template>
      <template #default>
        <div v-if="loaded && !credential" class="empty-state">
          <FaIcon icon="lock" class="empty-state-icon" />
          <span>{{ t('settings.credentials.notFound', { id: credentialId }) }}</span>
        </div>
        <!-- the record loading : its fields as grey placeholders, where they come -->
        <AppSkeleton v-else-if="!loaded && !credential" shape="form" :count="3" />
        <!-- Used by : what names the credential ; a row opens it -->
        <AppLinkedTable
          v-else-if="credential && shownTab === 'used-by'"
          :columns="usedByColumns"
          :rows="usedBy"
          rowKey="to"
          :to="(u) => u.to"
          :empty="t('settings.linked.noUse')"
        />
        <div v-else-if="credential && edit" class="af-credential-tab">
          <!-- a credential of the config seed : read only here -->
          <div v-if="managed" class="alert alert-secondary py-2">
            <FaIcon icon="lock" class="me-2" />{{ t('settings.common.seedManagedNotice') }}
          </div>
          <fieldset :disabled="managed">
            <!-- Details : what it is called -->
            <template v-if="shownTab === 'details'">
              <BsInput
                class="af-credential-field"
                v-model="edit.name"
                icon="lock"
                :isFloating="false"
                :required="true"
                :label="t('settings.fields.name')"
              />
              <BsInput
                class="af-credential-field"
                v-model="edit.description"
                icon="info-circle"
                :isFloating="false"
                :required="true"
                :label="t('settings.fields.description')"
              />
            </template>
            <!-- Type : what it is for, each its label and a few grey words ; set when it was made (what
                 uses it expects it) -->
            <template v-else-if="shownTab === 'type'">
              <div v-for="kind in CREDENTIAL_TYPES" :key="kind" class="form-check af-short-check">
                <input
                  :id="'af-ctype-' + kind"
                  v-model="edit.credential_type"
                  class="form-check-input"
                  type="radio"
                  name="af-credential-type"
                  :value="kind"
                  disabled
                />
                <label class="form-check-label" :for="'af-ctype-' + kind">
                  <span class="af-short-label">{{ t(`settings.credentials.type_${kind}`) }}</span>
                  <span class="text-body-secondary small">{{ t(`settings.credentials.type_${kind}Hint`) }}</span>
                </label>
              </div>
            </template>
            <!-- Login : its user (read from a store : nothing here) ; a CyberArk's AppID,
               client certificate and key -->
            <template v-else-if="shownTab === 'login'">
              <!-- where it connects (SSH, a database, a mail server) : a database's type, the host
                   and port, a database's name, a mail server's TLS ; then the user and password -->
              <template v-if="hasConnection">
                <BsInput
                  v-if="isDatabase"
                  class="af-credential-field"
                  v-model="edit.db_type"
                  type="select"
                  icon="database"
                  :isFloating="false"
                  :values="DB_TYPES"
                  valueKey="value"
                  labelKey="label"
                  :required="true"
                  :label="t('settings.credentials.databaseType')"
                />
                <BsInput
                  class="af-credential-field"
                  v-model="edit.host"
                  icon="server"
                  :placeholder="isSmtp ? 'smtp.example.com' : ''"
                  :isFloating="false"
                  :required="isSmtp"
                  :help="isSmtp ? t('settings.mail.mailServerHelp') : ''"
                  :label="isSmtp ? t('settings.mail.mailServer') : t('settings.fields.host')"
                />
                <BsInput
                  class="af-credential-field"
                  v-model="edit.port"
                  type="number"
                  icon="arrows-alt-v"
                  :isFloating="false"
                  :help="isSmtp ? t('settings.mail.mailPortHelp') : ''"
                  :label="isSmtp ? t('settings.mail.mailPort') : t('settings.fields.port')"
                />
                <!-- an smtp one : TLS -->
                <div v-if="isSmtp" class="form-check form-switch mb-3">
                  <input
                    id="af-credential-tls"
                    v-model="edit.secure"
                    class="form-check-input"
                    type="checkbox"
                    role="switch"
                  />
                  <label class="form-check-label" for="af-credential-tls">{{ t('settings.mail.useTls') }}</label>
                  <div class="form-text mt-1">{{ t('settings.mail.useTlsHelp') }}</div>
                </div>
                <BsInput
                  v-if="isDatabase"
                  class="af-credential-field"
                  v-model="edit.db_name"
                  icon="database"
                  :isFloating="false"
                  :label="t('settings.credentials.database')"
                />
              </template>
              <p v-if="fromStore" class="form-text mb-0">{{ t('settings.credentials.loginFromStore') }}</p>
              <template v-else>
                <!-- an Entra ID one's tenant : the tenant id the app is in, first as in
                     the Entra admin center (tenant, client id, secret) -->
                <BsInput
                  v-if="edit.credential_type === 'entraid'"
                  class="af-credential-field"
                  v-model="edit.tenant_id"
                  icon="building"
                  :isFloating="false"
                  :required="true"
                  :label="t('settings.oauth2.tenantId')"
                />
                <!-- an Open ID one's issuer : the provider's address, first as the tenant -->
                <BsInput
                  v-if="edit.credential_type === 'oidc'"
                  class="af-credential-field"
                  v-model="edit.issuer"
                  icon="globe"
                  placeholder="https://id.example.com/realms/main"
                  :isFloating="false"
                  :required="true"
                  :label="t('settings.oauth2.issuer')"
                />
                <BsInput
                  class="af-credential-field"
                  v-model="edit.user"
                  icon="user"
                  :isFloating="false"
                  :help="isCyberark ? t('settings.secretStores.appIdHelp') : ''"
                  :label="userLabel"
                />
                <template v-if="isCyberark">
                  <BsInput
                    class="af-credential-field"
                    v-model="edit.client_cert"
                    type="textarea"
                    icon="certificate"
                    placeholder="-----BEGIN CERTIFICATE-----"
                    :isFloating="false"
                    :help="t('settings.secretStores.clientCertHelp')"
                    :label="t('settings.secretStores.clientCert')"
                  />
                  <BsInput
                    class="af-credential-field"
                    v-model="edit.client_key"
                    type="textarea"
                    icon="key"
                    placeholder="-----BEGIN PRIVATE KEY-----"
                    :isFloating="false"
                    :help="t('settings.credentials.clientKeyKeep')"
                    :label="t('settings.secretStores.clientKey')"
                  />
                </template>
                <!-- its password, masked : left empty, the stored one is kept ; typed, replaced -->
                <BsInput
                  v-else
                  class="af-credential-field"
                  v-model="newPassword"
                  type="password"
                  icon="lock"
                  placeholder="**********"
                  :isFloating="false"
                  :disabled="managed"
                  :help="t('settings.common.passwordKeep')"
                  :label="passwordLabel"
                />
                <!-- an Entra ID or Open ID one's redirect URL, as registered with its client -->
                <BsInput
                  v-if="isSso"
                  class="af-credential-field"
                  v-model="edit.redirect_uri"
                  icon="link"
                  :placeholder="defaultRedirect"
                  :isFloating="false"
                  :help="t('settings.oauth2.redirectHelp')"
                  :label="t('settings.oauth2.redirectUrl')"
                />
              </template>
            </template>
            <!-- Store : the app's database, or a secret store and the place in it -->
            <template v-else>
              <div
                v-for="opt in [
                  {
                    value: 'local',
                    label: t('settings.credentials.secretLocal'),
                    hint: t('settings.credentials.secretLocalHint'),
                  },
                  {
                    value: 'store',
                    label: t('settings.credentials.secretFromStore'),
                    hint: t('settings.credentials.secretFromStoreHint'),
                  },
                ]"
                :key="opt.value"
                class="form-check af-short-check"
              >
                <input
                  :id="'af-source-' + opt.value"
                  v-model="edit.secret_source"
                  class="form-check-input"
                  type="radio"
                  name="af-credential-source"
                  :value="opt.value"
                />
                <label class="form-check-label" :for="'af-source-' + opt.value">
                  <span class="af-short-label">{{ opt.label }}</span>
                  <span class="text-body-secondary small">{{ opt.hint }}</span>
                </label>
              </div>
              <template v-if="fromStore">
                <BsInput
                  class="af-credential-field mt-3"
                  v-model="edit.secret_store"
                  type="select"
                  icon="vault"
                  :isFloating="false"
                  :values="secretStores"
                  valueKey="name"
                  labelKey="name"
                  :help="t('settings.credentials.secretStoreHelp')"
                  :label="t('settings.credentials.secretStore')"
                />
                <BsInput
                  class="af-credential-field"
                  v-model="edit.secret_ref"
                  icon="shield-alt"
                  :placeholder="t('settings.credentials.secretRefPlaceholder')"
                  :isFloating="false"
                  :help="t('settings.credentials.secretRefHelp')"
                  :label="t('settings.credentials.secretRef')"
                />
              </template>
            </template>
          </fieldset>
        </div>
      </template>
      <template v-if="credential" #actions>
        <BsButton
          v-if="credential.is_database"
          icon="plug"
          cssClass="text-nowrap"
          :disabled="testing"
          @click="testConnection()"
          >{{ t('settings.common.testConnection') }}</BsButton
        >
        <template v-if="!managed">
          <BsButton icon="trash" @click="confirmDelete = true">{{ t('common.delete') }}</BsButton>
          <BsButton icon="save" :disabled="!dirty" @click="save()">{{ t('settings.common.save') }}</BsButton>
        </template>
      </template>
      <!-- the record loading : its buttons as grey placeholders, so the title line keeps its
           height and nothing moves when they come -->
      <template v-else-if="!loaded" #actions>
        <AppSkeleton shape="buttons" :widths="recordButtons('credentials', credentialId)" />
      </template>
    </AppSettings>
  </AppSettingsPage>
</template>
<style scoped>
/* the count of a tab : small and grey, as the menus' badges */
.af-tab-count {
  background: var(--bs-secondary-bg);
  color: var(--bs-secondary-color);
  font-weight: 600;
}
/* the wide fields' width of the settings pages, as a runner's and a secret store's */
.af-credential-field :deep(.input-group) {
  max-width: 40rem;
}
/* the tab ends a little above the card's edge, as every record's page (24px in all) */
.af-credential-tab {
  padding-bottom: 0.5rem;
}
/* the fields sit in a fieldset (read only for the config seed's credentials) : the card cannot
   reach its last field's margin to zero it, so it is zeroed here */
.af-credential-tab fieldset > :last-child,
.af-credential-tab fieldset > :last-child :deep(.mb-3:last-child) {
  margin-bottom: 0 !important;
}
/* the radio buttons : their labels one width, so the grey hints line up, as in the dialog */
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
