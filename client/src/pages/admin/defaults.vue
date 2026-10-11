<script setup>
/******************************************************************/
/*                                                                */
/*  Settings > Appearance > Defaults : how the app looks for      */
/*  everyone by default - the theme and its colour, the forms     */
/*  list's view, the time zone (in the database), the language    */
/*  (an environment variable). A user's own choice (the top bar,  */
/*  the profile) wins over them.                                  */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';
import Profile from '@/lib/Profile';
import Helpers from '@/lib/Helpers';
import Theme from '@/lib/Theme';
import Time, { DATE_FORMATS } from '@/lib/Time';
import dayjs from 'dayjs';
import State from '@/lib/State';
import { useEnvVars } from '@/composables/useEnvVars';
import { useUnsavedGuard } from '@/composables/useUnsavedGuard';

const { t } = useI18n();
const authenticated = ref(false);

// ─── what the settings row keeps ──────────────────────────────────────────────
// the theme and its colour, the forms view, the time zone
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

// the time zones : UTC, each user's browser's own, or any zone
const timezones = computed(() => [
  { value: 'UTC', label: 'UTC' },
  { value: 'browser', label: t('settings.interface.timezoneBrowser') },
  ...Time.zones()
    .filter((z) => z !== 'UTC')
    .map((z) => ({ value: z, label: z })),
]);
// the date formats, each shown as today's date reads in it
const dateFormats = computed(() => DATE_FORMATS.map((f) => ({ value: f, label: `${dayjs().format(f)}  (${f})` })));
const formsViews = computed(() =>
  ['tiles', 'list'].map((v) => ({ value: v, label: t(`settings.interface.formsView_${v}`) })),
);

/**
 * What the page edits of a settings row : light, the blue, tiles and UTC without them.
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
    default_date_format: row?.default_date_format || 'YYYY-MM-DD',
  };
}
const themeDirty = computed(
  () => !!savedTheme.value && JSON.stringify(theme.value) !== JSON.stringify(savedTheme.value),
);

// ─── the language : an environment variable ───────────────────────────────────
const { envItems, envEdits, envDirty, envRestartPending, loadEnvironmentVariables, saveEnvironmentVariables } =
  useEnvVars(['DEFAULT_LANGUAGE']);
// the language's help : said as the page's other defaults, translated
const languageEnv = computed(() => envItems.value.map((e) => ({ ...e, hint: t('settings.interface.languageHelp') })));

// leaving with a change unsaved asks first
const dirty = computed(() => themeDirty.value || envDirty.value);
useUnsavedGuard(
  dirty,
  () => t('settings.common.unsavedChanges'),
  () => save(),
);

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
      await axios.put('/api/v2/settings/', { ...theme.value });
      toast.success(`${t('sidebar.defaults')} ${t('settings.common.isUpdated')}`);
      await loadTheme();
    } catch (err) {
      toast.error(Helpers.parseAxiosResponseError(err));
      return;
    }
  }
  if (envDirty.value) await saveEnvironmentVariables();
  // the app follows at once : the forms view, the time zone, the date format
  await State.loadAppConfig();
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
      icon="display"
      :title="t('sidebar.defaults')"
      :description="t('settings.interface.description')"
    >
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
        <!-- the theme, the language, the forms view and the time zone for everyone -->
        <div>
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
          <template v-for="e in languageEnv" :key="e.name">
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
          <BsInput
            class="af-interface-field mt-4"
            :isFloating="false"
            type="select"
            icon="calendar"
            v-model="theme.default_date_format"
            :values="dateFormats"
            valueKey="value"
            labelKey="label"
            :label="t('settings.interface.dateFormat')"
            :help="t('settings.interface.dateFormatHelp')"
          />
        </div>
      </template>
    </AppSettings>
  </AppSettingsPage>
</template>
<style scoped>
/* the card ends at its own padding : no margin of the last field under it */
:deep(.card-body > .mb-3:last-child),
:deep(.card-body > :last-child > .mb-3:last-child) {
  margin-bottom: 0 !important;
}
/* as wide as the language below it (AppEnvField : a dropdown's width on the settings pages) */
.af-interface-field :deep(.input-group) {
  max-width: 20rem;
}
</style>
<route lang="yaml">
meta:
  layout: settings
</route>
