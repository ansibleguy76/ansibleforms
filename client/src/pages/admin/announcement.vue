<script setup>
/******************************************************************/
/*                                                                */
/*  Settings > Appearance > Announcement : a message under the    */
/*  header for everyone (Maintenance Sunday 22:00), its level     */
/*  (info, warning, danger) and the moment it ends. Kept in the   */
/*  settings row ; the server stops sending it once ended.        */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import Profile from '@/lib/Profile';
import { useSettingsRow } from '@/composables/useSettingsRow';
import { useUnsavedGuard } from '@/composables/useUnsavedGuard';

const { t } = useI18n();
const authenticated = ref(false);

// its levels, as the server keeps them (models/settings.model.js)
const bannerLevels = computed(() =>
  ['info', 'warning', 'danger'].map((v) => ({ value: v, label: t(`settings.interface.banner_${v}`) })),
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
 * The announcement's fields of a settings row : none, info, no end without them.
 *
 * Args:
 *   row (object): the settings row.
 *
 * Returns:
 *   object: { banner_message, banner_level, banner_until }.
 */
function bannerOf(row) {
  return {
    banner_message: row?.banner_message || '',
    banner_level: row?.banner_level || 'info',
    banner_until: toLocalInput(row?.banner_until),
  };
}
// its end : the user's local time, sent as a moment (UTC)
const {
  edit: look,
  dirty,
  load,
  save,
} = useSettingsRow(bannerOf, (fields) => ({
  ...fields,
  banner_until: fields.banner_until ? new Date(fields.banner_until).toISOString() : null,
}));
useUnsavedGuard(
  dirty,
  () => t('settings.common.unsavedChanges'),
  () => save(`${title.value} ${t('settings.common.isUpdated')}`),
);

const title = computed(() => t('sidebar.announcement'));

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
  if (authenticated.value) await load();
});
</script>
<template>
  <AppSettingsPage>
    <AppSettings
      v-if="authenticated"
      icon="bullhorn"
      :title="title"
      :description="t('settings.interface.announcementDescription')"
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
        <BsInput
          class="af-interface-wide"
          :isFloating="false"
          icon="bullhorn"
          v-model="look.banner_message"
          :label="t('settings.interface.banner')"
          :help="t('settings.interface.bannerHelp')"
        />
        <BsInput
          class="af-interface-field mt-4"
          :isFloating="false"
          type="select"
          icon="circle-info"
          v-model="look.banner_level"
          :values="bannerLevels"
          valueKey="value"
          labelKey="label"
          :label="t('settings.interface.bannerLevel')"
          :help="t('settings.interface.bannerLevelHelp')"
        />
        <BsInput
          class="af-interface-field mt-4"
          :isFloating="false"
          type="datetime-local"
          icon="calendar"
          v-model="look.banner_until"
          :label="t('settings.interface.bannerUntil')"
          :help="t('settings.interface.bannerUntilHelp')"
        />
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
/* the message : wider, a sentence or two on one line */
.af-interface-wide :deep(.input-group) {
  max-width: 40rem;
}
</style>
<route lang="yaml">
meta:
  layout: settings
</route>
