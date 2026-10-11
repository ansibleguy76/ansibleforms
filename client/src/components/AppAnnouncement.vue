<script setup>
/******************************************************************/
/*                                                                */
/*  The announcement under the header (Maintenance Sunday 22:00)  */
/*  : Settings > Appearance > Interface > Announcement, in its    */
/*  level's colour, until its end date (the server stops sending  */
/*  it).                                                          */
/*  Closed, it stays closed for this tab's session - until the    */
/*  message changes.                                              */
/*                                                                */
/******************************************************************/
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAppStore } from '@/stores/app';

const { t } = useI18n();
const store = useAppStore();
// the message closed in this session, by its text and end : a new one shows again
const KEY = 'af_announcement_closed';
const keyOf = (b) => (b ? `${b.message}|${b.until || ''}` : '');
const closed = ref(readClosed());

/**
 * The announcement closed in this session, when the browser keeps it.
 *
 * Returns:
 *   string: its key, or empty.
 */
function readClosed() {
  try {
    return sessionStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Closes the announcement for this session.
 */
function close() {
  closed.value = keyOf(store.banner);
  try {
    sessionStorage.setItem(KEY, closed.value);
  } catch {
    // no storage : closed until the page reloads
  }
}

const shown = computed(() => !!store.banner?.message && closed.value !== keyOf(store.banner));
// its level's icon
const ICONS = { info: 'circle-info', warning: 'triangle-exclamation', danger: 'circle-exclamation' };
const level = computed(() => (ICONS[store.banner?.level] ? store.banner.level : 'info'));
</script>
<template>
  <div v-if="shown" class="af-announcement" :class="`af-announcement-${level}`" role="status">
    <FaIcon :icon="ICONS[level]" class="me-2" />
    <span class="af-announcement-text">{{ store.banner.message }}</span>
    <button
      type="button"
      class="btn-close ms-auto"
      :aria-label="t('settings.interface.bannerClose')"
      :title="t('settings.interface.bannerClose')"
      @click="close"
    ></button>
  </div>
</template>
<style scoped>
/* one line under the header, as the newer version notice : its level's light tint */
.af-announcement {
  display: flex;
  align-items: center;
  padding: 0.5rem 2.5rem;
  font-size: 0.9375rem;
  border-bottom: 1px solid;
}
.af-announcement-text {
  white-space: pre-line;
}
.af-announcement-info {
  color: var(--bs-info-text-emphasis);
  background-color: var(--bs-info-bg-subtle);
  border-color: var(--bs-info-border-subtle);
}
.af-announcement-warning {
  color: var(--bs-warning-text-emphasis);
  background-color: var(--bs-warning-bg-subtle);
  border-color: var(--bs-warning-border-subtle);
}
.af-announcement-danger {
  color: var(--bs-danger-text-emphasis);
  background-color: var(--bs-danger-bg-subtle);
  border-color: var(--bs-danger-border-subtle);
}
</style>
