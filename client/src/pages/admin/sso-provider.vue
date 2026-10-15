<script setup>
/******************************************************************/
/*                                                                */
/*  An SSO provider's page (/settings/sso/<id>), opened from the     */
/*  providers' list : the steps of its dialog as tabs, the tab    */
/*  kept in the url -                                             */
/*    Details     its name, description, and whether users sign   */
/*                in with it                                      */
/*    Type        Entra ID or Open ID (fixed), as radio buttons   */
/*    Credentials where and as whom : a credential of its type,   */
/*                its app registration (Entra ID : tenant, client */
/*                id, secret, redirect URL ; Open ID : issuer,    */
/*                client id, secret, redirect URL)                */
/*    Groups      the group filter, and its help                  */
/*  Details' Enabled switch makes it the one its type signs in    */
/*  with ; Delete and Save top right.                             */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';
import Profile from '@/lib/Profile';
import getSettings, { SSO_TYPES, SSO_ICONS } from '@/config/settings';
import { useUnsavedGuard } from '@/composables/useUnsavedGuard';
import { useRouteTab } from '@/composables/useRouteTab';
import { recordButtons } from '@/lib/recordButtons';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const settings = computed(() => getSettings(t).oauth2_providers);
const authenticated = ref(false);
const loaded = ref(false);

// ─── the provider ─────────────────────────────────────────────────────────────
const providerId = computed(() => String(route.params.id || ''));
const provider = ref(null); // as saved
const edit = ref(null); // as edited
// what this page edits : the secret has its own dialog (Change secret)
// its client is its credential's (Connections > Credentials) : a client id of its own, from before
// credentials, is kept on the record and shown, not edited
const EDITED = ['name', 'description', 'credential', 'groupfilter'];
// the sso credentials of Connections > Credentials, none first : its own client id and secret
const credentials = ref([{ name: '' }]);
async function loadCredentials() {
  const res = await axios.get('/api/v2/credential/').catch(() => null);
  const all = res?.data?.records || [];
  // the credentials of its type : an Entra ID provider's entraid ones (with the tenant), an Open
  // ID one's oidc
  const type = provider.value?.provider === 'azuread' ? 'entraid' : 'oidc';
  credentials.value = [{ name: '' }, ...all.filter((c) => c.credential_type === type)];
}

const TYPES = { azuread: 'Microsoft Entra ID', oidc: 'Open ID' };

const dirty = computed(
  () => !!provider.value && EDITED.some((k) => (edit.value[k] ?? '') !== (provider.value[k] ?? '')),
);

// leaving with the provider changed and unsaved asks first
useUnsavedGuard(
  dirty,
  () => t('settings.common.unsavedChanges'),
  () => save(),
);

/**
 * Loads the provider.
 */
async function load() {
  try {
    const res = await axios.get(`/api/v2/oauth2/${encodeURIComponent(providerId.value)}`);
    const record = res.data.records ? res.data.records[0] : res.data;
    provider.value = record || null;
    edit.value = record ? Object.fromEntries(EDITED.map((k) => [k, record[k] ?? ''])) : null;
  } catch {
    provider.value = null;
  }
  loaded.value = true;
}

/**
 * Saves fields of the provider.
 *
 * Args:
 *   data (object): the fields.
 *
 * Returns:
 *   Promise<boolean>: whether they were saved.
 */
async function update(data) {
  try {
    await axios.put(`/api/v2/oauth2/${encodeURIComponent(providerId.value)}`, data);
    return true;
  } catch (err) {
    toast.error(err.response?.data?.message || err.response?.data?.error || err.message);
    return false;
  }
}

/**
 * Chooses the credential just made with Add credential.
 *
 * Args:
 *   name (string): the new credential's name.
 */
async function onCredentialCreated(name) {
  await loadCredentials();
  edit.value.credential = name;
}

// ─── its switches ─────────────────────────────────────────────────────────────
// Enabled (its type's login button signs in with it : turning it on turns the others of its type
// off) ; Skip the login page (an enabled provider only)
const switches = computed(() => {
  const p = provider.value;
  if (!p) return [];
  const type = TYPES[p.provider] || p.provider;
  return [
    { key: 'enable', label: t('settings.oauth2.active'), help: t('settings.oauth2.activeHelp', { type }) },
    {
      key: 'auto_login',
      label: t('settings.oauth2.autoLogin'),
      help: t('settings.oauth2.autoLoginHelp'),
      disabled: !p.enable && !p.auto_login,
    },
  ];
});

// ─── tabs ─────────────────────────────────────────────────────────────────────
// the dialog's steps : Details, Type, Credentials, Groups
const tabs = computed(() => [
  { key: 'details', label: t('settings.common.tabDetails'), icon: 'sliders' },
  { key: 'type', label: t('settings.oauth2.stepType'), icon: 'shapes' },
  { key: 'credentials', label: t('settings.common.tabCredentials'), icon: 'key' },
  { key: 'groups', label: t('settings.oauth2.stepGroups'), icon: 'users' },
]);
const { activeTab, tabLink } = useRouteTab('details', (key) => tabs.value.some((x) => x.key === key));

// the help of a tab, as the dialog's step shows it (the permissions of an Entra ID app...)
const notes = computed(() => {
  const step = (settings.value.steps || []).find((s) => s.key === activeTab.value);
  return step && typeof step.notes === 'function' && provider.value ? step.notes(provider.value).filter(Boolean) : [];
});

// the title : SSO › <name>, each step a link : SSO back to the providers, the name to this page
const pageCrumbs = computed(() => [
  { title: t('sidebar.oauth2'), icon: 'right-to-bracket', to: '/settings/sso' },
  {
    title: provider.value?.name || (loaded.value ? providerId.value : null),
    icon: 'right-to-bracket',
    to: `/settings/sso/${providerId.value}`,
  },
]);
// and the open tab last, as every page in tabs names it : Users › admin › Groups
const crumbs = computed(() => {
  const tab = tabs.value.find((x) => x.key === activeTab.value);
  return tab ? [...pageCrumbs.value, { title: tab.label, icon: tab.icon, to: tabLink(tab.key) }] : pageCrumbs.value;
});

// ─── actions ──────────────────────────────────────────────────────────────────
/**
 * Saves the fields of every tab.
 */
async function save() {
  if (!edit.value.name.trim()) {
    toast.warning(t('settings.groups.nameRequired'));
    return;
  }
  const data = Object.fromEntries(
    EDITED.map((k) => [k, typeof edit.value[k] === 'string' ? edit.value[k].trim() : edit.value[k]]),
  );
  if (await update(data)) {
    toast.success(`${data.name} ${t('settings.common.isUpdated')}`);
    await load();
  }
}

/**
 * One of its switches, saved at once : Enabled (its type's login button signs in with it : the
 * others of its type stop being it, oauth2.model) and Skip the login page (the others stop).
 *
 * Args:
 *   key (string): enable or auto_login.
 *   on (boolean): the switch's new state.
 */
async function setSwitch(key, on) {
  await update({ [key]: on ? 1 : 0, provider: provider.value.provider });
  await load();
}

// Delete asks first
const confirmDelete = ref(false);

/**
 * Deletes the provider, then goes back to the providers.
 */
async function deleteProvider() {
  confirmDelete.value = false;
  try {
    await axios.delete(`/api/v2/oauth2/${encodeURIComponent(providerId.value)}`);
    router.push('/settings/sso');
  } catch (err) {
    toast.error(err.response?.data?.message || err.response?.data?.error || err.message);
  }
}

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
  if (!authenticated.value) return;
  await load();
  // its type's credentials : known once the provider is read
  loadCredentials();
});
</script>
<template>
  <BsModal v-if="confirmDelete" size="md" @close="confirmDelete = false" icon="trash">
    <template #title> {{ t('common.delete') }} {{ provider?.name }} </template>
    <template #default>
      <p class="mb-0 fs-6 user-select-none">
        {{ t('settings.common.deleteConfirm') }} <strong>{{ provider?.name }}</strong
        >?
      </p>
    </template>
    <template #footer>
      <BsButton icon="trash" @click="deleteProvider()">{{ t('common.delete') }}</BsButton>
    </template>
  </BsModal>
  <AppSettingsPage>
    <AppSettings
      v-if="authenticated"
      icon="right-to-bracket"
      :title="provider?.name || providerId"
      :crumbs="crumbs"
      :description="t('settings.oauth2.description')"
    >
      <template v-if="provider" #tabs>
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
        <div v-if="loaded && !provider" class="empty-state">
          <FaIcon icon="right-to-bracket" class="empty-state-icon" />
          <span>{{ t('settings.oauth2.providerNotFound', { id: providerId }) }}</span>
        </div>
        <!-- the record loading : its fields as grey placeholders, where they come -->
        <AppSkeleton v-else-if="!loaded && !provider" shape="form" :count="3" />
        <div v-else-if="provider" class="af-provider-tab">
          <!-- the help of the tab, as in the dialog's step -->
          <div v-for="(note, n) in notes" :key="'note-' + n" class="alert alert-info af-provider-note">
            <div v-if="note.title" class="fw-bold">{{ note.title }}</div>
            <div v-if="note.text">{{ note.text }}</div>
            <ul v-if="note.items && note.items.length" class="mb-0">
              <li v-for="(line, l) in note.items" :key="l">{{ line }}</li>
            </ul>
          </div>
          <!-- Details : its name, description, whether users sign in with it -->
          <template v-if="activeTab === 'details'">
            <BsInput
              class="af-provider-field"
              v-model="edit.name"
              icon="heading"
              :isFloating="false"
              :required="true"
              :label="t('settings.fields.name')"
            />
            <BsInput
              class="af-provider-field"
              v-model="edit.description"
              icon="info-circle"
              :isFloating="false"
              :label="t('settings.fields.description')"
            />
            <!-- its switches, as LDAP's, each saved at once : whether its type's login button signs in
                 with it, whether the login page is skipped for it -->
            <div v-for="sw in switches" :key="sw.key" class="mb-3 af-provider-switch">
              <label class="form-label fw-bold d-block" :for="'af-provider-' + sw.key">{{ sw.label }}</label>
              <div class="form-check form-switch mb-0">
                <input
                  :id="'af-provider-' + sw.key"
                  class="form-check-input"
                  type="checkbox"
                  role="switch"
                  :checked="!!provider[sw.key]"
                  :disabled="sw.disabled"
                  @change="setSwitch(sw.key, $event.target.checked)"
                />
              </div>
              <div class="form-text">{{ sw.help }}</div>
            </div>
          </template>
          <!-- Type : Entra ID or Open ID, set when it was made -->
          <template v-else-if="activeTab === 'type'">
            <div v-for="kind in SSO_TYPES" :key="kind" class="form-check af-short-check">
              <input
                :id="'af-ssotype-' + kind"
                :checked="kind === provider.provider"
                class="form-check-input"
                type="radio"
                name="af-sso-type"
                :value="kind"
                disabled
              />
              <label class="form-check-label" :for="'af-ssotype-' + kind">
                <span class="af-short-label"
                  ><FaIcon :icon="SSO_ICONS[kind]" class="me-2" fixedwidth />{{
                    t(`settings.oauth2.type_${kind}`)
                  }}</span
                >
                <span class="text-body-secondary small">{{ t(`settings.oauth2.typeHint_${kind}`) }}</span>
              </label>
            </div>
          </template>
          <!-- Credentials : where and as whom - a credential of its type of Connections >
               Credentials (its user the client id, its password the secret, its tenant or issuer) ;
               one from before credentials says its own -->
          <template v-else-if="activeTab === 'credentials'">
            <BsInput
              class="af-provider-field"
              v-model="edit.credential"
              type="select"
              icon="key"
              :isFloating="false"
              :values="credentials"
              valueKey="name"
              labelKey="name"
              :help="t('settings.oauth2.credentialHelp')"
              :label="t('settings.oauth2.credential')"
            />
            <p v-if="provider.client_id && !edit.credential" class="form-text">
              {{ t('settings.oauth2.ownClient', { client: provider.client_id }) }}
            </p>
          </template>
          <!-- Groups : which of the user's groups the app keeps -->
          <template v-else>
            <BsInput
              class="af-provider-field"
              v-model="edit.groupfilter"
              icon="filter"
              :isFloating="false"
              :label="t('settings.oauth2.groupFilter')"
            />
          </template>
        </div>
      </template>
      <template v-if="provider" #actions>
        <!-- Credentials : a new credential of its type, chosen once made -->
        <AppNewCredentialButton
          v-if="activeTab === 'credentials'"
          :type="provider.provider === 'azuread' ? 'entraid' : 'oidc'"
          @created="onCredentialCreated"
        />
        <BsButton icon="trash" @click="confirmDelete = true">{{ t('common.delete') }}</BsButton>
        <BsButton icon="save" :disabled="!dirty" @click="save()">{{ t('settings.common.save') }}</BsButton>
      </template>
      <!-- the record loading : its buttons as grey placeholders, so the title line keeps its
           height and nothing moves when they come -->
      <template v-else-if="!loaded" #actions>
        <AppSkeleton shape="buttons" :widths="recordButtons('sso', providerId)" />
      </template>
    </AppSettings>
  </AppSettingsPage>
</template>
<style scoped>
/* the wide fields' width of the settings pages, as a user's and a group's */
.af-provider-field :deep(.input-group) {
  max-width: 40rem;
}
/* the tab ends a little above the card's edge : the card zeroes its last element's margin */
.af-provider-tab {
  padding-bottom: 0.5rem;
}
/* the help of a tab : compact, as the dialog's steps show it, the card's width so each line of
   it stays one line */
.af-provider-note {
  padding: 0.5rem 0.75rem;
}
.af-provider-note ul {
  padding-left: 1.25rem;
}
/* the radio buttons : their labels one width, so the grey hints line up, as a credential's */
.af-short-check {
  margin-bottom: 0.6rem;
}
.af-short-label {
  display: inline-block;
  min-width: 12rem;
}
/* the last switch : the tab's end, the card's padding below it */
.af-provider-switch:last-child {
  margin-bottom: 0 !important;
}
</style>
<route lang="yaml">
meta:
  layout: settings
</route>
