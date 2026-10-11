<script setup>
/******************************************************************/
/*                                                                */
/*  Settings > Users : the local users and the LDAP and SSO ones  */
/*  (AppAdminMulti, config/settings.js users) ; a row's Block     */
/*  sign-in asks first, its Allow sign-in saves at once.          */
/*                                                                */
/******************************************************************/
import getSettings from '@/config/settings';
import Profile from '@/lib/Profile';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';
import { setSignInBlocked } from '@/lib/signIn';

const { t } = useI18n();
const settings = computed(() => getSettings(t));
const authenticated = ref(false);
const adminMulti = ref(null);
// the user whose Block sign-in is being asked, null while the dialog is closed
const blocking = ref(null);

/**
 * Blocks or allows a user's sign-in, then reloads the list ; a refusal (its own sign-in) in a
 * toast.
 *
 * Args:
 *   user (object): the row.
 *   blocked (boolean): true to block.
 */
async function setBlocked(user, blocked) {
  blocking.value = null;
  const name = user.username;
  try {
    await setSignInBlocked(user, blocked);
    toast.success(
      blocked ? t('settings.directory.nowBlocked', { name }) : t('settings.directory.nowAllowed', { name }),
    );
    adminMulti.value?.loadItems();
  } catch (err) {
    toast.error(err.response?.data?.message || err.response?.data?.error || err.message);
  }
}

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
  if (!authenticated.value) {
    return;
  }
});
</script>

<template>
  <AppBlockSignInDialog
    v-if="blocking"
    :name="blocking.username"
    @confirm="setBlocked(blocking, true)"
    @close="blocking = null"
  />
  <AppSettingsPage>
    <AppAdminMulti
      v-if="authenticated"
      ref="adminMulti"
      :settings="settings.users"
      :apiVersion="2"
      @block_sign_in="(u) => (blocking = u)"
      @allow_sign_in="(u) => setBlocked(u, false)"
    />
  </AppSettingsPage>
</template>
