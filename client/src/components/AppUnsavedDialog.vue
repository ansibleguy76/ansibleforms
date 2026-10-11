<script setup>
/******************************************************************/
/*                                                                */
/*  The Unsaved changes dialog : asked when a page with unsaved   */
/*  changes is left (useUnsavedGuard). Save and leave saves, then */
/*  goes on (a page that says how it saves) ; Leave without       */
/*  saving goes on ; Close, the cross, Escape or the backdrop     */
/*  stay.                                                         */
/*                                                                */
/******************************************************************/
import { useI18n } from 'vue-i18n';
import { unsavedPrompt, answerUnsaved, saveAndLeave } from '@/lib/unsavedPrompt';

const { t } = useI18n();
</script>

<template>
  <BsModal
    v-if="unsavedPrompt.open"
    size="md"
    :dialogClass="unsavedPrompt.save ? 'af-unsaved-dialog' : ''"
    @close="answerUnsaved(false)"
    icon="triangle-exclamation"
    iconClass="text-warning"
  >
    <template #title>
      {{ t('settings.common.unsavedTitle') }}
    </template>
    <template #default>
      <!-- with Save and leave the question is whether to save ; without, whether to lose them -->
      <p class="mb-0 fs-6">
        {{ unsavedPrompt.save ? t('settings.common.unsavedSaveQuestion') : unsavedPrompt.message }}
      </p>
    </template>
    <template #footer>
      <!-- the likely answer first : keep the changes -->
      <BsButton
        v-if="unsavedPrompt.save"
        icon="save"
        colorClass="primary"
        :disabled="unsavedPrompt.saving"
        @click="saveAndLeave()"
        >{{ t('settings.common.unsavedSaveLeave') }}</BsButton
      >
      <BsButton icon="right-from-bracket" :disabled="unsavedPrompt.saving" @click="answerUnsaved(true)">{{
        t('settings.common.unsavedLeave')
      }}</BsButton>
    </template>
  </BsModal>
</template>
<style>
/* with Save and leave : its three buttons on one line */
.af-unsaved-dialog {
  max-width: 37.5rem;
}
</style>
