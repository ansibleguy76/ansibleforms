<script setup>
/******************************************************************/
/*                                                                */
/*  Settings > Appearance > Name : the application's name, in the */
/*  browser tab and on the sign-in page ; Ansible Forms without   */
/*  one. Kept in the settings row.                                */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import Profile from '@/lib/Profile';
import { useSettingsRow } from '@/composables/useSettingsRow';
import { useUnsavedGuard } from '@/composables/useUnsavedGuard';

const { t } = useI18n();
const authenticated = ref(false);
// the page's values read once : until then its fields as grey placeholders
const loaded = ref(false);

/**
 * The name of a settings row, as the page edits it : empty without one.
 *
 * Args:
 *   row (object): the settings row.
 *
 * Returns:
 *   object: { app_name }.
 */
function nameOf(row) {
  return { app_name: row?.app_name || '' };
}
const { edit: look, dirty, load, save } = useSettingsRow(nameOf);
useUnsavedGuard(
  dirty,
  () => t('settings.common.unsavedChanges'),
  () => save(`${title.value} ${t('settings.common.isUpdated')}`),
);

const title = computed(() => t('sidebar.name'));

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
  if (authenticated.value) await load();
  loaded.value = true;
});
</script>
<template>
  <AppSettingsPage>
    <AppSettings v-if="authenticated" icon="font" :title="title" :description="t('settings.interface.nameDescription')">
      <template #actions>
        <BsButton icon="save" :disabled="!dirty" @click="save(`${title} ${t('settings.common.isUpdated')}`)">{{
          t('settings.common.save')
        }}</BsButton>
      </template>
      <template #default>
        <!-- the first load : the fields as grey placeholders, in their place -->
        <AppSkeleton v-if="!loaded" shape="form" :count="1" />
        <template v-else>
          <BsInput
            class="af-interface-field"
            :isFloating="false"
            icon="font"
            v-model="look.app_name"
            placeholder="Ansible Forms"
            :label="t('settings.interface.appName')"
            :help="t('settings.interface.appNameHelp')"
          />
        </template>
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
/* as wide as the other fields of the settings pages */
.af-interface-field :deep(.input-group) {
  max-width: 40rem;
}
</style>
<route lang="yaml">
meta:
  layout: settings
</route>
