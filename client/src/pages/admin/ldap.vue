<script setup>
/******************************************************************/
/*                                                                */
/*  Settings > Access > LDAP : the directories users sign in      */
/*  with, in the order a bare username is looked up in. Each      */
/*  opens its own page (ldap-directory.vue) ; New asks its        */
/*  fields, its page's tabs as steps, and puts it last. Its row's */
/*  Move up and Move down change the lookup order (moveActions,   */
/*  config/settings.js). The default directory keeps its members' */
/*  short names and cannot be deleted.                            */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import Profile from '@/lib/Profile';
import getSettings from '@/config/settings';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const settings = computed(() => getSettings(t));

const authenticated = ref(false);
// the directory being tested (its row's Test connection), as saved
const testing = ref(null);

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
});
</script>
<template>
  <AppLdapTestDialog v-if="testing" :directory="testing" @close="testing = null" />
  <AppSettingsPage>
    <AppAdminMulti
      v-if="authenticated"
      :settings="settings.ldapDirectories"
      :apiVersion="2"
      @test="(item) => (testing = item)"
    />
  </AppSettingsPage>
</template>
<route lang="yaml">
meta:
  layout: settings
</route>
