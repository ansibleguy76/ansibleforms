<script setup>
/******************************************************************/
/*                                                                */
/*  A workflow node's fields, two by two : what it runs (its      */
/*  identifier, its kind, its playbook / workflow / approval /    */
/*  repository, an approval's wait), or how its playbook runs     */
/*  (inventory, limit, tags, verbosity, check, diff, its          */
/*  credentials). The same in the new node wizard and in the      */
/*  node's dialog : each change is emitted, the caller applies it */
/*  (the file, or the wizard's draft).                            */
/*                                                                */
/*  @props:                                                       */
/*      node: Object - the node (workflowFileOf), or a draft      */
/*      section: String - 'runs' or 'settings'                    */
/*      choices: Function - type -> the names it may run, or null */
/*         (then typed)                                           */
/*      refs: Object - { inventories, credentials, runners } :    */
/*         the instance's names (runners : { name, type }), null  */
/*         when unknown                                           */
/*      readOnly: Boolean - shown, not editable                   */
/*      identifierError: String - why the identifier cannot be    */
/*         (shown under it)                                       */
/*  @emits:                                                       */
/*      set: (key, value) - a field changed                       */
/*                                                                */
/******************************************************************/
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { NODE_TYPES, onTemplateRunner } from '@/config/workflowFile';

const props = defineProps({
  node: { type: Object, required: true },
  section: { type: String, default: 'runs' },
  choices: { type: Function, default: () => null },
  refs: { type: Object, default: () => ({}) },
  readOnly: { type: Boolean, default: false },
  identifierError: { type: String, default: '' },
});
const emit = defineEmits(['set']);
const { t } = useI18n();

const sorted = (list) => [...(list || [])].sort((a, b) => a.localeCompare(b));
// a name the node uses that the instance lacks : still offered, so the field shows it
const withCurrent = (list, current) => (current && list && !list.includes(current) ? [current, ...list] : list || []);
// a job template node on a template runner (AWX, Semaphore, Rundeck, Jenkins) runs that runner's
// template or job : its name is typed, the designer's playbooks are not it
const onRunner = computed(() => props.node.type === 'job_template' && onTemplateRunner(props.node, props.refs));
const runChoices = computed(() => (onRunner.value ? null : props.choices(props.node.type)));
// what the runner choice offers : every runner, by name (its type beside it)
const runnerChoices = computed(() => [...(props.refs.runners || [])].sort((a, b) => a.name.localeCompare(b.name)));
const isTrue = (v) => v === true || v === 'true';

// ─── its credentials : those it has (each removable), one more picked and added ───
const credentialToAdd = ref('');
watch(
  () => props.node.identifier,
  () => (credentialToAdd.value = ''),
);
const credentialChoices = computed(() =>
  sorted(props.refs.credentials).filter((c) => !(props.node.credentials || []).includes(c)),
);
/** Adds the credential picked ; nothing picked, nothing added. */
function addCredential() {
  if (!credentialToAdd.value) return;
  emit('set', 'credentials', [...(props.node.credentials || []), credentialToAdd.value]);
  credentialToAdd.value = '';
}
/**
 * Removes one of its credentials.
 *
 * Args:
 *   name (string): the credential.
 */
function removeCredential(name) {
  emit(
    'set',
    'credentials',
    (props.node.credentials || []).filter((c) => c !== name),
  );
}
</script>
<template>
  <!-- what it runs : a field a line, each half the width -->
  <div v-if="section === 'runs'">
    <div class="af-wf-half">
      <label class="form-label fw-bold">{{ t('workflowEditor.identifier') }}</label>
      <input
        class="form-control"
        :class="{ 'is-invalid': identifierError }"
        :value="node.identifier"
        :disabled="readOnly"
        spellcheck="false"
        @change="emit('set', 'identifier', $event.target.value.trim())"
      />
      <div v-if="identifierError" class="invalid-feedback d-block">{{ identifierError }}</div>
    </div>
    <div class="af-wf-half">
      <label class="form-label fw-bold">{{ t('workflowEditor.runs') }}</label>
      <select
        class="form-select"
        :value="node.type"
        :disabled="readOnly"
        @change="emit('set', 'type', $event.target.value)"
      >
        <option v-for="type in NODE_TYPES" :key="type" :value="type">{{ t(`workflowEditor.types.${type}`) }}</option>
      </select>
    </div>
    <div class="af-wf-half">
      <label class="form-label fw-bold">{{
        onRunner
          ? t('workflowEditor.runName.template')
          : t(`workflowEditor.runName.${node.type}`, t('workflowEditor.name'))
      }}</label>
      <select
        v-if="runChoices"
        class="form-select"
        :class="{ 'is-invalid': !node.name }"
        :value="node.name"
        :disabled="readOnly"
        @change="emit('set', 'name', $event.target.value)"
      >
        <option value="">-</option>
        <option v-for="c in withCurrent(runChoices, node.name)" :key="c" :value="c">{{ c }}</option>
      </select>
      <input
        v-else
        class="form-control"
        :class="{ 'is-invalid': !node.name }"
        :value="node.name"
        :disabled="readOnly"
        @change="emit('set', 'name', $event.target.value)"
      />
    </div>
    <!-- a playbook node : on an RTE (a designer playbook), or a runner's template or job -->
    <div v-if="node.type === 'job_template'" class="af-wf-half">
      <label class="form-label fw-bold">{{ t('workflowEditor.runner') }}</label>
      <select
        v-if="refs.runners"
        class="form-select"
        :value="node.runner || ''"
        :disabled="readOnly"
        @change="emit('set', 'runner', $event.target.value)"
      >
        <option value="">{{ t('workflowEditor.runnerNone') }}</option>
        <option v-if="node.runner && !runnerChoices.some((r) => r.name === node.runner)" :value="node.runner">
          {{ node.runner }}
        </option>
        <option v-for="r in runnerChoices" :key="r.name" :value="r.name">{{ r.name }} ({{ r.type }})</option>
      </select>
      <input
        v-else
        class="form-control"
        :value="node.runner"
        :disabled="readOnly"
        spellcheck="false"
        @change="emit('set', 'runner', $event.target.value.trim())"
      />
      <div class="form-text">{{ t('workflowEditor.runnerHint') }}</div>
    </div>
    <!-- when it runs, and what it gets : as a multistep's step ifExtraVar and key -->
    <template v-if="node.type !== 'workflow_approval_template'">
      <div class="af-wf-half">
        <label class="form-label fw-bold">{{ t('workflowEditor.condition') }}</label>
        <input
          class="form-control"
          :value="node.if_extra_var"
          :disabled="readOnly"
          spellcheck="false"
          @change="emit('set', 'if_extra_var', $event.target.value.trim())"
        />
        <div class="form-text">{{ t('workflowEditor.conditionHint') }}</div>
      </div>
      <div class="af-wf-half">
        <label class="form-label fw-bold">{{ t('workflowEditor.valuesKey') }}</label>
        <input
          class="form-control"
          :value="node.extra_vars_key"
          :disabled="readOnly"
          spellcheck="false"
          @change="emit('set', 'extra_vars_key', $event.target.value.trim())"
        />
        <div class="form-text">{{ t('workflowEditor.valuesKeyHint') }}</div>
      </div>
    </template>
    <!-- an approval : how long it waits -->
    <div v-if="node.type === 'workflow_approval_template'" class="af-wf-half">
      <label class="form-label fw-bold">{{ t('workflowEditor.timeout') }}</label>
      <input
        class="form-control"
        type="number"
        min="0"
        :value="node.timeout"
        :disabled="readOnly"
        @change="emit('set', 'timeout', $event.target.value)"
      />
      <div class="form-text">{{ t('workflowEditor.timeoutHint') }}</div>
    </div>
  </div>

  <!-- how its playbook runs -->
  <template v-else-if="section === 'settings'">
    <div class="row g-3 mb-3">
      <div class="col-md-6">
        <label class="form-label fw-bold">{{ t('workflowEditor.inventory') }}</label>
        <select
          v-if="refs.inventories && !onRunner"
          class="form-select"
          :value="node.inventory"
          :disabled="readOnly"
          @change="emit('set', 'inventory', $event.target.value)"
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
          @change="emit('set', 'inventory', $event.target.value)"
        />
      </div>
      <div class="col-md-6">
        <label class="form-label fw-bold">{{ t('workflowEditor.limit') }}</label>
        <input
          class="form-control"
          :value="node.limit"
          :disabled="readOnly"
          @change="emit('set', 'limit', $event.target.value)"
        />
      </div>
      <div class="col-md-6">
        <label class="form-label fw-bold">{{ t('workflowEditor.jobTags') }}</label>
        <input
          class="form-control"
          :value="node.job_tags"
          :disabled="readOnly"
          @change="emit('set', 'job_tags', $event.target.value)"
        />
      </div>
      <div class="col-md-6">
        <label class="form-label fw-bold">{{ t('workflowEditor.skipTags') }}</label>
        <input
          class="form-control"
          :value="node.skip_tags"
          :disabled="readOnly"
          @change="emit('set', 'skip_tags', $event.target.value)"
        />
      </div>
      <div class="col-md-6">
        <label class="form-label fw-bold">{{ t('workflowEditor.verbosity') }}</label>
        <select
          class="form-select"
          :value="String(node.verbosity || '')"
          :disabled="readOnly"
          @change="emit('set', 'verbosity', $event.target.value)"
        >
          <option value="">0</option>
          <option v-for="v in [1, 2, 3, 4, 5]" :key="v" :value="String(v)">{{ v }}</option>
        </select>
      </div>
      <div class="col-md-6">
        <label class="form-label fw-bold">{{ t('workflowEditor.credentials') }}</label>
        <div v-for="c in node.credentials || []" :key="c" class="af-wf-cred">
          <FaIcon icon="key" class="text-gray-500 me-1" />
          <span class="flex-grow-1">{{ c }}</span>
          <BsButton
            v-if="!readOnly"
            icon="xmark"
            colorClass="danger"
            :isIconButton="true"
            :title="t('workflowEditor.removeCredential')"
            @click="removeCredential(c)"
          />
        </div>
        <div v-if="!readOnly" class="input-group">
          <select v-model="credentialToAdd" class="form-select" :disabled="!credentialChoices.length">
            <option value="">
              {{ credentialChoices.length ? t('workflowEditor.credential') : t('workflowEditor.noCredentials') }}
            </option>
            <option v-for="c in credentialChoices" :key="c" :value="c">{{ c }}</option>
          </select>
          <BsButton icon="plus" :title="t('workflowEditor.addCredential')" @click="addCredential()" />
        </div>
      </div>
    </div>
    <div class="d-flex flex-wrap gap-4">
      <div class="form-check form-switch">
        <input
          :id="'wf-check-' + section"
          class="form-check-input"
          type="checkbox"
          :checked="node.job_type === 'check'"
          :disabled="readOnly"
          @change="emit('set', 'job_type', $event.target.checked ? 'check' : '')"
        />
        <label class="form-check-label" :for="'wf-check-' + section">{{ t('workflowEditor.check') }}</label>
      </div>
      <div class="form-check form-switch">
        <input
          :id="'wf-diff-' + section"
          class="form-check-input"
          type="checkbox"
          :checked="isTrue(node.diff_mode)"
          :disabled="readOnly"
          @change="emit('set', 'diff_mode', $event.target.checked)"
        />
        <label class="form-check-label" :for="'wf-diff-' + section">{{ t('workflowEditor.diff') }}</label>
      </div>
    </div>
  </template>
</template>
<style scoped>
/* a field a line, half the dialog's width (a narrow window : the whole width) */
.af-wf-half {
  width: calc(50% - 0.5rem);
  margin-bottom: 1rem;
}
.af-wf-half:last-child {
  margin-bottom: 0;
}
@media (max-width: 767px) {
  .af-wf-half {
    width: 100%;
  }
}
.af-wf-cred {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0;
}
</style>
