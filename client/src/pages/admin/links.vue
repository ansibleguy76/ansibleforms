<script setup>
/******************************************************************/
/*                                                                */
/*  Settings > Appearance > Links : the links of the header -     */
/*  the Designer's, shown or not (SHOW_DESIGNER, an environment   */
/*  variable applied without a restart). Switched off, the        */
/*  designer is gone for everyone : its link, its page, its api.  */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import Profile from '@/lib/Profile';
import State from '@/lib/State';
import { useEnvVars } from '@/composables/useEnvVars';
import { useUnsavedGuard } from '@/composables/useUnsavedGuard';

const { t } = useI18n();
const authenticated = ref(false);

const { envItems, envEdits, envDirty, envRestartPending, loadEnvironmentVariables, saveEnvironmentVariables } =
  useEnvVars(['SHOW_DESIGNER']);
// said as the header shows it : the designer's link, there or not
const links = computed(() =>
  envItems.value.map((e) => ({
    ...e,
    short: t('settings.interface.designer'),
    hint: t('settings.interface.designerHelp'),
  })),
);
useUnsavedGuard(envDirty, () => t('settings.common.unsavedChanges'));

/**
 * Saves the switches, then the header follows at once.
 */
async function save() {
  await saveEnvironmentVariables();
  await State.loadAppConfig();
}

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
  if (authenticated.value) await loadEnvironmentVariables();
});
</script>
<template>
  <AppSettingsPage>
    <AppSettings
      v-if="authenticated"
      icon="link"
      :title="t('sidebar.links')"
      :description="t('settings.interface.linksDescription')"
    >
      <template #actions>
        <BsButton icon="save" :colorClass="envDirty ? 'primary' : 'secondary'" :disabled="!envDirty" @click="save()">{{
          t('settings.common.save')
        }}</BsButton>
      </template>
      <template #default>
        <div v-if="envRestartPending.length" class="alert alert-warning py-2">
          <FaIcon icon="triangle-exclamation" class="me-2" />
          {{ t('settings.settingsPage.envRestartPending', { names: envRestartPending.join(', ') }) }}
        </div>
        <AppEnvField v-for="e in links" :key="e.name" v-model="envEdits[e.name]" :e="e" :asSwitch="true" />
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
</style>
<route lang="yaml">
meta:
  layout: settings
</route>
