<script setup>
/******************************************************************/
/*                                                                */
/*  A workflow file as its graph : the workflow chosen drawn as   */
/*  AWX's visualizer draws it (START, a column per step, the      */
/*  links green on success, red on failure, blue always), its     */
/*  job templates under it. A click on a node, a link or a job    */
/*  template edits it in the panel on the right ; every edit is   */
/*  made on the file's own text (config/workflowFile.js), so its  */
/*  comments and the rest stay (saved with the designer's Save).  */
/*                                                                */
/*  @props:                                                       */
/*      modelValue: String - the file's YAML (the AWX export      */
/*         syntax : job_templates, workflow_job_templates)        */
/*      readOnly: Boolean - shown, not editable                   */
/*  @emits:                                                       */
/*      update:modelValue - the file, changed                     */
/*      reveal: the line to open the YAML on                      */
/*                                                                */
/******************************************************************/
import { ref, computed, watch, onMounted } from 'vue';
import axios from 'axios';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';
import {
  NODE_TYPES,
  LINK_KINDS,
  GRAPH,
  workflowFileOf,
  workflowProblems,
  workflowGraph,
  editWorkflow,
  editRemoveWorkflow,
  editAddNode,
  editNode,
  editRemoveNode,
  editLink,
  editUnlink,
} from '@/config/workflowFile';

const props = defineProps({
  modelValue: { type: String, default: '' },
  readOnly: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'reveal']);
const { t } = useI18n();

// ─── the file ─────────────────────────────────────────────────────────────────
const file = computed(() => workflowFileOf(props.modelValue));
const workflows = computed(() => file.value.workflows || []);
// the workflow shown : its place in the file
const wfIndex = ref(0);
watch(workflows, (list) => {
  if (wfIndex.value >= list.length) wfIndex.value = Math.max(0, list.length - 1);
});
const workflow = computed(() => workflows.value[wfIndex.value] || null);
// every workflow of the file, each its graph : one under the other (an AWX export may hold several)
const graphs = computed(() => workflows.value.map((w) => workflowGraph(w.nodes)));
const graph = computed(() => graphs.value[wfIndex.value] || workflowGraph([]));

/**
 * Applies an edit : the file as the edit leaves it, or the edit's error.
 *
 * Args:
 *   fn (function): the edit, given the file's text, answering the new text (or { text }).
 *
 * Returns:
 *   any: what the edit answered (its text and what else it says), null when it failed.
 */
function apply(fn) {
  if (props.readOnly) return null;
  try {
    const out = fn(props.modelValue);
    emit('update:modelValue', typeof out === 'string' ? out : out.text);
    return out;
  } catch (err) {
    toast.error(err.message);
    return null;
  }
}

// ─── what the instance has : the names a job template, a node may use ─────────
// null : unknown (the list needs a permission the user lacks) - then nothing is checked
const refs = ref({ playbooks: null, inventories: null, credentials: null, repositories: null });
/**
 * Reads a list the panel offers, null when it cannot.
 *
 * Args:
 *   url (string): the api.
 *   pick (function): the names, from its answer.
 *
 * Returns:
 *   Promise<string[]|null>: the names.
 */
async function names(url, pick) {
  try {
    return pick((await axios.get(url)).data);
  } catch {
    return null;
  }
}
onMounted(async () => {
  const [playbooks, inventories, credentials, repositories] = await Promise.all([
    names('/api/v2/files/playbooks', (d) => (d?.files || []).map((f) => f.path).filter((p) => /\.ya?ml$/i.test(p))),
    names('/api/v2/files/inventories', (d) => [
      ...new Set(
        (d?.files || [])
          .map((f) => String(f.path).split('/'))
          .filter((p) => p.length === 2 && /^(inventory|hosts)\.ya?ml$/i.test(p[1]))
          .map((p) => p[0]),
      ),
    ]),
    names('/api/v2/credential/', (d) => (d?.records || d || []).map((c) => c?.name).filter(Boolean)),
    names('/api/v2/repository/', (d) => (d?.records || d || []).map((r) => r?.name).filter(Boolean)),
  ]);
  refs.value = { playbooks, inventories, credentials, repositories };
});
const sorted = (list) => [...(list || [])].sort((a, b) => a.localeCompare(b));

// what is wrong, each with its line ; a node with a problem is drawn red
const problems = computed(() => workflowProblems(file.value, refs.value));
const badNodes = computed(() => new Set(problems.value.map((p) => p.values?.identifier).filter(Boolean)));

// ─── what is selected : a node, a link, a job template, or the workflow ───────
const selected = ref(null); // { type : 'node', id } | { type : 'link', from, to }
const node = computed(() =>
  selected.value?.type === 'node'
    ? workflow.value?.nodes.find((n) => n.identifier === selected.value.id) || null
    : null,
);
const link = computed(() =>
  selected.value?.type === 'link'
    ? graph.value.links.find((l) => l.from === selected.value.from && l.to === selected.value.to) || null
    : null,
);

// ─── the workflows ────────────────────────────────────────────────────────────
/**
 * Sets a workflow's name or description.
 *
 * Args:
 *   i (number): the workflow's place.
 *   key (string): 'name' or 'description'.
 *   value (string): the value.
 */
function setWorkflowAt(i, key, value) {
  apply((text) => editWorkflow(text, i, key, value));
}
/**
 * Removes a workflow of the file (one of several).
 *
 * Args:
 *   i (number): the workflow's place.
 */
function removeWorkflowAt(i) {
  apply((text) => editRemoveWorkflow(text, i));
  wfIndex.value = 0;
  selected.value = null;
}

// ─── the nodes ────────────────────────────────────────────────────────────────
// what a node runs, as the panel says it
const TYPE_ICONS = {
  job_template: 'rocket',
  workflow_job_template: 'diagram-project',
  workflow_approval_template: 'user-check',
  project: 'code-branch',
};
const TYPE_COLORS = {
  job_template: 'var(--bs-primary)',
  workflow_job_template: 'var(--bs-info)',
  workflow_approval_template: 'var(--bs-warning)',
  project: 'var(--bs-secondary)',
};
const LINK_COLORS = {
  success: 'var(--bs-success)',
  failure: 'var(--bs-danger)',
  always: 'var(--bs-info)',
  start: 'var(--bs-secondary)',
};

/**
 * Adds a node running the first job template (or nothing yet), after a node when one is
 * given, and selects it.
 *
 * Args:
 *   from (object): { identifier, kind } : the node it runs after (optional : a first step).
 */
function addNode(from = null) {
  const out = apply((text) =>
    editAddNode(text, wfIndex.value, { identifier: 'node', type: 'job_template', name: '' }, from),
  );
  if (out) selected.value = { type: 'node', id: out.identifier };
}
/**
 * Changes the selected node.
 *
 * Args:
 *   key (string): 'identifier', 'type', 'name', 'timeout' or 'converge'.
 *   value (any): the value.
 */
function setNode(key, value) {
  const id = node.value.identifier;
  if (key === 'identifier') {
    const v = String(value || '').trim();
    if (!v || v === id) return;
    if (!/^[A-Za-z0-9_.:-]+$/.test(v)) return toast.error(t('workflowEditor.badIdentifier'));
    if (workflow.value.nodes.some((n) => n.identifier === v))
      return toast.error(t('workflowEditor.identifierTaken', { identifier: v }));
    if (apply((text) => editNode(text, wfIndex.value, id, 'identifier', v))) selected.value = { type: 'node', id: v };
    return;
  }
  apply((text) => editNode(text, wfIndex.value, id, key, value));
}
function removeNode() {
  apply((text) => editRemoveNode(text, wfIndex.value, node.value.identifier));
  selected.value = null;
}
// the node a new link goes to, and on what
const linkTo = ref('');
const linkKind = ref('success');
watch(node, () => {
  linkTo.value = '';
  linkKind.value = 'success';
});
const linkTargets = computed(() =>
  node.value ? workflow.value.nodes.filter((n) => n.identifier !== node.value.identifier).map((n) => n.identifier) : [],
);
function addLink() {
  if (!linkTo.value) return;
  apply((text) => editLink(text, wfIndex.value, node.value.identifier, linkTo.value, linkKind.value));
  linkTo.value = '';
}
// the names a node may run, by what it runs
const runChoices = computed(() => {
  const type = node.value?.type;
  // a job template node runs one of the designer's playbooks
  if (type === 'job_template') return refs.value.playbooks ? sorted(refs.value.playbooks) : null;
  if (type === 'workflow_job_template')
    return workflows.value.map((w) => w.name).filter((n) => n && n !== workflow.value?.name);
  if (type === 'project') return sorted(refs.value.repositories);
  return null;
});

// ─── a link ───────────────────────────────────────────────────────────────────
function setLinkKind(kind) {
  const { from, to } = selected.value;
  apply((text) => editLink(text, wfIndex.value, from, to, kind));
}
function removeLink() {
  const { from, to } = selected.value;
  apply((text) => editUnlink(text, wfIndex.value, from, to));
  selected.value = null;
}

// ─── a playbook's run : what a job template node sets ─────────────────────────
function toggleCredential(name, on) {
  const now = node.value.credentials || [];
  setNode('credentials', on ? [...now, name] : now.filter((c) => c !== name));
}
// a name the file uses that the instance lacks : still offered, so the field shows it
const withCurrent = (list, current) => (current && list && !list.includes(current) ? [current, ...list] : list || []);

// ─── the graph's pieces ───────────────────────────────────────────────────────
function truncate(s, len = 22) {
  return s && s.length > len ? s.slice(0, len - 1) + '…' : s;
}
// a node or a link is the selected one only in the workflow selected
const isSelectedNode = (i, n) =>
  wfIndex.value === i && selected.value?.type === 'node' && selected.value.id === n.identifier;
const isSelectedLink = (i, l) =>
  wfIndex.value === i &&
  selected.value?.type === 'link' &&
  selected.value.from === l.from &&
  selected.value.to === l.to;
/**
 * Selects a node, a link or the workflow itself, in the workflow it is in.
 *
 * Args:
 *   i (number): the workflow's place.
 *   what (object|null): { type : 'node', id } | { type : 'link', from, to } ; null : the workflow.
 */
function select(i, what) {
  wfIndex.value = i;
  selected.value = what;
}
function selectLink(i, l) {
  if (l.kind !== 'start') select(i, { type: 'link', from: l.from, to: l.to });
}
/**
 * START of a workflow : a first node added there.
 *
 * Args:
 *   i (number): the workflow's place.
 */
function startAt(i) {
  if (props.readOnly) return;
  wfIndex.value = i;
  addNode();
}
</script>
<template>
  <div class="af-wf">
    <!-- the YAML is not a workflow file : what is wrong, and where -->
    <div v-if="file.kind === 'invalid'" class="alert alert-warning d-flex align-items-center gap-2">
      <FaIcon icon="triangle-exclamation" />
      <span class="flex-grow-1">{{ t('designer.files.visualInvalid', { error: file.error }) }}</span>
      <BsButton icon="code" @click="emit('reveal', file.line)">{{ t('designer.files.showInYaml') }}</BsButton>
    </div>
    <template v-else>
      <!-- what AWX would refuse, or the instance lacks : each opens the YAML on its line -->
      <div v-if="problems.length" class="af-wf-problems">
        <div v-for="(p, i) in problems" :key="i" class="af-wf-problem">
          <FaIcon icon="triangle-exclamation" class="text-warning" />
          <span class="flex-grow-1">{{ t(`workflowEditor.problems.${p.key}`, p.values) }}</span>
          <a v-if="p.line" href="#" @click.prevent="emit('reveal', p.line)">{{
            t('workflowEditor.line', { line: p.line })
          }}</a>
        </div>
      </div>

      <!-- each workflow : its name and description, then its graph -->
      <div v-if="!workflows.length" class="af-wf-canvas af-wf-none text-muted">
        <FaIcon icon="diagram-project" class="mb-2 af-wf-none-icon" />
        <span>{{ t('workflowEditor.noWorkflowHint') }}</span>
      </div>
      <div v-for="(w, wi) in workflows" :key="wi" class="af-wf-block">
        <div class="row g-3 mb-3 align-items-end">
          <div class="col-md-4">
            <label class="form-label fw-bold">{{ t('workflowEditor.name') }}</label>
            <div class="input-group">
              <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="diagram-project" /></span>
              <input
                class="form-control"
                :class="{ 'is-invalid': !w.name }"
                :value="w.name"
                :disabled="readOnly"
                spellcheck="false"
                @change="setWorkflowAt(wi, 'name', $event.target.value.trim())"
              />
            </div>
          </div>
          <div class="col">
            <label class="form-label fw-bold">{{ t('workflowEditor.description') }}</label>
            <div class="input-group">
              <span class="input-group-text text-gray-500"><FaIcon :fixedwidth="true" icon="align-left" /></span>
              <input
                class="form-control"
                :value="w.description"
                :disabled="readOnly"
                @change="setWorkflowAt(wi, 'description', $event.target.value)"
              />
            </div>
          </div>
          <!-- one of several in the file (an AWX export) : it may go -->
          <div v-if="!readOnly && workflows.length > 1" class="col-auto">
            <BsButton
              icon="trash"
              :isIconButton="true"
              :title="t('workflowEditor.removeWorkflow')"
              @click="removeWorkflowAt(wi)"
            />
          </div>
        </div>
        <div class="af-wf-canvas">
          <!-- the links' colours, in the graph's corner -->
          <div class="af-wf-legends">
            <span class="af-wf-legend"
              ><span class="af-wf-line" :style="{ background: LINK_COLORS.success }"></span
              >{{ t('workflow.onSuccess') }}</span
            >
            <span class="af-wf-legend"
              ><span class="af-wf-line" :style="{ background: LINK_COLORS.failure }"></span
              >{{ t('workflow.onFailure') }}</span
            >
            <span class="af-wf-legend"
              ><span class="af-wf-line" :style="{ background: LINK_COLORS.always }"></span
              >{{ t('workflow.always') }}</span
            >
          </div>
          <svg :width="graphs[wi].width + 40" :height="graphs[wi].height" class="af-wf-svg">
            <path
              v-for="(l, i) in graphs[wi].links"
              :key="'l' + i"
              :d="l.d"
              fill="none"
              :stroke="LINK_COLORS[l.kind]"
              :stroke-width="isSelectedLink(wi, l) ? 4 : 2"
              :opacity="isSelectedLink(wi, l) ? 1 : 0.8"
            />
            <!-- a link's wide invisible twin : easy to click -->
            <path
              v-for="(l, i) in graphs[wi].links"
              :key="'h' + i"
              :d="l.d"
              fill="none"
              stroke="transparent"
              stroke-width="12"
              :class="{ 'af-wf-link': l.kind !== 'start' }"
              @click="selectLink(wi, l)"
            />
            <!-- START : a click adds a first step -->
            <g class="af-wf-start" :class="{ 'af-wf-clickable': !readOnly }" @click="startAt(wi)">
              <rect
                :x="graphs[wi].start.x"
                :y="graphs[wi].start.y"
                :width="GRAPH.startW"
                :height="GRAPH.startH"
                :rx="GRAPH.startH / 2"
              />
              <text
                :x="graphs[wi].start.x + GRAPH.startW / 2"
                :y="graphs[wi].start.y + GRAPH.startH / 2 + 4"
                text-anchor="middle"
              >
                START
              </text>
              <title>{{ t('workflowEditor.addFirst') }}</title>
            </g>
            <g
              v-for="n in graphs[wi].nodes"
              :key="n.identifier"
              class="af-wf-node"
              :class="{ 'af-wf-node-selected': isSelectedNode(wi, n) }"
              @click="select(wi, { type: 'node', id: n.identifier })"
            >
              <rect
                :x="n.x"
                :y="n.y"
                :width="GRAPH.nodeW"
                :height="GRAPH.nodeH"
                rx="6"
                class="af-wf-node-rect"
                :style="{
                  stroke: badNodes.has(n.identifier)
                    ? 'var(--bs-danger)'
                    : TYPE_COLORS[n.type] || 'var(--bs-secondary)',
                }"
                :stroke-dasharray="badNodes.has(n.identifier) ? '5 3' : null"
              />
              <rect
                :x="n.x"
                :y="n.y"
                width="5"
                :height="GRAPH.nodeH"
                rx="2"
                :style="{ fill: TYPE_COLORS[n.type] || 'var(--bs-secondary)' }"
              />
              <text :x="n.x + 14" :y="n.y + 22" class="af-wf-node-name">{{ truncate(n.name || '?') }}</text>
              <text :x="n.x + 14" :y="n.y + 41" class="af-wf-node-sub">
                {{ truncate(`${t(`workflowEditor.types.${n.type}`, n.type || '?')} · ${n.identifier}`, 30) }}
              </text>
              <title>{{ n.identifier }} : {{ n.name }}</title>
            </g>
          </svg>
        </div>
      </div>

      <!-- under the graphs : the panel for what is selected ; nothing selected, what to do -->
      <div v-if="workflows.length && !node && !link" class="form-text">{{ t('workflowEditor.selectHint') }}</div>
      <div v-if="node || link" class="af-wf-main">
        <!-- the panel : what is selected, else the workflow itself -->
        <div class="af-wf-panel">
          <!-- closes the panel : nothing selected -->
          <button
            type="button"
            class="btn-close af-wf-panel-close"
            :aria-label="t('common.close')"
            :title="t('common.close')"
            @click="selected = null"
          ></button>
          <!-- a node : its fields two by two, then its credentials (left) and what runs after it (right) -->
          <template v-if="node">
            <div class="af-wf-panel-title">
              <FaIcon :icon="TYPE_ICONS[node.type] || 'circle'" />{{ t('workflowEditor.node') }}
            </div>
            <div class="row g-3 mb-3">
              <div class="col-md-6">
                <label class="form-label fw-bold">{{ t('workflowEditor.identifier') }}</label>
                <input
                  class="form-control"
                  :value="node.identifier"
                  :disabled="readOnly"
                  spellcheck="false"
                  @change="setNode('identifier', $event.target.value)"
                />
              </div>
              <div class="col-md-6">
                <label class="form-label fw-bold">{{ t('workflowEditor.runs') }}</label>
                <select
                  class="form-select"
                  :value="node.type"
                  :disabled="readOnly"
                  @change="setNode('type', $event.target.value)"
                >
                  <option v-for="type in NODE_TYPES" :key="type" :value="type">
                    {{ t(`workflowEditor.types.${type}`) }}
                  </option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label fw-bold">{{
                  t(`workflowEditor.runName.${node.type}`, t('workflowEditor.name'))
                }}</label>
                <select
                  v-if="runChoices"
                  class="form-select"
                  :value="node.name"
                  :disabled="readOnly"
                  @change="setNode('name', $event.target.value)"
                >
                  <option value="">-</option>
                  <option v-for="c in withCurrent(runChoices, node.name)" :key="c" :value="c">{{ c }}</option>
                </select>
                <input
                  v-else
                  class="form-control"
                  :value="node.name"
                  :disabled="readOnly"
                  @change="setNode('name', $event.target.value)"
                />
              </div>
              <!-- an approval : how long it waits -->
              <div v-if="node.type === 'workflow_approval_template'" class="col-md-6">
                <label class="form-label fw-bold">{{ t('workflowEditor.timeout') }}</label>
                <input
                  class="form-control"
                  type="number"
                  min="0"
                  :value="node.timeout"
                  :disabled="readOnly"
                  @change="setNode('timeout', $event.target.value)"
                />
                <div class="form-text">{{ t('workflowEditor.timeoutHint') }}</div>
              </div>
              <!-- a playbook's run : what it uses -->
              <template v-if="node.type === 'job_template'">
                <div class="col-md-6">
                  <label class="form-label fw-bold">{{ t('workflowEditor.inventory') }}</label>
                  <select
                    v-if="refs.inventories"
                    class="form-select"
                    :value="node.inventory"
                    :disabled="readOnly"
                    @change="setNode('inventory', $event.target.value)"
                  >
                    <option value="">{{ t('designer.visualNoInventory') }}</option>
                    <option v-for="i in withCurrent(sorted(refs.inventories), node.inventory)" :key="i" :value="i">
                      {{ i }}
                    </option>
                  </select>
                  <input
                    v-else
                    class="form-control"
                    :value="node.inventory"
                    :disabled="readOnly"
                    @change="setNode('inventory', $event.target.value)"
                  />
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-bold">{{ t('workflowEditor.limit') }}</label>
                  <input
                    class="form-control"
                    :value="node.limit"
                    :disabled="readOnly"
                    @change="setNode('limit', $event.target.value)"
                  />
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-bold">{{ t('workflowEditor.jobTags') }}</label>
                  <input
                    class="form-control"
                    :value="node.job_tags"
                    :disabled="readOnly"
                    @change="setNode('job_tags', $event.target.value)"
                  />
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-bold">{{ t('workflowEditor.skipTags') }}</label>
                  <input
                    class="form-control"
                    :value="node.skip_tags"
                    :disabled="readOnly"
                    @change="setNode('skip_tags', $event.target.value)"
                  />
                </div>
                <div class="col-md-6">
                  <label class="form-label fw-bold">{{ t('workflowEditor.verbosity') }}</label>
                  <select
                    class="form-select"
                    :value="node.verbosity"
                    :disabled="readOnly"
                    @change="setNode('verbosity', $event.target.value)"
                  >
                    <option value="">0</option>
                    <option v-for="v in [1, 2, 3, 4, 5]" :key="v" :value="String(v)">{{ v }}</option>
                  </select>
                </div>
              </template>
            </div>
            <!-- the switches -->
            <div class="d-flex flex-wrap gap-4 mb-3">
              <div class="form-check form-switch">
                <input
                  :id="'converge-' + node.identifier"
                  class="form-check-input"
                  type="checkbox"
                  :checked="node.converge"
                  :disabled="readOnly"
                  @change="setNode('converge', $event.target.checked)"
                />
                <label class="form-check-label" :for="'converge-' + node.identifier">{{
                  t('workflowEditor.converge')
                }}</label>
              </div>
              <template v-if="node.type === 'job_template'">
                <div class="form-check form-switch">
                  <input
                    id="wf-check"
                    class="form-check-input"
                    type="checkbox"
                    :checked="node.job_type === 'check'"
                    :disabled="readOnly"
                    @change="setNode('job_type', $event.target.checked ? 'check' : '')"
                  />
                  <label class="form-check-label" for="wf-check">{{ t('workflowEditor.check') }}</label>
                </div>
                <div class="form-check form-switch">
                  <input
                    id="wf-diff"
                    class="form-check-input"
                    type="checkbox"
                    :checked="node.diff_mode === 'true'"
                    :disabled="readOnly"
                    @change="setNode('diff_mode', $event.target.checked)"
                  />
                  <label class="form-check-label" for="wf-diff">{{ t('workflowEditor.diff') }}</label>
                </div>
              </template>
            </div>
            <div class="row g-3">
              <!-- a playbook's credentials : every one, none hidden -->
              <div v-if="node.type === 'job_template'" class="col-md-6">
                <label class="form-label fw-bold">{{ t('workflowEditor.credentials') }}</label>
                <div v-if="!(refs.credentials || []).length && !node.credentials.length" class="text-muted small">
                  {{ t('workflowEditor.noCredentials') }}
                </div>
                <div
                  v-for="c in withCurrent(sorted(refs.credentials), null).concat(
                    node.credentials.filter((x) => !(refs.credentials || []).includes(x)),
                  )"
                  :key="c"
                  class="form-check"
                >
                  <input
                    :id="'wf-cred-' + c"
                    class="form-check-input"
                    type="checkbox"
                    :checked="node.credentials.includes(c)"
                    :disabled="readOnly"
                    @change="toggleCredential(c, $event.target.checked)"
                  />
                  <label class="form-check-label" :for="'wf-cred-' + c">{{ c }}</label>
                </div>
              </div>
              <!-- what runs after it -->
              <div class="col-md-6">
                <label class="form-label fw-bold">{{ t('workflowEditor.next') }}</label>
                <div v-for="kind in LINK_KINDS" :key="kind">
                  <div v-for="to in node[kind]" :key="kind + to" class="af-wf-out">
                    <span class="af-wf-line" :style="{ background: LINK_COLORS[kind] }"></span>
                    <span class="flex-grow-1">{{ to }}</span>
                    <span class="text-muted small me-2">{{ t(`workflowEditor.kinds.${kind}`) }}</span>
                    <BsButton
                      v-if="!readOnly"
                      icon="xmark"
                      colorClass="danger"
                      :isIconButton="true"
                      :title="t('workflowEditor.unlink')"
                      @click="apply((text) => editUnlink(text, wfIndex, node.identifier, to))"
                    />
                  </div>
                </div>
                <template v-if="!readOnly">
                  <div class="input-group mt-2">
                    <select v-model="linkKind" class="form-select af-wf-kind">
                      <option v-for="kind in LINK_KINDS" :key="kind" :value="kind">
                        {{ t(`workflowEditor.kinds.${kind}`) }}
                      </option>
                    </select>
                    <select v-model="linkTo" class="form-select">
                      <option value="">{{ t('workflowEditor.linkTo') }}</option>
                      <option v-for="id in linkTargets" :key="id" :value="id">{{ id }}</option>
                    </select>
                    <BsButton icon="link" :disabled="!linkTo" @click="addLink()">{{
                      t('workflowEditor.link')
                    }}</BsButton>
                  </div>
                  <div class="d-flex flex-wrap gap-2 mt-3">
                    <BsButton
                      v-for="kind in LINK_KINDS"
                      :key="kind"
                      icon="plus"
                      @click="addNode({ identifier: node.identifier, kind })"
                      >{{ t(`workflowEditor.addAfter.${kind}`) }}</BsButton
                    >
                  </div>
                </template>
              </div>
            </div>
            <div v-if="!readOnly" class="mt-4 d-flex gap-2">
              <BsButton icon="code" @click="emit('reveal', node.line)">{{ t('designer.files.showInYaml') }}</BsButton>
              <BsButton icon="trash" @click="removeNode()">{{ t('workflowEditor.removeNode') }}</BsButton>
            </div>
          </template>

          <!-- a link -->
          <template v-else-if="link">
            <div class="af-wf-panel-title">
              <FaIcon icon="link" />{{ t('workflowEditor.linkTitle', { from: link.from, to: link.to }) }}
            </div>
            <label class="form-label fw-bold">{{ t('workflowEditor.runsWhen') }}</label>
            <select
              class="form-select mb-3"
              :value="link.kind"
              :disabled="readOnly"
              @change="setLinkKind($event.target.value)"
            >
              <option v-for="kind in LINK_KINDS" :key="kind" :value="kind">
                {{ t(`workflowEditor.kinds.${kind}`) }}
              </option>
            </select>
            <BsButton v-if="!readOnly" icon="trash" @click="removeLink()">{{ t('workflowEditor.unlink') }}</BsButton>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>
<style lang="scss" scoped>
.af-wf-block {
  margin-bottom: 1rem;
}
.af-wf-legends {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-bottom: -0.5rem;
}
.af-wf-legend {
  white-space: nowrap;
  font-size: 0.8125rem;
  color: var(--bs-secondary-color);
}
.af-wf-line {
  display: inline-block;
  width: 18px;
  height: 3px;
  border-radius: 2px;
  vertical-align: middle;
  margin-right: 6px;
}
.af-wf-problems {
  border: 1px solid var(--bs-warning-border-subtle);
  background: var(--bs-warning-bg-subtle);
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
}
.af-wf-problem {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}
.af-wf-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}
.af-wf-canvas {
  border: 1px solid var(--af-field-border);
  border-radius: 0.5rem;
  background-color: var(--af-bg-light-subtle-color, var(--bs-body-bg));
  overflow: auto;
  padding: 0.5rem;
}
.af-wf-none {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 11rem;
}
.af-wf-none-icon {
  font-size: 2rem;
  opacity: 0.3;
}
.af-wf-svg {
  display: block;
}
.af-wf-link {
  cursor: pointer;
}
.af-wf-start {
  rect {
    fill: var(--bs-secondary);
  }
  text {
    fill: var(--bs-light);
    font-size: 0.7rem;
    font-weight: bold;
    letter-spacing: 1px;
  }
  &.af-wf-clickable {
    cursor: pointer;
    &:hover rect {
      fill: var(--bs-primary);
    }
  }
}
.af-wf-node {
  cursor: pointer;
  &:hover .af-wf-node-rect {
    fill: var(--af-row-hover-bg);
  }
}
.af-wf-node-rect {
  fill: var(--bs-body-bg);
  stroke-width: 2;
}
.af-wf-node-selected .af-wf-node-rect {
  stroke-width: 3.5;
  fill: var(--bs-primary-bg-subtle);
}
.af-wf-node-name {
  fill: var(--bs-body-color);
  font-size: 0.8rem;
  font-weight: 600;
}
.af-wf-node-sub {
  fill: var(--bs-secondary-color);
  font-size: 0.7rem;
}
.af-wf-canvas {
  margin-bottom: 1rem;
}
.af-wf-panel {
  position: relative;
  border: 1px solid var(--af-field-border);
  border-radius: 0.5rem;
  padding: 1rem;
  background: var(--bs-tertiary-bg);
}
.af-wf-panel-close {
  position: absolute;
  top: 0.875rem;
  right: 0.875rem;
}
.af-wf-panel-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
}
.af-wf-out {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0;
}
.af-wf-kind {
  max-width: 8.5rem;
}
@media (max-width: 1100px) {
  .af-wf-main {
    grid-template-columns: 1fr;
  }
}
</style>
