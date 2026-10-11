<script setup>
/******************************************************************/
/*                                                                */
/*  Settings > Appearance > Links : the links of the header, in   */
/*  tabs (the tab kept in the address) :                          */
/*    Built-in : the Designer's, shown or not (SHOW_DESIGNER, an  */
/*      environment variable applied without a restart).          */
/*      Switched off, the designer is gone for everyone : its     */
/*      link, its page, its api.                                  */
/*    Custom : the instance's own links after them (a wiki, a     */
/*      runbook, a support portal) - a label, an address, an      */
/*      icon, a new tab or not. Kept in the settings row ; the    */
/*      server keeps only http(s) sites and pages of the app.     */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import Profile from '@/lib/Profile';
import State from '@/lib/State';
import { isIconName, LINK_ICONS } from '@/lib/iconName';
import { useEnvVars } from '@/composables/useEnvVars';
import { useSettingsRow } from '@/composables/useSettingsRow';
import { useUnsavedGuard } from '@/composables/useUnsavedGuard';
import { useRouteTab } from '@/composables/useRouteTab';

const { t } = useI18n();
const authenticated = ref(false);

// ─── tabs ─────────────────────────────────────────────────────────────────────
const tabs = computed(() => [
  { key: 'builtin', label: t('settings.interface.tabBuiltin'), icon: 'cube' },
  { key: 'custom', label: t('settings.interface.tabCustom'), icon: 'pen-to-square' },
]);
const { activeTab, tabLink } = useRouteTab('builtin', (key) => tabs.value.some((x) => x.key === key));
// the title names the tab : Links › Custom, each step a link
const crumbs = computed(() => {
  const tab = tabs.value.find((x) => x.key === activeTab.value);
  const base = [{ title: t('sidebar.links'), icon: 'link', to: tabLink('builtin') }];
  return tab ? [...base, { title: tab.label, icon: tab.icon, to: tabLink(tab.key) }] : base;
});

// as many as the header has room for, as the server keeps them (models/settings.model.js)
const MAX_LINKS = 5;
// the title's popover : what the page is for, and on Custom how a link is written
const description = computed(() =>
  activeTab.value === 'custom'
    ? `${t('settings.interface.linksDescription')} ${t('settings.interface.linksHelp', { max: MAX_LINKS })}`
    : t('settings.interface.linksDescription'),
);

// ─── Built-in : the Designer's link, an environment variable ─────────────────
const { envItems, envEdits, envDirty, envRestartPending, loadEnvironmentVariables, saveEnvironmentVariables } =
  useEnvVars(['SHOW_DESIGNER']);
// said as the header shows it : the designer's link, there or not
const builtin = computed(() =>
  envItems.value.map((e) => ({
    ...e,
    short: t('settings.interface.designer'),
    hint: t('settings.interface.designerHelp'),
  })),
);

// ─── Custom : the instance's own links, in the settings row ──────────────────

/**
 * The own links of a settings row, as the page edits them.
 *
 * Args:
 *   row (object): the settings row.
 *
 * Returns:
 *   object: { header_links : [{ label, url, icon, newTab }] }.
 */
function linksOf(row) {
  let list;
  try {
    list = JSON.parse(row?.header_links || '[]');
  } catch {
    list = [];
  }
  return {
    header_links: (Array.isArray(list) ? list : []).map((l) => ({
      label: l.label || '',
      url: l.url || '',
      icon: l.icon || 'link',
      newTab: !!l.newTab,
    })),
  };
}
const { edit: own, dirty: ownDirty, load: loadOwn, save: saveOwn } = useSettingsRow(linksOf);

/**
 * Whether an address may be a header link : an http or https site, or a page of the app (one
 * leading slash, not two ; no backslash or space). The server checks it again.
 *
 * Args:
 *   url (string): the address.
 *
 * Returns:
 *   boolean: true when it may.
 */
function isLinkUrl(url) {
  const u = String(url || '').trim();
  if (!u || u.length > 500 || /[\s\\]/.test(u)) return false;
  if (/^\/(?!\/)/.test(u)) return true;
  try {
    const parsed = new URL(u);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !!parsed.hostname;
  } catch {
    return false;
  }
}

// a link that would not be kept : no label, or an address the header may not open
const invalid = computed(() => own.value.header_links.map((l) => ({ label: !l.label.trim(), url: !isLinkUrl(l.url) })));
const anyInvalid = computed(() => invalid.value.some((x) => x.label || x.url));

/**
 * Adds an empty link at the end.
 */
function addLink() {
  if (own.value.header_links.length >= MAX_LINKS) return;
  own.value.header_links.push({ label: '', url: 'https://', icon: 'link', newTab: true });
}

/**
 * Moves a link one place up or down : the header shows them in this order.
 *
 * Args:
 *   index (number): the link.
 *   step (number): -1 up, 1 down.
 */
function moveLink(index, step) {
  const list = own.value.header_links;
  const to = index + step;
  if (to < 0 || to >= list.length) return;
  [list[index], list[to]] = [list[to], list[index]];
}

/**
 * Removes a link.
 *
 * Args:
 *   index (number): the link.
 */
function removeLink(index) {
  own.value.header_links.splice(index, 1);
}

// ─── saving ───────────────────────────────────────────────────────────────────
const dirty = computed(() => envDirty.value || ownDirty.value);
useUnsavedGuard(dirty, () => t('settings.common.unsavedChanges'));

/**
 * Saves what changed : the switches, then the own links ; the header follows at once.
 */
async function save() {
  if (anyInvalid.value) return;
  if (envDirty.value) await saveEnvironmentVariables();
  if (ownDirty.value) await saveOwn(`${t('sidebar.links')} ${t('settings.common.isUpdated')}`);
  await Promise.all([State.loadAppConfig(), State.loadHeaderLinks()]);
}

onMounted(async () => {
  authenticated.value = !!(await Profile.load());
  if (authenticated.value) await Promise.all([loadEnvironmentVariables(), loadOwn()]);
});
</script>
<template>
  <AppSettingsPage>
    <AppSettings
      v-if="authenticated"
      icon="link"
      :title="t('sidebar.links')"
      :crumbs="crumbs"
      :description="description"
    >
      <template #tabs>
        <ul class="nav nav-tabs mb-0">
          <li v-for="tab in tabs" :key="tab.key" class="nav-item">
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
        <BsButton
          v-if="activeTab === 'custom'"
          icon="plus"
          cssClass="me-3"
          :disabled="own.header_links.length >= MAX_LINKS"
          @click="addLink()"
          >{{ t('settings.interface.addLink') }}</BsButton
        >
        <BsButton
          icon="save"
          :colorClass="dirty && !anyInvalid ? 'primary' : 'secondary'"
          :disabled="!dirty || anyInvalid"
          @click="save()"
          >{{ t('settings.common.save') }}</BsButton
        >
      </template>
      <template #default>
        <div v-if="envRestartPending.length" class="alert alert-warning py-2">
          <FaIcon icon="triangle-exclamation" class="me-2" />
          {{ t('settings.settingsPage.envRestartPending', { names: envRestartPending.join(', ') }) }}
        </div>
        <!-- Built-in : the Designer's link -->
        <div v-show="activeTab === 'builtin'">
          <AppEnvField v-for="e in builtin" :key="e.name" v-model="envEdits[e.name]" :e="e" :asSwitch="true" />
        </div>
        <!-- Custom : the instance's own links, in the header's order -->
        <div v-show="activeTab === 'custom'">
          <div v-if="!own.header_links.length" class="empty-state">
            <FaIcon icon="link" class="empty-state-icon" />
            <span>{{ t('settings.interface.noLinks') }}</span>
          </div>
          <div v-else class="af-links">
            <div class="af-links-row af-links-head">
              <span>{{ t('settings.interface.linkIcon') }}</span>
              <span>{{ t('settings.interface.linkLabel') }}</span>
              <span>{{ t('settings.interface.linkUrl') }}</span>
              <span class="text-center">{{ t('settings.interface.linkNewTab') }}</span>
              <span></span>
            </div>
            <div v-for="(l, i) in own.header_links" :key="i" class="af-links-row">
              <!-- the icon : picked from a few that suit a link, shown in the field's grey box (as a
                   category's icon in the designer) -->
              <div class="input-group input-group-sm">
                <span class="input-group-text"
                  ><FaIcon :icon="isIconName(l.icon) ? l.icon : 'link'" fixed-width
                /></span>
                <select v-model="l.icon" class="form-select" :aria-label="t('settings.interface.linkIcon')">
                  <!-- an icon not in the list (saved through the api) : offered, so it stays visible -->
                  <option v-if="l.icon && !LINK_ICONS.includes(l.icon)" :value="l.icon">{{ l.icon }}</option>
                  <option v-for="name in LINK_ICONS" :key="name" :value="name">{{ name }}</option>
                </select>
              </div>
              <input
                v-model="l.label"
                class="form-control form-control-sm"
                :class="{ 'is-invalid': invalid[i]?.label }"
                maxlength="30"
                :aria-label="t('settings.interface.linkLabel')"
              />
              <input
                v-model.trim="l.url"
                class="form-control form-control-sm"
                :class="{ 'is-invalid': invalid[i]?.url }"
                :aria-label="t('settings.interface.linkUrl')"
                spellcheck="false"
              />
              <div class="form-check form-switch d-flex justify-content-center mb-0">
                <input
                  v-model="l.newTab"
                  class="form-check-input"
                  type="checkbox"
                  role="switch"
                  :aria-label="t('settings.interface.linkNewTab')"
                />
              </div>
              <div class="d-flex gap-1 justify-content-end">
                <button
                  type="button"
                  class="btn btn-sm btn-link px-1"
                  :disabled="i === 0"
                  :title="t('settings.interface.linkUp')"
                  @click="moveLink(i, -1)"
                >
                  <FaIcon icon="arrow-up" />
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-link px-1"
                  :disabled="i === own.header_links.length - 1"
                  :title="t('settings.interface.linkDown')"
                  @click="moveLink(i, 1)"
                >
                  <FaIcon icon="arrow-down" />
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-link px-1 text-danger"
                  :title="t('common.delete')"
                  @click="removeLink(i)"
                >
                  <FaIcon icon="trash" />
                </button>
              </div>
            </div>
          </div>
        </div>
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
/* the own links : one row each, the same columns for the header line */
.af-links {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: 60rem;
}
.af-links-row {
  display: grid;
  grid-template-columns: 11rem 12rem minmax(12rem, 1fr) 5rem 6rem;
  gap: 0.75rem;
  align-items: center;
}
.af-links-head {
  font-weight: 600;
  font-size: 0.875rem;
}
</style>
<route lang="yaml">
meta:
  layout: settings
</route>
