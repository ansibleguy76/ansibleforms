<script setup>
/******************************************************************/
/*                                                                */
/*  A host's result of a task, as AWX shows it : a line of the    */
/*  output clicked (AppAnsibleOutput) opens it. Its status, host, */
/*  play, task, module, item, when it started and how long it     */
/*  took ; its message ; its whole result as JSON ; its standard  */
/*  output and error when it has them. Read from the job's events */
/*  (the af_events callback plugin), masked as the output.        */
/*                                                                */
/*  @props:                                                       */
/*      jobId: Number|String - the job                            */
/*      order: Number - the event's place among the job's events  */
/*                                                                */
/*  @emits:                                                       */
/*      close                                                     */
/*                                                                */
/******************************************************************/
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';
import Helpers from '@/lib/Helpers';
import Time from '@/lib/Time';
import YAML from 'yaml';
import { hljs } from '@/lib/Highlight';
import { jobLogLines } from '@/lib/jobLog';

const { t } = useI18n();

const props = defineProps({
  jobId: { type: [Number, String], required: true },
  order: { type: Number, required: true },
});
const emit = defineEmits(['close']);

const event = ref(null);
const failed = ref('');
const tab = ref('details');

onMounted(async () => {
  try {
    const res = await axios.get(`/api/v2/job/${encodeURIComponent(props.jobId)}/events/${props.order}`);
    event.value = res.data;
  } catch (err) {
    failed.value = Helpers.parseAxiosResponseError(err, t('jobs.taskResult.failed'));
  }
});

// its status : a host's result type, or a loop item's own
const status = computed(() => (event.value?.type === 'item' ? event.value?.data?.status : event.value?.type) || '');
// each status its pill's colour (the hosts and tasks panel's)
const PILLS = {
  ok: 'af-pill-green',
  changed: 'af-pill-amber',
  failed: 'af-pill-red',
  unreachable: 'af-pill-red',
  skipped: 'af-pill-blue',
};

const result = computed(() => event.value?.result || null);
// its standard output and error : a text, or its lines
const text = (value, lines) => (typeof value === 'string' && value) || (Array.isArray(lines) ? lines.join('\n') : '');
const stdout = computed(() => text(result.value?.stdout, result.value?.stdout_lines));
const stderr = computed(() => text(result.value?.stderr, result.value?.stderr_lines));
const message = computed(() => result.value?.msg ?? event.value?.data?.msg ?? '');

// the facts, label and value, those it has
const facts = computed(() => {
  const e = event.value;
  if (!e) return [];
  const start = e.data?.start ? Time.format(new Date(e.data.start * 1000).toISOString()) : '';
  return [
    [t('jobs.taskResult.host'), e.host],
    [t('jobs.taskResult.play'), e.play],
    [t('jobs.taskResult.task'), e.task],
    [t('jobs.taskResult.module'), e.data?.action || e.taskData?.action],
    [t('jobs.taskResult.item'), e.data?.item],
    [t('jobs.taskResult.started'), start],
    [
      t('jobs.taskResult.duration'),
      e.duration === null || e.duration === undefined ? '' : t('jobs.events.seconds', { n: e.duration }),
    ],
    [t('jobs.taskResult.rc'), result.value?.rc ?? e.data?.rc],
  ].filter(([, v]) => v !== undefined && v !== null && v !== '');
});

const tabs = computed(() =>
  [
    { key: 'details', label: t('jobs.taskResult.details') },
    { key: 'json', label: 'JSON', when: !!result.value },
    { key: 'yaml', label: 'YAML', when: !!result.value },
    { key: 'stdout', label: t('jobs.taskResult.stdout'), when: !!stdout.value },
    { key: 'stderr', label: t('jobs.taskResult.stderr'), when: !!stderr.value },
  ].filter((x) => x.when !== false),
);
const json = computed(() => (result.value ? JSON.stringify(result.value, null, 2) : ''));
// the same result as YAML, as a playbook writes its variables
const yaml = computed(() => (result.value ? YAML.stringify(result.value) : ''));

// each code tab coloured : JSON and YAML by highlight.js (escaped by it), the outputs as the
// job's log file (their ANSI colours, a log line's level), all in the theme's colours
const highlighted = (code, language) => (code ? hljs.highlight(code, { language }).value : '');

/**
 * Highlighted HTML as its lines, each well formed : a span open at a line's end (a YAML block
 * text, a long string) is closed there and opened again on the next line.
 *
 * Args:
 *   html (string): the HTML, its text escaped, only spans as tags.
 *
 * Returns:
 *   string[]: each line's HTML ; a last empty line left out.
 */
function htmlLines(html) {
  const lines = [];
  const open = [];
  let line = '';
  for (const part of html.split(/(<span[^>]*>|<\/span>|\n)/)) {
    if (part === '\n') {
      lines.push(line + '</span>'.repeat(open.length));
      line = open.join('');
    } else {
      if (part.startsWith('<span')) open.push(part);
      else if (part === '</span>') open.pop();
      line += part;
    }
  }
  if (line.replace(/<[^>]*>/g, '') !== '' || !lines.length) lines.push(line);
  return lines;
}
const jsonLines = computed(() => htmlLines(highlighted(json.value, 'json')));
const yamlLines = computed(() => htmlLines(highlighted(yaml.value, 'yaml')));
const outputLines = (value) => jobLogLines(value).map((line) => line.html);
// the tab shown its lines, numbered as the server log's
const codeLines = computed(
  () =>
    ({
      json: jsonLines.value,
      yaml: yamlLines.value,
      stdout: outputLines(stdout.value),
      stderr: outputLines(stderr.value),
    })[tab.value] || [],
);
</script>
<template>
  <BsModal size="lg" icon="circle-info" @close="emit('close')">
    <template #title>{{ t('jobs.taskResult.title') }}</template>
    <template #default>
      <div v-if="failed" class="alert alert-danger mb-0">{{ failed }}</div>
      <AppSkeleton v-else-if="!event" shape="form" :count="4" />
      <template v-else>
        <div class="d-flex align-items-center gap-2 mb-3">
          <span v-if="status" class="badge rounded-pill fw-semibold af-pill" :class="PILLS[status] || 'af-pill-grey'"
            ><span class="af-pill-label">{{ t(`jobs.events.result_${status}`) }}</span></span
          >
          <span class="fw-semibold text-break">{{ event.host }}</span>
          <span class="text-body-secondary text-break">{{ event.task }}</span>
        </div>
        <!-- the tabs open into their card, as a record page's (bootstrap-override.scss, .tab-card-flush-card) -->
        <ul class="nav nav-tabs mb-0">
          <li v-for="x in tabs" :key="x.key" class="nav-item">
            <a class="nav-link" :class="{ active: tab === x.key }" href="#" @click.prevent="tab = x.key">{{
              x.label
            }}</a>
          </li>
        </ul>
        <div class="card tab-card-flush-card">
          <!-- a code tab (JSON, YAML, its output) : the grey text fills the card, edge to edge -->
          <div class="card-body" :class="{ 'af-result-code': tab !== 'details' }">
            <template v-if="tab === 'details'">
              <dl class="af-result-facts">
                <template v-for="[label, value] in facts" :key="label">
                  <dt>{{ label }}</dt>
                  <dd>{{ value }}</dd>
                </template>
              </dl>
              <template v-if="message">
                <div class="af-result-label">{{ t('jobs.taskResult.message') }}</div>
                <pre class="af-result-pre">{{
                  typeof message === 'string' ? message : JSON.stringify(message, null, 2)
                }}</pre>
              </template>
            </template>
            <!-- a code tab : each line its number in the server log's grey column, a long line
                 wrapping under its own start -->
            <div v-else class="af-result-pre af-result-lines" :class="{ 'af-result-ansi': tab.startsWith('std') }">
              <div v-for="(line, i) in codeLines" :key="i" class="af-result-line">
                <span class="af-result-no">{{ i + 1 }}</span>
                <!-- eslint-disable-next-line vue/no-v-html -- escaped : highlight.js and jobLogLines escape the text -->
                <span class="af-result-text" v-html="line"></span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </template>
  </BsModal>
</template>
<style scoped lang="scss">
/* the facts : label and value, as the job page's (small, upper case, quiet labels) */
.af-result-facts {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  /* each label on its value's line : both on the text's baseline */
  align-items: baseline;
  gap: 0.4rem 1.5rem;
  margin: 0 0 1rem;
  &:last-child {
    margin-bottom: 0;
  }
  dt {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--bs-secondary-color);
  }
  dd {
    margin: 0;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
}
.af-result-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--bs-secondary-color);
  margin-bottom: 0.25rem;
}
/* the card the tabs open into : its top corners square, its top border one straight line under the tabs */
.tab-card-flush-card {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}
/* a code tab : no padding, its grey text the card's whole inside, its bottom corners the card's */
.af-result-code {
  padding: 0 !important;
  .af-result-pre {
    border-radius: 0 0 calc(var(--bs-border-radius) - 1px) calc(var(--bs-border-radius) - 1px);
  }
}
/* a result's text : the output's monospace, scrolling in the dialog rather than stretching it */
.af-result-pre {
  max-height: 55vh;
  overflow: auto;
  margin: 0;
  padding: 0.75rem;
  border-radius: 0.375rem;
  background: var(--bs-tertiary-bg);
  font-size: 0.8125rem;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
/* the numbered lines : the gutter's grey the whole height, as the server log's and the output's */
.af-result-lines {
  padding: 0.5rem 0;
  font-family: var(--bs-font-monospace);
  background: linear-gradient(
    to right,
    var(--af-output-gutter-bg) 3rem,
    var(--af-field-border) 3rem,
    var(--af-field-border) calc(3rem + 1px),
    var(--bs-tertiary-bg) calc(3rem + 1px)
  );
  .af-result-line {
    display: flex;
    align-items: flex-start;
  }
  .af-result-no {
    flex: 0 0 3rem;
    padding-right: 0.5rem;
    text-align: right;
    color: var(--bs-tertiary-color);
    user-select: none;
  }
  .af-result-text {
    flex: 1 1 auto;
    min-width: 0;
    padding: 0 0.75rem;
  }
}
/* an output's colours : the job output's (AppAnsibleOutput), readable in light and dark */
.af-result-ansi {
  :deep(.has-text-danger) {
    color: var(--af-ansible-output-danger);
  }
  :deep(.has-text-success) {
    color: var(--af-ansible-output-text-success);
  }
  :deep(.has-text-warning) {
    color: var(--af-ansible-output-text-warning);
  }
  :deep(.has-text-info) {
    color: var(--af-ansible-output-text-info);
  }
  :deep(.has-text-purple) {
    color: var(--af-ansible-output-text-purple);
  }
  :deep(.has-text-muted),
  :deep(.af-log-time) {
    color: var(--bs-secondary-color);
  }
  :deep(.has-text-weight-bold) {
    font-weight: 700;
  }
}
</style>
