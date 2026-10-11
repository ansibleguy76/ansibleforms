<script setup>
/******************************************************************/
/*                                                                */
/*  Settings > Appearance > Interface, in tabs (the tab kept in    */
/*  the address) :                                                */
/*    Defaults : how the app looks for everyone by default - the   */
/*      theme and its colour (in the database), the language and  */
/*      whether the designer shows (environment variables,        */
/*      applied without a restart). A user's own choice (the top  */
/*      bar, the profile) wins over them.                         */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';
import Profile from '@/lib/Profile';
import Helpers from '@/lib/Helpers';
import Theme from '@/lib/Theme';
import State from '@/lib/State';
import { useEnvVars } from '@/composables/useEnvVars';
import { useUnsavedGuard } from '@/composables/useUnsavedGuard';
import { useRouteTab } from '@/composables/useRouteTab';

const { t } = useI18n();
const authenticated = ref(false);

// ─── tabs ─────────────────────────────────────────────────────────────────────
const tabs = computed(() => [{ key: 'defaults', label: t('settings.interface.tabDefaults'), icon: 'sliders' }]);
const { activeTab, tabLink } = useRouteTab('defaults', (key) => tabs.value.some((x) => x.key === key));
// the title names the tab : Interface › Default, each step a link
const crumbs = computed(() => {
  const tab = tabs.value.find((x) => x.key === activeTab.value);
  const base = [{ title: t('sidebar.interface'), icon: 'palette', to: tabLink('defaults') }];
  return tab ? [...base, { title: tab.label, icon: tab.icon, to: tabLink(tab.key) }] : base;
});

// ─── the theme and its colour : the settings row ──────────────────────────────
const theme = ref({ default_theme: 'light', default_theme_color: '#008cba' }); // as edited
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

/**
 * The theme and colour of a settings row, as the page edits them : light and the blue without
 * one.
 *
 * Args:
 *   row (object): the settings row.
 *
 * Returns:
 *   object: { default_theme, default_theme_color }.
 */
function themeOf(row) {
  return {
    default_theme: row?.default_theme || 'light',
    default_theme_color: Theme.current(row?.default_theme_color || '#008cba'),
  };
}
const themeDirty = computed(
  () =>
    !!savedTheme.value &&
    (theme.value.default_theme !== savedTheme.value.default_theme ||
      theme.value.default_theme_color !== savedTheme.value.default_theme_color),
);

// ─── the language and the designer : environment variables ────────────────────
const { envItems, envEdits, envDirty, envRestartPending, loadEnvironmentVariables, saveEnvironmentVariables } =
  useEnvVars(['DEFAULT_LANGUAGE', 'SHOW_DESIGNER']);

// leaving with a change unsaved asks first
const dirty = computed(() => themeDirty.value || envDirty.value);
useUnsavedGuard(dirty, () => t('settings.common.unsavedChanges'));

/**
 * Loads the theme and its colour.
 */
async function loadTheme() {
  try {
    const result = await axios.get('/api/v2/settings/');
    theme.value = themeOf(result.data);
    savedTheme.value = themeOf(result.data);
  } catch (err) {
    toast.error(Helpers.parseAxiosResponseError(err));
  }
}

/**
 * Saves what changed : the theme and its colour, then the variables.
 */
async function save() {
  if (themeDirty.value) {
    try {
      await axios.put('/api/v2/settings/', { ...theme.value });
      toast.success(`${t('sidebar.interface')} ${t('settings.common.isUpdated')}`);
      await loadTheme();
    } catch (err) {
      toast.error(Helpers.parseAxiosResponseError(err));
      return;
    }
  }
  if (envDirty.value) {
    await saveEnvironmentVariables();
    // the designer switched on or off : the header's Designer link follows at once
    await State.loadAppConfig();
  }
}

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
  if (!authenticated.value) return;
  await Promise.all([loadTheme(), loadEnvironmentVariables()]);
});
</script>
<template>
  <AppSettingsPage>
    <AppSettings
      v-if="authenticated"
      icon="palette"
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
        <!-- Defaults : the theme, the language and the designer for everyone -->
        <div v-show="activeTab === 'defaults'">
          <div v-if="envRestartPending.length" class="alert alert-warning py-2">
            <FaIcon icon="triangle-exclamation" class="me-2" />
            {{ t('settings.settingsPage.envRestartPending', { names: envRestartPending.join(', ') }) }}
          </div>
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
          <!-- the language and the designer : environment variables -->
          <template v-for="e in envItems" :key="e.name">
            <div class="mt-4"></div>
            <AppEnvField v-model="envEdits[e.name]" :e="e" :asSwitch="e.name === 'SHOW_DESIGNER'" />
          </template>
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
