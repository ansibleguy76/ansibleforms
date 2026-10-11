<script setup>
/******************************************************************/
/*                                                                */
/*  Settings > Appearance > Environment : the label beside the    */
/*  header's logo (PRODUCTION, TEST), shown or not, its text, its */
/*  colour, and a preview of the header with it. Kept in the      */
/*  settings row.                                                 */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import Profile from '@/lib/Profile';
import { PILL } from '@/lib/tableCells';
import { useSettingsRow } from '@/composables/useSettingsRow';
import { useUnsavedGuard } from '@/composables/useUnsavedGuard';

const { t } = useI18n();
const authenticated = ref(false);

// the label's colours (the app's pill tones), as the server keeps them (models/settings.model.js)
const LABEL_COLORS = ['blue', 'green', 'amber', 'orange', 'red', 'grey'];

/**
 * The label's fields of a settings row : shown, without text, red when it has none.
 *
 * Args:
 *   row (object): the settings row.
 *
 * Returns:
 *   object: { env_label_show, env_label, env_label_color }.
 */
function labelOf(row) {
  return {
    // shown unless switched off
    env_label_show: row?.env_label_show !== 0 && row?.env_label_show !== false,
    env_label: row?.env_label || '',
    env_label_color: row?.env_label_color || 'red',
  };
}
const { edit: look, dirty, load, save } = useSettingsRow(labelOf);
useUnsavedGuard(dirty, () => t('settings.common.unsavedChanges'));

// the header as it is (its background, its logo's image) : the preview shows it so
const headerLook = ref({ background: '', logo: '' });

/**
 * Reads the header's background and logo, for the preview.
 */
function readHeaderLook() {
  const header = document.querySelector('nav.af-header');
  const logo = header?.querySelector('.af-brand img');
  headerLook.value = {
    background: header ? getComputedStyle(header).backgroundColor : '',
    logo: logo ? logo.currentSrc || logo.src : '',
  };
}

const title = computed(() => t('sidebar.environment'));

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
  if (!authenticated.value) return;
  await load();
  readHeaderLook();
});
</script>
<template>
  <AppSettingsPage>
    <AppSettings
      v-if="authenticated"
      icon="tag"
      :title="title"
      :description="t('settings.interface.environmentDescription')"
    >
      <template #actions>
        <BsButton
          icon="save"
          :colorClass="dirty ? 'primary' : 'secondary'"
          :disabled="!dirty"
          @click="save(`${title} ${t('settings.common.isUpdated')}`)"
          >{{ t('settings.common.save') }}</BsButton
        >
      </template>
      <template #default>
        <!-- the label beside the logo, and its colour (a pill, shown as the header shows it) -->
        <label class="form-label fw-bold af-switch-title" for="af-env-label-show">{{
          t('settings.interface.envLabelShow')
        }}</label>
        <div class="form-check form-switch mb-0">
          <input
            id="af-env-label-show"
            v-model="look.env_label_show"
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
          v-model="look.env_label"
          :label="t('settings.interface.envLabel')"
          :help="t('settings.interface.envLabelHelp')"
        />
        <!-- its colour : round swatches, as the Color theme's -->
        <label class="form-label fw-bold mt-4 d-block">{{ t('settings.interface.envLabelColor') }}</label>
        <div class="d-flex flex-wrap gap-2 ms-1" role="radiogroup" :aria-label="t('settings.interface.envLabelColor')">
          <button
            v-for="c in LABEL_COLORS"
            :key="c"
            type="button"
            class="settings-color-swatch af-label-swatch"
            :class="[PILL[c], { 'af-label-swatch-active': look.env_label_color === c }]"
            :title="c"
            role="radio"
            :aria-checked="look.env_label_color === c"
            @click="look.env_label_color = c"
          >
            <FaIcon v-if="look.env_label_color === c" icon="check" class="settings-swatch-check" />
          </button>
        </div>
        <!-- the preview : the header's logo and the label, as the header shows them -->
        <label class="form-label fw-bold mt-4 d-block">{{ t('settings.interface.envLabelPreview') }}</label>
        <div class="af-label-preview" :style="{ backgroundColor: headerLook.background }">
          <img v-if="headerLook.logo" :src="headerLook.logo" class="af-label-preview-logo" alt="" />
          <span
            class="badge rounded-pill fw-semibold af-pill af-label-preview-pill"
            :class="PILL[look.env_label_color] || PILL.grey"
            :style="{ opacity: look.env_label_show ? 1 : 0.35 }"
          >
            <span class="af-pill-label">{{ look.env_label || 'PRODUCTION' }}</span>
          </span>
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
/* as wide as the other short fields of the settings pages */
.af-interface-field :deep(.input-group) {
  max-width: 20rem;
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
  /* a little room under it : the card's other pages end on a line of help text, lighter */
  margin-bottom: 0.5rem;
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
  /* as the header's (AppEnvLabel) */
  font-size: 12px;
}
/* its letters apart, as the header's (AppEnvLabel) */
.af-label-preview-pill .af-pill-label {
  letter-spacing: 0.06em;
}
</style>
<route lang="yaml">
meta:
  layout: settings
</route>
