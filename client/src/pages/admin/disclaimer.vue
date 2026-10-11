<script setup>
/******************************************************************/
/*                                                                */
/*  Settings > Access > Disclaimer, in two tabs, the tab kept in  */
/*  the url :                                                     */
/*  General     - the disclaimer on or off, its title, its text   */
/*                and the label of the checkbox users tick. A     */
/*                changed text asks : everyone again (a new       */
/*                version) or a correction (the same version)     */
/*  Acceptances - who accepted which version, when, from where    */
/*                (models/disclaimer.model.js)                    */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import Profile from '@/lib/Profile';
import Helpers from '@/lib/Helpers';
import getSettings from '@/config/settings';
import { useRouteTab } from '@/composables/useRouteTab';
import { useUnsavedGuard } from '@/composables/useUnsavedGuard';

const { t } = useI18n();
const settings = computed(() => getSettings(t));
const authenticated = ref(false);
const title = computed(() => t('sidebar.disclaimer'));

// ─── tabs ─────────────────────────────────────────────────────────────────────
const pageTabs = computed(() => [
  { key: 'general', label: t('settings.common.tabGeneral'), icon: 'sliders' },
  { key: 'acceptances', label: t('settings.disclaimer.tabAcceptances'), icon: 'file-signature' },
]);
const { activeTab, tabLink } = useRouteTab('general', (key) => ['general', 'acceptances'].includes(key));
// the title says the tab : Disclaimer › General, Disclaimer › Acceptances, each step a link
const crumbs = computed(() => {
  const tab = pageTabs.value.find((x) => x.key === activeTab.value);
  return [
    { title: title.value, icon: 'file-signature', to: '/settings/disclaimer' },
    { title: tab.label, icon: tab.icon, to: tabLink(tab.key) },
  ];
});

// ─── General : the disclaimer ─────────────────────────────────────────────────
const FIELDS = ['enabled', 'title', 'text', 'checkbox_label'];
const edit = ref({ enabled: false, title: '', text: '', checkbox_label: '' });
const saved = ref(null);
const version = ref(0);
const dirty = computed(() => !!saved.value && FIELDS.some((k) => edit.value[k] !== saved.value[k]));
// its words changed (not only the switch) : asked whether everyone accepts again
const wordsChanged = computed(
  () => !!saved.value && ['title', 'text', 'checkbox_label'].some((k) => edit.value[k] !== saved.value[k]),
);
const askAgainOpen = ref(false);
const previewOpen = ref(false);
// switched on, it needs all three
const missing = computed(
  () => edit.value.enabled && !(edit.value.title.trim() && edit.value.text.trim() && edit.value.checkbox_label.trim()),
);

/**
 * The disclaimer as the server has it, into the page.
 *
 * Args:
 *   data (object): enabled, version, title, text, checkbox_label.
 */
function apply(data) {
  const fields = {
    enabled: !!data.enabled,
    title: data.title || '',
    text: data.text || '',
    // a first disclaimer : the usual words, to change at will
    checkbox_label: data.checkbox_label || (data.version ? '' : t('settings.disclaimer.checkboxDefault')),
  };
  edit.value = { ...fields };
  saved.value = { ...fields, checkbox_label: data.checkbox_label || '' };
  version.value = data.version || 0;
}

/**
 * Reads the disclaimer.
 */
async function load() {
  try {
    const res = await axios.get('/api/v2/disclaimersettings/');
    apply(res.data);
  } catch (err) {
    toast.error(Helpers.parseAxiosResponseError(err));
  }
}

/**
 * Saves : a changed text of an existing version first asks whether everyone accepts again.
 *
 * Args:
 *   askAgain (boolean|null): the answer, null when not asked yet.
 *
 * Returns:
 *   boolean: false when it was not saved (refused, or the question is open).
 */
async function save(askAgain = null) {
  if (!dirty.value) return true;
  if (missing.value) {
    toast.warning(t('settings.disclaimer.missing'));
    return false;
  }
  if (askAgain === null && version.value && wordsChanged.value) {
    askAgainOpen.value = true;
    return false;
  }
  askAgainOpen.value = false;
  try {
    const res = await axios.put('/api/v2/disclaimersettings/', { ...edit.value, askAgain: !!askAgain });
    apply(res.data);
    toast.success(`${title.value} ${t('settings.common.isUpdated')}`);
    return true;
  } catch (err) {
    toast.error(Helpers.parseAxiosResponseError(err));
    return false;
  }
}
useUnsavedGuard(
  dirty,
  () => t('settings.common.unsavedChanges'),
  () => save(),
);

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
  if (authenticated.value) await load();
});
</script>
<template>
  <AppSettingsPage>
    <!-- ACCEPTANCES : who accepted which version ; the page's tabs above it -->
    <AppAdminMulti
      v-if="authenticated && activeTab === 'acceptances'"
      :apiVersion="2"
      :settings="settings.disclaimerAcceptances"
      :crumbs="crumbs"
      readOnly
    >
      <template #tabs>
        <ul class="nav nav-tabs mb-0">
          <li v-for="tab in pageTabs" :key="tab.key" class="nav-item">
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
    </AppAdminMulti>
    <!-- GENERAL : the disclaimer -->
    <AppSettings
      v-else-if="authenticated"
      icon="file-signature"
      :title="title"
      :crumbs="crumbs"
      :description="t('settings.disclaimer.description')"
    >
      <template #tabs>
        <ul class="nav nav-tabs mb-0">
          <li v-for="tab in pageTabs" :key="tab.key" class="nav-item">
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
      <template #actions>
        <!-- the dialog as users will see it, with the text as it is now -->
        <BsButton icon="eye" :disabled="!edit.text.trim()" @click="previewOpen = true">{{
          t('settings.disclaimer.preview')
        }}</BsButton>
        <BsButton icon="save" :colorClass="dirty ? 'primary' : 'secondary'" :disabled="!dirty" @click="save()">{{
          t('settings.common.save')
        }}</BsButton>
      </template>
      <template #default>
        <!-- on or off ; off, its text is kept, greyed out -->
        <label class="form-label fw-bold af-switch-title" for="af-disclaimer-on">{{
          t('settings.disclaimer.enabled')
        }}</label>
        <div class="form-check form-switch mb-0">
          <input id="af-disclaimer-on" v-model="edit.enabled" class="form-check-input" type="checkbox" role="switch" />
        </div>
        <div class="form-text">
          {{ t('settings.disclaimer.enabledHelp') }}
          <template v-if="version"> {{ t('settings.disclaimer.currentVersion', { version }) }}</template>
        </div>
        <BsInput
          class="af-disclaimer-field mt-4"
          :isFloating="false"
          icon="heading"
          :disabled="!edit.enabled"
          v-model="edit.title"
          :label="t('settings.disclaimer.title')"
          :help="t('settings.disclaimer.titleHelp')"
        />
        <BsInput
          class="af-disclaimer-field mt-4"
          :isFloating="false"
          type="textarea"
          :rows="10"
          icon="file-lines"
          :disabled="!edit.enabled"
          v-model="edit.text"
          :label="t('settings.disclaimer.text')"
          :help="t('settings.disclaimer.textHelp')"
        />
        <BsInput
          class="af-disclaimer-field mt-4"
          :isFloating="false"
          icon="square-check"
          :disabled="!edit.enabled"
          v-model="edit.checkbox_label"
          :label="t('settings.disclaimer.checkbox')"
          :help="t('settings.disclaimer.checkboxHelp')"
        />
      </template>
    </AppSettings>
    <AppDisclaimer
      v-if="previewOpen"
      :preview="{ title: edit.title, text: edit.text, checkbox_label: edit.checkbox_label }"
      @close="previewOpen = false"
    />
    <!-- a changed text : everyone again (a new version), or a correction (the same one) -->
    <BsModal v-if="askAgainOpen" icon="file-signature" size="md" :footerClose="false" @close="askAgainOpen = false">
      <template #title>{{ t('settings.disclaimer.askAgainTitle') }}</template>
      <template #default>
        <p class="mb-0">{{ t('settings.disclaimer.askAgainText', { version }) }}</p>
      </template>
      <template #footer>
        <BsButton icon="pencil" @click="save(false)">{{ t('settings.disclaimer.askAgainNo') }}</BsButton>
        <BsButton icon="rotate" colorClass="primary" @click="save(true)">{{
          t('settings.disclaimer.askAgainYes')
        }}</BsButton>
      </template>
    </BsModal>
  </AppSettingsPage>
</template>
<style scoped>
/* the card ends at its own padding : no margin of the last field under it */
:deep(.card-body > .mb-3:last-child),
:deep(.card-body > :last-child > .mb-3:last-child) {
  margin-bottom: 0 !important;
}
/* the title, the text and the checkbox label : one width */
.af-disclaimer-field :deep(.input-group) {
  max-width: 40rem;
}
</style>
<route lang="yaml">
meta:
  layout: settings
</route>
