<script setup>
/******************************************************************/
/*                                                                */
/*  The announcements under the header (Maintenance Sunday 22:00) */
/*  : Settings > Appearance > Announcements, each in its type's   */
/*  colour, from its start until its end (the server sends those  */
/*  running now). Closed, one stays closed for this tab's session */
/*  - until its message or its end changes.                       */
/*                                                                */
/*  Until the server's are read (State.loadAppConfig, at start-up */
/*  ) the ones shown last time in this browser keep their room :  */
/*  each its colour and height, a grey bar for its text, so the   */
/*  page under them does not move down when they come.            */
/*                                                                */
/******************************************************************/
import { ref, computed, watch, nextTick } from 'vue';
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

// ------------------------------------------------------------------
// their room while they are read : the level and height of each shown last time
// ------------------------------------------------------------------
const SHAPE_KEY = 'af_announcements_shape';
const box = ref(null);

/**
 * The announcements shown last time in this browser, as their room : level and height.
 *
 * Returns:
 *   Array: [{ level, height }] ; none when nothing was remembered (or no storage).
 */
function readShape() {
  try {
    const list = JSON.parse(localStorage.getItem(SHAPE_KEY) || '[]');
    return Array.isArray(list) ? list.filter((x) => ICONS[x?.level] && x.height > 0 && x.height < 400) : [];
  } catch {
    return [];
  }
}
const lastShape = readShape();

// once shown (or closed, or gone), their room is remembered for the next start
watch(
  [() => store.appConfigLoaded, shown],
  async ([loaded]) => {
    if (!loaded) return;
    await nextTick();
    const rows = [...(box.value?.parentElement?.querySelectorAll(':scope > .af-announcement') || [])];
    const shape = shown.value.map((a, i) => ({ level: levelOf(a), height: Math.round(rows[i]?.offsetHeight || 0) }));
    try {
      localStorage.setItem(SHAPE_KEY, JSON.stringify(shape.filter((x) => x.height > 0)));
    } catch {
      // no storage : no room kept at the next start
    }
  },
  { immediate: true },
);
</script>
<template>
  <!-- a marker for the measure above (its parent holds the announcements) -->
  <span ref="box" class="d-none"></span>
  <!-- not read yet : the room of those shown last time, each its colour, a grey bar for its text -->
  <template v-if="!store.appConfigLoaded">
    <div
      v-for="(r, i) in lastShape"
      :key="'room-' + i"
      class="af-announcement af-announcement-room"
      :class="`af-announcement-${r.level}`"
      :style="{ height: r.height + 'px' }"
      aria-hidden="true"
    >
      <AppSkeleton shape="inline" width="22rem" :delay="0" />
    </div>
  </template>
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
