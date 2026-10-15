<script setup>
/******************************************************************/
/*                                                                */
/*  A disclaimer's page (/settings/disclaimer/<version>), opened  */
/*  from the disclaimers' list : its tabs, the tab kept in the    */
/*  url -                                                         */
/*    Details      its title, text and checkbox label, and        */
/*                 whether it is enabled (the one users accept :  */
/*                 on, the others are off ; saved at once)        */
/*    Acceptances  who accepted it, when, from where ; Ask again  */
/*                 on a row or the rows ticked                    */
/*  Preview, Delete and Save top right ; a changed text asks : a  */
/*  correction (who accepted it still counts) or everyone again.  */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';
import Profile from '@/lib/Profile';
import Helpers from '@/lib/Helpers';
import { SIGN_IN_TYPES } from '@/config/settings';
import { useUnsavedGuard } from '@/composables/useUnsavedGuard';
import { useRouteTab } from '@/composables/useRouteTab';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authenticated = ref(false);
const loaded = ref(false);

// ─── the disclaimer ───────────────────────────────────────────────────────────
const versionId = computed(() => String(route.params.id || ''));
const record = ref(null); // as saved
const edit = ref(null); // as edited
const WORDS = ['title', 'text', 'checkbox_label'];
const dirty = computed(() => !!record.value && WORDS.some((k) => (edit.value[k] ?? '') !== (record.value[k] ?? '')));
useUnsavedGuard(
  dirty,
  () => t('settings.common.unsavedChanges'),
  () => save(),
);

/**
 * Reads the disclaimer and who accepted it.
 */
async function load() {
  try {
    const res = await axios.get(`/api/v2/disclaimerversion/${encodeURIComponent(versionId.value)}`);
    record.value = res.data?.version ? res.data : null;
    edit.value = record.value ? Object.fromEntries(WORDS.map((k) => [k, record.value[k] ?? ''])) : null;
  } catch {
    record.value = null;
  }
  await loadAcceptances();
  loaded.value = true;
}

// ─── its switch : enabled, the one users accept ───────────────────────────────
/**
 * Enables it (the others off, who accepted it not asked again) or disables it (no disclaimer),
 * saved at once.
 *
 * Args:
 *   on (boolean): the switch's new state.
 */
async function setEnabled(on) {
  try {
    await axios.post(`/api/v2/disclaimerversion/${encodeURIComponent(versionId.value)}/enable`, { enabled: on });
  } catch (err) {
    toast.error(Helpers.parseAxiosResponseError(err));
  }
  await load();
}

// ─── Save : a correction, or everyone again ───────────────────────────────────
const askAgainOpen = ref(false);
/**
 * Saves its words ; changed after people accepted it, asks first whether they accept again.
 *
 * Args:
 *   askAgain (boolean|null): the answer, null when not asked yet.
 *
 * Returns:
 *   Promise<boolean>: whether it was saved.
 */
async function save(askAgain = null) {
  if (!dirty.value) return true;
  if (!WORDS.every((k) => String(edit.value[k] || '').trim())) {
    toast.warning(t('settings.disclaimer.missing'));
    return false;
  }
  if (askAgain === null && record.value.acceptances > 0) {
    askAgainOpen.value = true;
    return false;
  }
  askAgainOpen.value = false;
  try {
    await axios.put(`/api/v2/disclaimerversion/${encodeURIComponent(versionId.value)}`, {
      ...edit.value,
      askAgain: !!askAgain,
    });
    toast.success(`${edit.value.title} ${t('settings.common.isUpdated')}`);
    await load();
    return true;
  } catch (err) {
    toast.error(Helpers.parseAxiosResponseError(err));
    return false;
  }
}

// Delete asks first
const confirmDelete = ref(false);
/**
 * Deletes it and who accepted it, then goes back to the disclaimers.
 */
async function deleteVersion() {
  confirmDelete.value = false;
  try {
    await axios.delete(`/api/v2/disclaimerversion/${encodeURIComponent(versionId.value)}`);
    router.push('/settings/disclaimer');
  } catch (err) {
    toast.error(Helpers.parseAxiosResponseError(err));
  }
}

// Preview : the dialog as users will see it, with its words as they are now
const previewOpen = ref(false);

// ─── Acceptances : who accepted it ────────────────────────────────────────────
const acceptances = ref([]);
/**
 * Reads who accepted it.
 */
async function loadAcceptances() {
  const res = await axios
    .get('/api/v2/disclaimeracceptance/', { params: { version: versionId.value } })
    .catch(() => null);
  acceptances.value = res?.data?.records || [];
}
const acceptanceColumns = computed(() => [
  { key: 'username', label: t('settings.disclaimer.user') },
  { key: 'user_type', label: t('settings.disclaimer.signIn'), value: (r) => SIGN_IN_TYPES[r.user_type] || r.user_type },
  {
    key: 'accepted_at',
    label: t('settings.disclaimer.acceptedAt'),
    keep: true,
    value: (r) => (r.accepted_at ? Helpers.formatServerDate(r.accepted_at) : ''),
  },
  { key: 'ip', label: t('settings.disclaimer.ip') },
  { key: 'user_agent', label: t('settings.disclaimer.browser') },
]);
/**
 * Asks users to accept it again : their acceptances cleared, after asking.
 *
 * Args:
 *   rows (object[]): the acceptances.
 */
async function askAgain(rows) {
  if (!rows.length || !confirm(t('settings.disclaimer.askAgainConfirm', { count: rows.length }))) return;
  try {
    const res = await axios.post('/api/v2/disclaimeracceptance/ask-again', { ids: rows.map((r) => r.id) });
    toast.success(t('settings.disclaimer.askAgainDone', { count: res.data?.count ?? rows.length }));
  } catch (err) {
    toast.error(Helpers.parseAxiosResponseError(err));
  }
  await load();
}

// ─── tabs and title ───────────────────────────────────────────────────────────
const tabs = computed(() => [
  { key: 'details', label: t('settings.common.tabDetails'), icon: 'sliders' },
  {
    key: 'acceptances',
    label: t('settings.disclaimer.tabAcceptances'),
    icon: 'user-check',
    count: acceptances.value.length,
  },
]);
const { activeTab, tabLink } = useRouteTab('details', (key) => tabs.value.some((x) => x.key === key));
const pageCrumbs = computed(() => [
  { title: t('sidebar.disclaimer'), icon: 'file-signature', to: '/settings/disclaimer' },
  {
    title: record.value
      ? `${record.value.title} (${t('settings.disclaimer.version')} ${record.value.version})`
      : loaded.value
        ? versionId.value
        : null,
    icon: 'file-signature',
    to: `/settings/disclaimer/${versionId.value}`,
  },
]);
const crumbs = computed(() => {
  const tab = tabs.value.find((x) => x.key === activeTab.value);
  return tab ? [...pageCrumbs.value, { title: tab.label, icon: tab.icon, to: tabLink(tab.key) }] : pageCrumbs.value;
});

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
  if (!authenticated.value) return;
  await load();
});
</script>
<template>
  <BsModal v-if="confirmDelete" size="md" @close="confirmDelete = false" icon="trash">
    <template #title> {{ t('common.delete') }} {{ record?.title }} </template>
    <template #default>
      <p class="mb-0 fs-6 user-select-none">
        {{ t('settings.common.deleteConfirm') }} <strong>{{ record?.title }}</strong
        >?
      </p>
    </template>
    <template #footer>
      <BsButton icon="trash" @click="deleteVersion()">{{ t('common.delete') }}</BsButton>
    </template>
  </BsModal>
  <!-- a changed text people accepted : a correction, or everyone again -->
  <BsModal v-if="askAgainOpen" icon="file-signature" size="md" :footerClose="false" @close="askAgainOpen = false">
    <template #title>{{ t('settings.disclaimer.askAgainTitle') }}</template>
    <template #default>
      <p class="mb-0">{{ t('settings.disclaimer.askAgainTextVersion', { count: record?.acceptances || 0 }) }}</p>
    </template>
    <template #footer>
      <BsButton icon="pencil" @click="save(false)">{{ t('settings.disclaimer.askAgainNo') }}</BsButton>
      <BsButton icon="rotate" colorClass="primary" @click="save(true)">{{
        t('settings.disclaimer.askAgainYes')
      }}</BsButton>
    </template>
  </BsModal>
  <AppDisclaimer v-if="previewOpen && edit" :preview="{ ...edit }" @close="previewOpen = false" />
  <AppSettingsPage>
    <AppSettings
      v-if="authenticated"
      icon="file-signature"
      :title="record?.title || versionId"
      :crumbs="crumbs"
      :description="t('settings.disclaimer.description')"
    >
      <template v-if="record" #tabs>
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
              <span v-if="tab.count !== undefined" class="badge af-tab-count ms-1">{{ tab.count }}</span>
            </a>
          </li>
        </ul>
      </template>
      <template v-else-if="!loaded" #tabs>
        <AppSkeleton shape="tabs" :count="2" />
      </template>
      <template #default>
        <div v-if="loaded && !record" class="empty-state">
          <FaIcon icon="file-signature" class="empty-state-icon" />
          <span>{{ t('settings.disclaimer.notFound', { id: versionId }) }}</span>
        </div>
        <AppSkeleton v-else-if="!loaded" shape="form" :count="3" />
        <!-- Acceptances : who accepted it ; Ask again on a row or the rows ticked -->
        <AppLinkedTable
          v-else-if="activeTab === 'acceptances'"
          selectable
          :rowActions="[{ title: t('settings.disclaimer.askAgain'), icon: 'rotate', run: (r) => askAgain([r]) }]"
          :columns="acceptanceColumns"
          :rows="acceptances"
          :exportName="`disclaimer-${record.version}-acceptances`"
        >
          <template #bulk-actions="{ selected, count }">
            <BsButton v-if="count" icon="rotate" @click="askAgain(selected)"
              >{{ t('settings.disclaimer.askAgain') }} ({{ count }})</BsButton
            >
          </template>
        </AppLinkedTable>
        <!-- Details : its words, then whether it is enabled -->
        <div v-else class="af-disclaimer-tab">
          <BsInput
            class="af-disclaimer-field"
            v-model="edit.title"
            icon="heading"
            :isFloating="false"
            :required="true"
            :help="t('settings.disclaimer.titleHelp')"
            :label="t('settings.disclaimer.title')"
          />
          <BsInput
            class="af-disclaimer-field"
            v-model="edit.text"
            type="textarea"
            :rows="10"
            icon="file-lines"
            :isFloating="false"
            :required="true"
            :help="t('settings.disclaimer.textHelp')"
            :label="t('settings.disclaimer.text')"
          />
          <BsInput
            class="af-disclaimer-field"
            v-model="edit.checkbox_label"
            icon="square-check"
            :isFloating="false"
            :required="true"
            :help="t('settings.disclaimer.checkboxHelp')"
            :label="t('settings.disclaimer.checkbox')"
          />
          <!-- whether users accept it : a switch, as an SSO provider's, saved at once -->
          <div class="mb-0">
            <label class="form-label fw-bold d-block" for="af-disclaimer-enabled">{{
              t('settings.disclaimer.versionEnabled')
            }}</label>
            <div class="form-check form-switch mb-0">
              <input
                id="af-disclaimer-enabled"
                class="form-check-input"
                type="checkbox"
                role="switch"
                :checked="!!record.enabled"
                @change="setEnabled($event.target.checked)"
              />
            </div>
            <div class="form-text">{{ t('settings.disclaimer.enabledHelpVersion') }}</div>
          </div>
        </div>
      </template>
      <template v-if="record" #actions>
        <BsButton icon="eye" @click="previewOpen = true">{{ t('settings.disclaimer.preview') }}</BsButton>
        <BsButton icon="trash" @click="confirmDelete = true">{{ t('common.delete') }}</BsButton>
        <BsButton icon="save" :disabled="!dirty" @click="save()">{{ t('settings.common.save') }}</BsButton>
      </template>
    </AppSettings>
  </AppSettingsPage>
</template>
<style scoped>
/* the title, the text and the checkbox label : one width, as the other pages' wide fields */
.af-disclaimer-field :deep(.input-group) {
  max-width: 40rem;
}
/* the tab ends a little above the card's edge */
.af-disclaimer-tab {
  padding-bottom: 0.5rem;
}
/* the count of a tab : small and grey, as the menus' badges */
.af-tab-count {
  background: var(--bs-secondary-bg);
  color: var(--bs-secondary-color);
  font-weight: 600;
}
</style>
<route lang="yaml">
meta:
  layout: settings
</route>
