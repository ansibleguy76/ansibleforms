<script setup>
import axios from 'axios';
import ansiParse from '@/lib/AnsiParse';
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { toast } from 'vue-sonner';
import Helpers from '@/lib/Helpers';

const { t } = useI18n();

const log = ref('');
const isLoading = ref(false);
const filter = ref('');
const scroller = ref(null);
// the last lines of the log : enough to look back through with the search, small enough to read
// every 2 seconds, as the page follows the log ; the whole log is its download
const LINES = 1000;

// The filter is a REGEX, which is the useful thing for a log - but String.match compiles
// its string argument, so a half typed one ('[', '(', '*', 'a{2,1}') threw a SyntaxError
// from inside this computed and took the whole page down. You cannot type '[abc]' without
// passing through '['. Compile it once here: while it is not valid yet, fall back to a
// plain case-insensitive substring match so the list keeps narrowing as you type.
const filterMatcher = computed(() => {
  const f = filter.value;
  if (!f) return null;
  try {
    const re = new RegExp(f);
    return (line) => re.test(line);
  } catch {
    const needle = f.toLowerCase();
    return (line) => line.toLowerCase().includes(needle);
  }
});

// Clear empties the view, never the log : the last line shown then is remembered, and only the
// lines after it are shown from there on. Not among the lines read any more (more than LINES
// were written since), every line read is newer. Reloading the page shows the last lines again.
const clearedAfter = ref(null);

/**
 * Empties the view : from now on only the lines written after this moment are shown.
 */
function clearView() {
  const lines = log.value.split('\n').filter((x) => x != '');
  clearedAfter.value = lines.length ? lines[lines.length - 1] : '';
}

const filtered = computed(() => {
  const match = filterMatcher.value;
  let lines = log.value.split('\n').filter((x) => x != '');
  if (clearedAfter.value !== null) {
    const at = clearedAfter.value === '' ? -1 : lines.lastIndexOf(clearedAfter.value);
    if (at >= 0) lines = lines.slice(at + 1);
  }
  return (match ? lines.filter(match) : lines).map((x) => ansiParse(x));
});
// ─── following the log ────────────────────────────────────────────────────────
// The log is read again every 2 seconds, as a terminal follows a file : while the view is at
// its bottom it follows the new lines ; scrolled up to read an older one, it stays where it is
// and 'New lines' takes it back down. A failing read stops it, Refresh starts it again.
const POLL_MS = 2000;
const following = ref(true);
const newLines = ref(false);
let pollTimer = null;
let stopped = false;
let failed = false;

/**
 * The box that scrolls the log : the card body around it (the first scrolling ancestor).
 *
 * Returns:
 *   HTMLElement|null: the box.
 */
function scrollBox() {
  let el = scroller.value?.parentElement;
  while (el && el !== document.body) {
    const overflow = getComputedStyle(el).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight) return el;
    el = el.parentElement;
  }
  return document.scrollingElement;
}

/**
 * Whether the view is at the bottom of the log, a few pixels spared.
 *
 * Returns:
 *   boolean: true at the bottom.
 */
function atBottom() {
  const box = scrollBox();
  return !box || box.scrollHeight - box.scrollTop - box.clientHeight < 40;
}

/**
 * Follows again from the bottom : the newest line in view.
 */
async function followBottom() {
  await nextTick();
  const box = scrollBox();
  if (box) box.scrollTop = box.scrollHeight;
  following.value = true;
  newLines.value = false;
}

// scrolled by the user : following while at the bottom, not when scrolled up
function onScroll() {
  following.value = atBottom();
  if (following.value) newLines.value = false;
}

function stopPolling() {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
}

function schedulePoll() {
  stopPolling();
  if (stopped || failed) return;
  pollTimer = setTimeout(() => {
    pollTimer = null;
    load();
  }, POLL_MS);
}

/**
 * Reads the last lines of the log, then the next read in 2 seconds.
 *
 * Args:
 *   force (boolean): Refresh : read again after a failed read too.
 */
async function load(force = false) {
  if (force) failed = false;
  if (isLoading.value || failed) return;
  // a hidden tab reads nothing : the next visible poll catches up
  if (!force && document.hidden) return schedulePoll();
  isLoading.value = true;
  try {
    const result = await axios.get(`/api/v2/log?lines=${LINES}`);
    if (result.data != '...' && result.data !== log.value) {
      const first = !log.value;
      log.value = result.data;
      if (first || following.value) await followBottom();
      else newLines.value = true;
    }
  } catch (err) {
    // a failing log endpoint stops the reading, once said ; Refresh starts it again
    if (!stopped) {
      failed = true;
      toast.error(Helpers.parseAxiosResponseError(err));
    }
  } finally {
    // always released, also when the server answered the "..." placeholder
    isLoading.value = false;
  }
  schedulePoll();
}
async function downloadWithAxios(url, authHeaders) {
  const response = await axios({
    method: 'get',
    headers: authHeaders.headers,
    url,
    responseType: 'arraybuffer',
  });
  Helpers.forceFileDownload(response);
}

async function download() {
  try {
    await downloadWithAxios(`/api/v2/log/download`);
  } catch (err) {
    toast.error(err.message);
  }
}
let box = null;
onMounted(async () => {
  await load(true);
  box = scrollBox();
  box?.addEventListener('scroll', onScroll, { passive: true });
});
onUnmounted(() => {
  stopped = true;
  stopPolling();
  box?.removeEventListener('scroll', onScroll);
});
</script>
<template>
  <AppNav />
  <div class="af-fill-page">
    <main class="d-flex flex-nowrap af-settings-layout af-with-sidebar">
      <AppSidebar />
      <AppSettings :title="t('logs.title')" :description="t('logs.description')" icon="file-lines">
        <template #headerActions>
          <div>
            <!-- the search box of the other pages : the placeholder goes on click, an X clears it -->
            <BsSearch v-model="filter" style="width: 16rem" />
          </div>
          <!-- view controls only : these decide WHAT the card shows. Refresh re-reads the same
               view, it does not act on anything ; the download follows, with the page's buttons -->
          <BsButton class="ms-2 text-nowrap" icon="refresh" @click="load(true)">{{ t('jobs.refresh') }}</BsButton>
          <!-- empties the view, not the log : only the lines written after it show from then on -->
          <BsButton class="ms-2 text-nowrap" icon="eraser" :title="t('logs.clearHint')" @click="clearView()">{{
            t('logs.clear')
          }}</BsButton>
        </template>
        <template #actions>
          <BsButton class="text-nowrap" icon="download" @click="download()">{{ t('logs.download') }}</BsButton>
        </template>
        <template #default>
          <!-- tabindex : the scrolling box is the card body around us, and a
               scroll container is only driven by the arrow / page keys once
               something inside it holds the focus -->
          <div
            ref="scroller"
            id="scroller"
            class="font-monospace fs-6"
            tabindex="0"
            role="region"
            :aria-label="t('logs.title')"
          >
            <div v-if="clearedAfter !== null && !filtered.length" class="text-body-secondary fst-italic py-2">
              {{ t('logs.cleared') }}
            </div>
            <div v-for="(t, i) in filtered" :key="i">
              <div class="text-end pe-1 me-3 d-inline-block af-line-no" style="width: 40px">{{ i + 1 }}</div>
              <span v-for="(s, si) in t" :key="si" v-text="s.text" :class="s.foreground || ''"></span>
            </div>
            <!-- scrolled up while new lines came : back to the bottom, following again -->
            <div v-if="!following" class="af-log-follow">
              <BsButton icon="arrow-down" colorClass="primary" @click="followBottom()">{{
                newLines ? t('logs.newLines') : t('logs.latest')
              }}</BsButton>
            </div>
          </div>
        </template>
      </AppSettings>
    </main>
  </div>
</template>
<style scoped>
/* 'New lines' : over the bottom of the log while it is scrolled up, centred */
.af-log-follow {
  position: sticky;
  bottom: 0.75rem;
  display: flex;
  justify-content: center;
  pointer-events: none;
}
.af-log-follow :deep(.btn) {
  pointer-events: auto;
  /* a button's font, not the log's */
  font-family: var(--bs-body-font-family);
  background-color: var(--bs-body-bg);
  box-shadow: var(--bs-box-shadow-sm);
}
/* The viewport is filled by `af-fill-page` (the card body is the scrolling
   area), so the log itself only has to keep long lines from widening the page. */
#scroller {
  overflow-wrap: anywhere;
  /* the line numbers' grey column from the card's left border, and the lines from its top
     and bottom : the card body's padding taken back */
  margin: calc(-1 * var(--bs-card-spacer-y)) 0 calc(-1 * var(--bs-card-spacer-y)) calc(-1 * var(--bs-card-spacer-x));
}
</style>
<route lang="yaml">
meta:
  layout: standard
</route>
