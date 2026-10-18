<script setup>
/******************************************************************/
/*                                                                */
/*  Settings > Access > LDAP : the directories users sign in      */
/*  with, in the order a bare username is looked up in. Each      */
/*  opens its own page (ldap-directory.vue) ; New asks its        */
/*  fields, its page's tabs as steps, and puts it last. Its row's */
/*  Move up and Move down change the lookup order. The default    */
/*  directory keeps its members' short names and cannot be        */
/*  deleted.                                                      */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { toast } from 'vue-sonner';
import Profile from '@/lib/Profile';
import getSettings from '@/config/settings';
import { useI18n } from 'vue-i18n';
import Helpers from '@/lib/Helpers';

const { t } = useI18n();
const settings = computed(() => getSettings(t));

const authenticated = ref(false);
// the directory being tested (its row's Test connection), as saved
const testing = ref(null);
const list = ref(null);

/**
 * Moves a directory one place up or down in the lookup order, then shows the list again.
 *
 * Args:
 *   item (object): the directory.
 *   direction (string): 'up' or 'down'.
 */
async function move(item, direction) {
  try {
    await axios.post(`/api/v2/ldapdirectory/${item.id}/move`, { direction });
    await list.value?.loadItems();
  } catch (err) {
    toast.error(Helpers.parseAxiosResponseError(err));
  }
}

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
});
</script>
<template>
  <AppLdapTestDialog v-if="testing" :directory="testing" @close="testing = null" />
  <AppSettingsPage>
    <AppAdminMulti
      v-if="authenticated"
      ref="list"
      :settings="settings.ldapDirectories"
      :apiVersion="2"
      @test="(item) => (testing = item)"
      @move_up="(item) => move(item, 'up')"
      @move_down="(item) => move(item, 'down')"
    />
  </AppSettingsPage>
</template>
<route lang="yaml">
meta:
  layout: settings
</route>
