<script setup>
/******************************************************************/
/*                                                                */
/*  The announcements under the header (Maintenance Sunday 22:00) */
/*  : Settings > Appearance > Announcements, each in its type's   */
/*  colour, from its start until its end (the server sends those  */
/*  running now). Closed, one stays closed for this tab's session */
/*  - until its message or its end changes.                       */
/*                                                                */
/******************************************************************/
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAppStore } from '@/stores/app';

const { t } = useI18n();
const store = useAppStore();
// the announcements closed in this session, each by its id, text and end : a changed one shows again
const KEY = 'af_announcements_closed';
const keyOf = (a) => `${a.id}|${a.message}|${a.end_at || ''}`;
const closed = ref(readClosed());

/**
 * The announcements closed in this session, when the browser keeps them.
 *
 * Returns:
 *   string[]: their keys.
 */
function readClosed() {
  try {
    const list = JSON.parse(sessionStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Closes an announcement for this session.
 *
 * Args:
 *   a (object): the announcement.
 */
function close(a) {
  // only the keys of those still running are kept, so the list does not grow
  const running = new Set(store.announcements.map(keyOf));
  closed.value = [...closed.value.filter((k) => running.has(k)), keyOf(a)];
  try {
    sessionStorage.setItem(KEY, JSON.stringify(closed.value));
  } catch {
    // no storage : closed until the page reloads
  }
}

// its type's icon
const ICONS = { info: 'circle-info', warning: 'triangle-exclamation', danger: 'circle-exclamation' };
const levelOf = (a) => (ICONS[a.level] ? a.level : 'info');
const shown = computed(() => (store.announcements || []).filter((a) => a?.message && !closed.value.includes(keyOf(a))));
</script>
<template>
  <div v-for="a in shown" :key="a.id" class="af-announcement" :class="`af-announcement-${levelOf(a)}`" role="status">
    <FaIcon :icon="ICONS[levelOf(a)]" class="me-2" />
    <span class="af-announcement-text">{{ a.message }}</span>
    <button
      type="button"
      class="btn-close ms-auto"
      :aria-label="t('settings.interface.bannerClose')"
      :title="t('settings.interface.bannerClose')"
      @click="close(a)"
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
