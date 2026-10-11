<script setup>
/******************************************************************/
/*                                                                */
/*  Settings > Appearance > Interface, in tabs (the tab kept in    */
/*  the address) :                                                */
/*    Defaults : how the app looks for everyone by default - the  */
/*      theme and its colour, the forms list's view, the time     */
/*      zone (in the database), the language (an environment      */
/*      variable). A user's own choice (the top bar, the profile) */
/*      wins over them.                                           */
/*    Links : the designer's link in the header (an environment   */
/*      variable, applied without a restart).                     */
/*    Environment : the label beside the logo (PRODUCTION).       */
/*    Announcement : a message under the header for everyone.     */
/*    Name : the application's name, in the browser tab and on    */
/*      the sign-in page.                                         */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';
import Profile from '@/lib/Profile';
import Helpers from '@/lib/Helpers';
import Theme from '@/lib/Theme';
import Time from '@/lib/Time';
import { PILL } from '@/lib/tableCells';
import State from '@/lib/State';
import { useEnvVars } from '@/composables/useEnvVars';
import { useUnsavedGuard } from '@/composables/useUnsavedGuard';
import { useRouteTab } from '@/composables/useRouteTab';

const { t } = useI18n();
const authenticated = ref(false);

// ─── tabs ─────────────────────────────────────────────────────────────────────
const tabs = computed(() => [
  { key: 'defaults', label: t('settings.interface.tabDefaults'), icon: 'sliders' },
  { key: 'links', label: t('settings.interface.tabLinks'), icon: 'link' },
  { key: 'environment', label: t('settings.interface.tabEnvironment'), icon: 'tag' },
  { key: 'announcement', label: t('settings.interface.tabAnnouncement'), icon: 'bullhorn' },
  { key: 'name', label: t('settings.interface.tabName'), icon: 'font' },
]);
// the variables of each tab : the language with the defaults, the designer's switch in the header
const defaultsEnv = computed(() => envItems.value.filter((e) => e.name === 'DEFAULT_LANGUAGE'));
const headerEnv = computed(() =>
  envItems.value
    .filter((e) => e.name === 'SHOW_DESIGNER')
    // said as the header shows it : the designer's link, there or not
    .map((e) => ({ ...e, short: t('settings.interface.designer'), hint: t('settings.interface.designerHelp') })),
);
const { activeTab, tabLink } = useRouteTab('defaults', (key) => tabs.value.some((x) => x.key === key));
// the title names the tab : Interface › Default, each step a link
const crumbs = computed(() => {
  const tab = tabs.value.find((x) => x.key === activeTab.value);
  const base = [{ title: t('sidebar.interface'), icon: 'display', to: tabLink('defaults') }];
  return tab ? [...base, { title: tab.label, icon: tab.icon, to: tabLink(tab.key) }] : base;
});

// ─── what the settings row keeps ──────────────────────────────────────────────
// the theme and its colour, the forms view, the label, the announcement, the name
const theme = ref(lookOf({})); // as edited
const savedTheme = ref(null); // as saved
const themeOptions = Theme.themes().map((th) => ({ value: th.value, label: th.title }));
// the colours a Color theme offers
const colorPalette = [
  { label: 'Blue', hex: '#008cba' },
  { label: 'Cyan', hex: '#0369a1' },
  { label: 'Navy', hex: '#1b2a4a' },
  { label: 'Indigo', hex: '#521ea6' },
  { label: 'Purple', hex: '#4a2a8f' },
  { label: 'Pink', hex: '#bb1c5e' },
  { label: 'Red', hex: '#b92d34' },
  { label: 'Orange', hex: '#c2570c' },
  { label: 'Green', hex: '#198754' },
  { label: 'Teal', hex: '#0f766e' },
  { label: 'Slate', hex: '#475569' },
  { label: 'Brown', hex: '#795548' },
];

// the environment label's colours (the app's pill tones) and the announcement's levels, as the
// server keeps them (models/settings.model.js)
const LABEL_COLORS = ['blue', 'green', 'amber', 'orange', 'red', 'grey'];
const bannerLevels = computed(() =>
  ['info', 'warning', 'danger'].map((v) => ({ value: v, label: t(`settings.interface.banner_${v}`) })),
);
// the header as it is (its background, its logo's image) : the label's preview shows it so
const headerLook = ref({ background: '', logo: '' });

/**
 * Reads the header's background and logo, for the label's preview.
 */
function readHeaderLook() {
  const header = document.querySelector('nav.af-header');
  const logo = header?.querySelector('.af-brand img');
  headerLook.value = {
    background: header ? getComputedStyle(header).backgroundColor : '',
    logo: logo ? logo.currentSrc || logo.src : '',
  };
}

// the time zones : UTC, each user's browser's own, or any zone
const timezones = computed(() => [
  { value: 'UTC', label: 'UTC' },
  { value: 'browser', label: t('settings.interface.timezoneBrowser') },
  ...Time.zones()
    .filter((z) => z !== 'UTC')
    .map((z) => ({ value: z, label: z })),
]);
const formsViews = computed(() =>
  ['tiles', 'list'].map((v) => ({ value: v, label: t(`settings.interface.formsView_${v}`) })),
);

/**
 * A date of the server (UTC) as a datetime-local field shows it, in the user's zone.
 *
 * Args:
 *   value (string|null): the date.
 *
 * Returns:
 *   string: YYYY-MM-DDTHH:mm, or empty.
 */
function toLocalInput(value) {
  if (!value) return '';
  const d = new Date(String(value).includes('T') ? value : String(value).replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * What the page edits of a settings row : light, the blue, tiles, none of the rest without them.
 *
 * Args:
 *   row (object): the settings row.
 *
 * Returns:
 *   object: the fields, as the page edits them.
 */
function lookOf(row) {
  return {
    default_theme: row?.default_theme || 'light',
    default_theme_color: Theme.current(row?.default_theme_color || '#008cba'),
    forms_view: row?.forms_view || 'tiles',
    default_timezone: row?.default_timezone || 'UTC',
    env_label: row?.env_label || '',
    // shown unless switched off
    env_label_show: row?.env_label_show !== 0 && row?.env_label_show !== false,
    env_label_color: row?.env_label_color || 'red',
    banner_message: row?.banner_message || '',
    banner_level: row?.banner_level || 'info',
    banner_until: toLocalInput(row?.banner_until),
    app_name: row?.app_name || '',
  };
}
const themeDirty = computed(
  () => !!savedTheme.value && JSON.stringify(theme.value) !== JSON.stringify(savedTheme.value),
);

// ─── the language and the designer : environment variables ────────────────────
const { envItems, envEdits, envDirty, envRestartPending, loadEnvironmentVariables, saveEnvironmentVariables } =
  useEnvVars(['DEFAULT_LANGUAGE', 'SHOW_DESIGNER']);

// leaving with a change unsaved asks first
const dirty = computed(() => themeDirty.value || envDirty.value);
useUnsavedGuard(dirty, () => t('settings.common.unsavedChanges'));

/**
 * Loads what the page edits of the settings row.
 */
async function loadTheme() {
  try {
    const result = await axios.get('/api/v2/settings/');
    theme.value = lookOf(result.data);
    savedTheme.value = lookOf(result.data);
  } catch (err) {
    toast.error(Helpers.parseAxiosResponseError(err));
  }
}

/**
 * Saves what changed : the settings row's fields, then the variables.
 */
async function save() {
  if (themeDirty.value) {
    try {
      // the end of the announcement : the user's local time, sent as a moment (UTC)
      const until = theme.value.banner_until ? new Date(theme.value.banner_until).toISOString() : null;
      await axios.put('/api/v2/settings/', { ...theme.value, banner_until: until });
      toast.success(`${t('sidebar.interface')} ${t('settings.common.isUpdated')}`);
      await loadTheme();
    } catch (err) {
      toast.error(Helpers.parseAxiosResponseError(err));
      return;
    }
  }
  if (envDirty.value) await saveEnvironmentVariables();
  // the header follows at once : the Designer link, the label, the announcement, the name
  await State.loadAppConfig();
}

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
  if (!authenticated.value) return;
  await Promise.all([loadTheme(), loadEnvironmentVariables()]);
  readHeaderLook();
});
</script>
<template>
  <AppSettingsPage>
    <AppSettings
      v-if="authenticated"
      icon="display"
      :title="t('sidebar.interface')"
      :crumbs="crumbs"
      :description="t('settings.interface.description')"
    >
      <template #tabs>
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
      <template #actions>
        <BsButton icon="save" :colorClass="dirty ? 'primary' : 'secondary'" :disabled="!dirty" @click="save()">{{
          t('settings.common.save')
        }}</BsButton>
      </template>
      <template #default>
        <div v-if="envRestartPending.length" class="alert alert-warning py-2">
          <FaIcon icon="triangle-exclamation" class="me-2" />
          {{ t('settings.settingsPage.envRestartPending', { names: envRestartPending.join(', ') }) }}
        </div>
        <!-- Defaults : the theme and the language for everyone -->
        <div v-show="activeTab === 'defaults'">
          <!-- the theme : no environment variable, kept in the database -->
          <BsInput
            class="af-interface-field"
            :isFloating="false"
            type="select"
            icon="palette"
            v-model="theme.default_theme"
            :values="themeOptions"
            valueKey="value"
            labelKey="label"
            :label="t('settings.settingsPage.defaultTheme')"
            :help="t('settings.settingsPage.defaultThemeHelp')"
          />
          <div v-if="theme.default_theme === 'color'" class="mt-2 ms-1">
            <div class="d-flex flex-wrap gap-2">
              <button
                v-for="c in colorPalette"
                :key="c.hex"
                type="button"
                class="settings-color-swatch"
                :style="{ backgroundColor: c.hex }"
                :class="{ 'settings-color-swatch-active': theme.default_theme_color === c.hex }"
                :title="c.label"
                @click="theme.default_theme_color = c.hex"
              >
                <FaIcon v-if="theme.default_theme_color === c.hex" icon="check" class="settings-swatch-check" />
              </button>
            </div>
          </div>
          <!-- the language : an environment variable -->
          <template v-for="e in defaultsEnv" :key="e.name">
            <div class="mt-4"></div>
            <AppEnvField v-model="envEdits[e.name]" :e="e" />
          </template>
          <!-- the forms list's view and the time zone : in the database -->
          <BsInput
            class="af-interface-field mt-4"
            :isFloating="false"
            type="select"
            icon="table-cells-large"
            v-model="theme.forms_view"
            :values="formsViews"
            valueKey="value"
            labelKey="label"
            :label="t('settings.interface.formsView')"
            :help="t('settings.interface.formsViewHelp')"
          />
          <BsInput
            class="af-interface-field mt-4"
            :isFloating="false"
            type="select"
            icon="clock"
            v-model="theme.default_timezone"
            :values="timezones"
            valueKey="value"
            labelKey="label"
            :label="t('settings.interface.timezone')"
            :help="t('settings.interface.timezoneHelp')"
          />
        </div>
        <!-- Links : the designer's link in the header -->
        <div v-show="activeTab === 'links'">
          <AppEnvField v-for="e in headerEnv" :key="e.name" v-model="envEdits[e.name]" :e="e" :asSwitch="true" />
        </div>
        <!-- Environment : the label beside the logo, its colour and how it looks -->
        <div v-show="activeTab === 'environment'">
          <!-- the label beside the logo, and its colour (a pill, shown as the header shows it) -->
          <label class="form-label fw-bold af-switch-title" for="af-env-label-show">{{
            t('settings.interface.envLabelShow')
          }}</label>
          <div class="form-check form-switch mb-0">
            <input
              id="af-env-label-show"
              v-model="theme.env_label_show"
              class="form-check-input"
              type="checkbox"
              role="switch"
            />
          </div>
          <div class="form-text">{{ t('settings.interface.envLabelShowHelp') }}</div>
          <BsInput
            class="af-interface-field mt-4"
            :isFloating="false"
            icon="tag"
            v-model="theme.env_label"
            :label="t('settings.interface.envLabel')"
            :help="t('settings.interface.envLabelHelp')"
          />
          <!-- its colour : round swatches, as the Color theme's -->
          <label class="form-label fw-bold mt-4 d-block">{{ t('settings.interface.envLabelColor') }}</label>
          <div
            class="d-flex flex-wrap gap-2 ms-1"
            role="radiogroup"
            :aria-label="t('settings.interface.envLabelColor')"
          >
            <button
              v-for="c in LABEL_COLORS"
              :key="c"
              type="button"
              class="settings-color-swatch af-label-swatch"
              :class="[PILL[c], { 'af-label-swatch-active': theme.env_label_color === c }]"
              :title="c"
              role="radio"
              :aria-checked="theme.env_label_color === c"
              @click="theme.env_label_color = c"
            >
              <FaIcon v-if="theme.env_label_color === c" icon="check" class="settings-swatch-check" />
            </button>
          </div>
          <!-- the preview : the header's logo and the label, as the header shows them -->
          <label class="form-label fw-bold mt-4 d-block">{{ t('settings.interface.envLabelPreview') }}</label>
          <div class="af-label-preview" :style="{ backgroundColor: headerLook.background }">
            <img v-if="headerLook.logo" :src="headerLook.logo" class="af-label-preview-logo" alt="" />
            <span
              class="badge rounded-pill fw-semibold af-pill af-label-preview-pill"
              :class="PILL[theme.env_label_color] || PILL.grey"
              :style="{ opacity: theme.env_label_show ? 1 : 0.35 }"
            >
              <span class="af-pill-label">{{ theme.env_label || 'PRODUCTION' }}</span>
            </span>
          </div>
        </div>
        <!-- Announcement : the message under the header, its level, its end -->
        <div v-show="activeTab === 'announcement'">
          <BsInput
            class="af-interface-wide"
            :isFloating="false"
            icon="bullhorn"
            v-model="theme.banner_message"
            :label="t('settings.interface.banner')"
            :help="t('settings.interface.bannerHelp')"
          />
          <BsInput
            class="af-interface-field mt-4"
            :isFloating="false"
            type="select"
            icon="circle-info"
            v-model="theme.banner_level"
            :values="bannerLevels"
            valueKey="value"
            labelKey="label"
            :label="t('settings.interface.bannerLevel')"
          />
          <BsInput
            class="af-interface-field mt-4"
            :isFloating="false"
            type="datetime-local"
            icon="calendar"
            v-model="theme.banner_until"
            :label="t('settings.interface.bannerUntil')"
            :help="t('settings.interface.bannerUntilHelp')"
          />
        </div>
        <!-- Name : the browser tab's and the sign-in page's -->
        <div v-show="activeTab === 'name'">
          <BsInput
            class="af-interface-field"
            :isFloating="false"
            icon="font"
            v-model="theme.app_name"
            placeholder="Ansible Forms"
            :label="t('settings.interface.appName')"
            :help="t('settings.interface.appNameHelp')"
          />
        </div>
      </template>
    </AppSettings>
  </AppSettingsPage>
</template>
<style scoped>
/* as wide as the language below it (AppEnvField : a dropdown's width on the settings pages) */
.af-interface-field :deep(.input-group) {
  max-width: 20rem;
}
/* the announcement's message : wider, a sentence or two on one line */
.af-interface-wide :deep(.input-group) {
  max-width: 40rem;
}
/* a colour of the environment label : a round swatch in the pill's colour ; the pill's colours
   take the border away (!important), so the chosen one is ringed with a shadow */
.af-label-swatch-active {
  box-shadow:
    0 0 0 2px var(--bs-body-bg),
    0 0 0 4px var(--bs-body-color);
}
/* the label's preview : the header's background, its logo, the label 20px from it, as there */
.af-label-preview {
  display: inline-flex;
  align-items: center;
  padding: 0.75rem 1.25rem;
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius);
}
.af-label-preview-logo {
  max-width: 200px;
  max-height: 33px;
}
.af-label-preview-pill {
  margin-left: 20px;
}
/* a colour of the Color theme : a round swatch, the chosen one ringed and ticked */
.settings-color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition:
    transform 0.15s,
    border-color 0.15s;
}
.settings-color-swatch:hover {
  transform: scale(1.15);
  border-color: rgba(255, 255, 255, 0.5);
}
.settings-color-swatch-active {
  border-color: var(--bs-body-color);
  box-shadow: 0 0 0 2px var(--bs-body-bg);
}
.settings-swatch-check {
  color: #fff;
  font-size: 0.65rem;
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.5));
}
</style>
<route lang="yaml">
meta:
  layout: settings
</route>
