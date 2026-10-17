<script setup>
/******************************************************************/
/*                                                                */
/*  Settings > Appearance > Labels : the labels beside the        */
/*  header's logo (PRODUCTION, EU...), each its text, its colour, */
/*  shown or hidden, in their order. Add label opens the dialog   */
/*  (models/label.model.js) ; a row opens its page                */
/*  (pages/admin/label.vue), its row menu enables, disables or    */
/*  moves it.                                                     */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';
import Helpers from '@/lib/Helpers';
import Profile from '@/lib/Profile';
import getSettings from '@/config/settings';

const { t } = useI18n();
const settings = computed(() => getSettings(t));
const authenticated = ref(false);
const list = ref(null);

/**
 * Moves a label one place up or down in the header, then shows the list again.
 *
 * Args:
 *   item (object): the label.
 *   direction (string): 'up' or 'down'.
 */
async function move(item, direction) {
  try {
    await axios.post(`/api/v2/label/${item.id}/move`, { direction });
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
  <AppSettingsPage>
    <AppAdminMulti
      v-if="authenticated"
      ref="list"
      :apiVersion="2"
      :settings="settings.labels"
      @move_up="(item) => move(item, 'up')"
      @move_down="(item) => move(item, 'down')"
    />
  </AppSettingsPage>
</template>
<route lang="yaml">
meta:
  layout: settings
</route>
