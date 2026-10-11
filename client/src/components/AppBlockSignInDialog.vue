<script setup>
/******************************************************************/
/*                                                                */
/*  Asks before blocking a user's sign-in : its sessions end at   */
/*  once and every sign-in is refused until it is allowed again.  */
/*  The users list's row menu and a user's page (local, LDAP or   */
/*  SSO) open it ; `confirm` blocks, `close` leaves it.           */
/*                                                                */
/******************************************************************/
import { useI18n } from 'vue-i18n';

defineProps({
  // the user's name, as the question says it
  name: { type: String, required: true },
});
const emit = defineEmits(['confirm', 'close']);
const { t } = useI18n();
</script>
<template>
  <BsModal size="md" @close="emit('close')" icon="ban">
    <template #title> {{ t('settings.directory.blockSignIn') }} </template>
    <template #default>
      <p class="mb-0 fs-6 user-select-none">{{ t('settings.directory.blockConfirm', { name }) }}</p>
    </template>
    <template #footer>
      <BsButton icon="ban" @click="emit('confirm')">{{ t('settings.directory.blockSignIn') }}</BsButton>
    </template>
  </BsModal>
</template>
