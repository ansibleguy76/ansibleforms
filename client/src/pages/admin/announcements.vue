<script setup>
/******************************************************************/
/*                                                                */
/*  Settings > Appearance > Announcements, in two tabs, the tab   */
/*  kept in the url :                                             */
/*  General - the announcements shown or not, as a whole (kept   */
/*            in the settings row) ; Add announcement opens the   */
/*            wizard, then the list shows the new one             */
/*  List    - every announcement : its message, its type, its     */
/*            start and its end, scheduled, showing or ended ;    */
/*            New opens the wizard (models/announcement.model.js) */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import Profile from '@/lib/Profile';
import getSettings from '@/config/settings';
import { useRouteTab } from '@/composables/useRouteTab';
import { useSettingsRow } from '@/composables/useSettingsRow';
import { useUnsavedGuard } from '@/composables/useUnsavedGuard';
import { inSentence } from '@/lib/inSentence';

const { t, locale } = useI18n();
const settings = computed(() => getSettings(t));
const authenticated = ref(false);
const title = computed(() => t('sidebar.announcement'));

// ─── tabs ─────────────────────────────────────────────────────────────────────
const pageTabs = computed(() => [
  { key: 'general', label: t('settings.common.tabGeneral'), icon: 'sliders' },
  { key: 'list', label: t('settings.interface.announcementsTabList'), icon: 'list' },
]);
const { activeTab, tabLink } = useRouteTab('general', (key) => ['general', 'list'].includes(key));
// the title says the tab : Announcements › General, Announcements › List, each step a link
const crumbs = computed(() => {
  const tab = pageTabs.value.find((x) => x.key === activeTab.value);
  return [
    { title: title.value, icon: 'bullhorn', to: '/settings/announcements' },
    { title: tab.label, icon: tab.icon, to: tabLink(tab.key) },
  ];
});

// ─── General : the switch ─────────────────────────────────────────────────────
/**
 * The switch of a settings row : shown unless switched off.
 *
 * Args:
 *   row (object): the settings row.
 *
 * Returns:
 *   object: { banner_show }.
 */
function showOf(row) {
  return { banner_show: row?.banner_show !== 0 && row?.banner_show !== false };
}
const { edit: look, dirty, load, save } = useSettingsRow(showOf);
// the list's wizard, without its list : Add announcement on General opens it
const wizard = ref(null);
useUnsavedGuard(
  dirty,
  () => t('settings.common.unsavedChanges'),
  () => save(`${title.value} ${t('settings.common.isUpdated')}`),
);

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
  if (authenticated.value) await load();
});
</script>
<template>
  <AppSettingsPage>
    <!-- LIST : every announcement, New opens the wizard ; the page's tabs above it -->
    <AppAdminMulti
      v-if="authenticated && activeTab === 'list'"
      :apiVersion="2"
      :settings="settings.announcements"
      :crumbs="crumbs"
    >
      <template #tabs>
        <ul class="nav nav-tabs mb-0">
          <li v-for="tab in pageTabs" :key="tab.key" class="nav-item">
            <a
              class="nav-link"
              :class="{ active: activeTab === tab.key }"
              href="#"
              @click.prevent="activeTab = tab.key"
            >
              <FaIcon :icon="tab.icon" class="me-1" />
              {{ tab.label }}
            </a>
          </li>
        </ul>
      </template>
    </AppAdminMulti>
    <!-- GENERAL : the announcements shown or not -->
    <AppSettings
      v-else-if="authenticated"
      icon="bullhorn"
      :title="title"
      :crumbs="crumbs"
      :description="t('settings.interface.announcementDescription')"
    >
      <template #tabs>
        <ul class="nav nav-tabs mb-0">
          <li v-for="tab in pageTabs" :key="tab.key" class="nav-item">
            <a
              class="nav-link"
              :class="{ active: activeTab === tab.key }"
              href="#"
              @click.prevent="activeTab = tab.key"
            >
              <FaIcon :icon="tab.icon" class="me-1" />
              {{ tab.label }}
            </a>
          </li>
        </ul>
      </template>
      <template #actions>
        <!-- the wizard, as the list's Add ; once added, the list shows the new one -->
        <BsButton icon="plus" @click="wizard?.newItem()">{{
          t('settings.common.addItem', { item: inSentence(t('settings.interface.announcementLabel'), locale) })
        }}</BsButton>
        <BsButton icon="save" :disabled="!dirty" @click="save(`${title} ${t('settings.common.isUpdated')}`)">{{
          t('settings.common.save')
        }}</BsButton>
      </template>
      <template #default>
        <label class="form-label fw-bold af-switch-title" for="af-banner-show">{{
          t('settings.interface.bannerShow')
        }}</label>
        <div class="form-check form-switch mb-0">
          <input
            id="af-banner-show"
            v-model="look.banner_show"
            class="form-check-input"
            type="checkbox"
            role="switch"
          />
        </div>
        <div class="form-text mb-0">{{ t('settings.interface.bannerShowHelp') }}</div>
      </template>
    </AppSettings>
    <AppAdminMulti
      v-if="authenticated && activeTab === 'general'"
      ref="wizard"
      :apiVersion="2"
      :settings="settings.announcements"
      dialogOnly
      @created="activeTab = 'list'"
    />
  </AppSettingsPage>
</template>
<route lang="yaml">
meta:
  layout: settings
</route>
