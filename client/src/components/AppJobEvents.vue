<script setup>
/******************************************************************/
/*                                                                */
/*  AppJobEvents : a playbook job's structured events (the        */
/*  af_events callback plugin, job_events) in a panel over its    */
/*  output - the recap per host, a grid of hosts by tasks (each   */
/*  cell its result's colour, its message and time on hover) and  */
/*  a timeline of the tasks. Read again every few seconds while   */
/*  the job runs. The text output stays as it is.                 */
/*                                                                */
/*  @props:                                                       */
/*      events: Array - the job's events (GET /job/:id/events)    */
/*  @emits:                                                       */
/*      close                                                     */
/*                                                                */
/******************************************************************/
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  events: { type: Array, default: () => [] },
});
const emit = defineEmits(['close']);
const { t } = useI18n();

// what is shown : the recap and the grid, or the timeline
const view = ref('grid');

// a host's result, worst first : the one a cell shows when a task ran several times (a loop)
const RANK = { failed: 5, unreachable: 4, changed: 3, ok: 2, skipped: 1 };
const RESULTS = Object.keys(RANK);

// ─── the tasks and the hosts ──────────────────────────────────────────────────

const tasks = computed(() => {
  const list = [];
  let current = null;
  for (const e of props.events) {
    if (e.type === 'task') {
      current = {
        key: e.order,
        play: e.play || '',
        name: e.task || '',
        results: {},
        durations: {},
        ignored: new Set(),
      };
      list.push(current);
    } else if (current && RESULTS.includes(e.type) && e.host) {
      const prev = current.results[e.host];
      if (!prev || RANK[e.type] >= RANK[prev.type]) current.results[e.host] = e;
      current.durations[e.host] = (current.durations[e.host] || 0) + (Number(e.duration) || 0);
    } else if (current && e.type === 'ignored' && e.host) {
      current.ignored.add(e.host);
    }
  }
  return list;
});

const hosts = computed(() => {
  const seen = [];
  for (const task of tasks.value) for (const h of Object.keys(task.results)) if (!seen.includes(h)) seen.push(h);
  return seen;
});

// the plays, each with the tasks under it, in order
const plays = computed(() => {
  const out = [];
  for (const task of tasks.value) {
    const last = out[out.length - 1];
    if (last && last.name === task.play) last.tasks.push(task);
    else out.push({ name: task.play, tasks: [task] });
  }
  return out;
});

// ─── the recap ────────────────────────────────────────────────────────────────

const RECAP = ['ok', 'changed', 'failures', 'unreachable', 'skipped', 'rescued', 'ignored'];
const recap = computed(() => {
  const stats = [...props.events].reverse().find((e) => e.type === 'stats');
  if (stats?.data) return Object.entries(stats.data).map(([host, counts]) => ({ host, ...counts }));
  // still running : counted from the results so far
  return hosts.value.map((host) => {
    const row = { host, ok: 0, changed: 0, failures: 0, unreachable: 0, skipped: 0, rescued: 0, ignored: 0 };
    for (const task of tasks.value) {
      const r = task.results[host];
      if (!r) continue;
      if (r.type === 'failed') row[task.ignored.has(host) ? 'ignored' : 'failures']++;
      else if (r.type === 'changed') {
        row.changed++;
        row.ok++;
      } else row[r.type === 'ok' ? 'ok' : r.type]++;
    }
    return row;
  });
});

// ─── a cell ───────────────────────────────────────────────────────────────────

/**
 * What hovering a cell says : the host, the result, its time, and its message.
 *
 * Args:
 *   task (object): the task.
 *   host (string): the host.
 *
 * Returns:
 *   string
 */
function cellTitle(task, host) {
  const r = task.results[host];
  if (!r) return `${host} · ${task.name}: ${t('jobs.events.notRun')}`;
  const parts = [`${host} · ${task.name}`, t(`jobs.events.result_${r.type}`)];
  if (task.durations[host]) parts.push(t('jobs.events.seconds', { n: task.durations[host].toFixed(1) }));
  const msg = r.data?.msg || r.data?.stderr || r.data?.skip_reason;
  if (msg) parts.push(String(typeof msg === 'string' ? msg : JSON.stringify(msg)).slice(0, 300));
  return parts.join('\n');
}

// ─── the timeline ─────────────────────────────────────────────────────────────

// each task's time : the longest host's (they run side by side)
const longest = (task) => Math.max(0, ...Object.values(task.durations));
const slowest = computed(() => Math.max(0.001, ...tasks.value.map(longest)));
const total = computed(() => tasks.value.reduce((sum, task) => sum + longest(task), 0));
</script>

<template>
  <div class="af-output-data af-job-events">
    <div class="af-data-head">
      <span class="af-data-title"
        ><FaIcon icon="table-cells" /> {{ t('jobs.events.title') }}
        <span class="af-output-count">{{
          t('jobs.events.counts', { hosts: hosts.length, tasks: tasks.length })
        }}</span></span
      >
      <div class="af-data-tools">
        <div class="af-segmented" role="group">
          <button type="button" class="af-tool-btn" :class="{ active: view === 'grid' }" @click="view = 'grid'">
            <FaIcon icon="table-cells" />{{ t('jobs.events.grid') }}
          </button>
          <button type="button" class="af-tool-btn" :class="{ active: view === 'timeline' }" @click="view = 'timeline'">
            <FaIcon icon="chart-gantt" />{{ t('jobs.events.timeline') }}
          </button>
        </div>
        <button type="button" class="af-tool-btn af-tool-icon" :aria-label="t('common.close')" @click="emit('close')">
          <FaIcon icon="xmark" />
        </button>
      </div>
    </div>
    <div class="af-data-body af-events-body">
      <template v-if="view === 'grid'">
        <!-- the recap : per host, as ansible's PLAY RECAP -->
        <div class="af-table-frame mb-3">
          <table class="table af-table af-events-recap mb-0">
            <thead>
              <tr>
                <th>{{ t('jobs.events.host') }}</th>
                <th v-for="k in RECAP" :key="k" class="text-end">{{ t(`jobs.events.recap_${k}`) }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in recap" :key="row.host">
                <td class="font-monospace">{{ row.host }}</td>
                <td v-for="k in RECAP" :key="k" class="text-end" :class="{ [`af-recap-${k}`]: row[k] > 0 }">
                  {{ row[k] || 0 }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- hosts by tasks : a cell per host and task, its result's colour -->
        <div class="af-events-grid-wrap">
          <table class="af-events-grid">
            <thead>
              <tr>
                <th class="af-events-task-head">{{ t('jobs.events.task') }}</th>
                <th v-for="h in hosts" :key="h" class="af-events-host" :title="h">
                  <span>{{ h }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-for="play in plays" :key="play.name + play.tasks[0].key">
                <tr class="af-events-play">
                  <td :colspan="hosts.length + 1"><FaIcon icon="play" class="me-1" />{{ play.name }}</td>
                </tr>
                <tr v-for="task in play.tasks" :key="task.key">
                  <td class="af-events-task" :title="task.name">{{ task.name }}</td>
                  <td v-for="h in hosts" :key="h" class="text-center">
                    <span
                      class="af-events-cell"
                      :class="task.results[h] ? `af-cell-${task.results[h].type}` : 'af-cell-none'"
                      :title="cellTitle(task, h)"
                    ></span>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <!-- what the colours say -->
        <div class="af-events-legend">
          <span v-for="r in RESULTS" :key="r"
            ><span class="af-events-cell" :class="`af-cell-${r}`"></span>{{ t(`jobs.events.result_${r}`) }}</span
          >
          <span><span class="af-events-cell af-cell-none"></span>{{ t('jobs.events.notRun') }}</span>
        </div>
      </template>
      <!-- the timeline : each task's time, the longest host's, as a bar -->
      <template v-else>
        <div class="af-events-total">{{ t('jobs.events.total', { n: total.toFixed(1) }) }}</div>
        <div v-for="task in tasks" :key="task.key" class="af-timeline-row">
          <span class="af-timeline-name" :title="task.name">{{ task.name }}</span>
          <span class="af-timeline-track">
            <span
              class="af-timeline-bar"
              :style="{ width: Math.max(0.5, (longest(task) / slowest) * 100) + '%' }"
            ></span>
          </span>
          <span class="af-timeline-time">{{ t('jobs.events.seconds', { n: longest(task).toFixed(1) }) }}</span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.af-events-body {
  max-height: 32rem;
  overflow: auto;
  /* the panel's own text in the app's font ; the hosts stay monospace */
  font-family: var(--bs-body-font-family);
}
.af-events-recap td,
.af-events-recap th {
  white-space: nowrap;
}
/* a count above zero : its result's colour */
.af-recap-changed {
  color: var(--bs-warning-text-emphasis);
  font-weight: 600;
}
.af-recap-failures,
.af-recap-unreachable {
  color: var(--bs-danger-text-emphasis);
  font-weight: 600;
}
.af-recap-ok {
  color: var(--bs-success-text-emphasis);
}
.af-events-grid-wrap {
  overflow-x: auto;
}
.af-events-grid {
  border-collapse: separate;
  border-spacing: 2px;
  font-size: 0.8125rem;
}
.af-events-task-head,
.af-events-task {
  text-align: left;
  max-width: 22rem;
  min-width: 12rem;
  padding-right: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* the hosts' names, upright when few, slanted when many would not fit */
.af-events-host {
  font-weight: 500;
  font-size: 0.75rem;
  max-width: 7rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 0.25rem;
}
.af-events-play td {
  padding-top: 0.5rem;
  font-weight: 600;
  color: var(--bs-secondary-color);
}
.af-events-cell {
  display: inline-block;
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 3px;
  vertical-align: middle;
}
/* the results' colours : ansible's own (green ok, amber changed, red failed, cyan skipped) */
.af-cell-ok {
  background: #2e7d32;
}
.af-cell-changed {
  background: #f9a825;
}
.af-cell-failed {
  background: #c62828;
}
.af-cell-unreachable {
  background: #6a1b9a;
}
.af-cell-skipped {
  background: #26a69a;
}
.af-cell-none {
  background: var(--bs-tertiary-bg);
  border: 1px solid var(--bs-border-color);
}
.af-events-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 0.75rem;
  font-size: 0.8125rem;
  color: var(--bs-secondary-color);
}
.af-events-legend .af-events-cell {
  width: 0.85rem;
  height: 0.85rem;
  margin-right: 0.35rem;
}
.af-events-total {
  font-size: 0.8125rem;
  color: var(--bs-secondary-color);
  margin-bottom: 0.5rem;
}
.af-timeline-row {
  display: grid;
  grid-template-columns: minmax(10rem, 22rem) 1fr 5rem;
  gap: 0.75rem;
  align-items: center;
  font-size: 0.8125rem;
  padding: 0.15rem 0;
}
.af-timeline-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.af-timeline-track {
  background: var(--bs-tertiary-bg);
  border-radius: 3px;
  height: 0.75rem;
}
.af-timeline-bar {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--bs-primary);
}
.af-timeline-time {
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--bs-secondary-color);
}
</style>
