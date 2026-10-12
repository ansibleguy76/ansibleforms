<script setup>
/******************************************************************/
/*                                                                */
/*  A workflow node's extravars or artifacts, under its header in */
/*  the job's output (AppAnsibleOutput) : read from the job's     */
/*  node (GET /api/v2/job/<id>/node/<node>) - the RTE's child job */
/*  or the AWX job - each time it opens, as the job's own         */
/*  extravars and artifacts show above the output : JSON or YAML, */
/*  Copy, and a close. Empty, it shows {}.                        */
/*                                                                */
/*  @props:                                                       */
/*      jobId: Number|String - the workflow job                   */
/*      nodeId: Number|String - the node, in the job's graph      */
/*      kind: String - 'extravars' or 'artifacts'                 */
/*  @emits:                                                       */
/*      close: the panel closed                                   */
/*      copy: what is shown, as text (the page copies it)         */
/*                                                                */
/******************************************************************/
import { ref, computed, watch } from 'vue';
import axios from 'axios';
import YAML from 'yaml';
import Helpers from '@/lib/Helpers';

const props = defineProps({
  jobId: { type: [Number, String], required: true },
  nodeId: { type: [Number, String], required: true },
  kind: { type: String, default: 'extravars' },
});
const emit = defineEmits(['close', 'copy']);
const { t } = useI18n();

const data = ref(null);
const loading = ref(false);
const error = ref('');
const asYaml = ref(false);

/**
 * Reads the node's extravars and artifacts.
 */
async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await axios.get(
      `/api/v2/job/${encodeURIComponent(props.jobId)}/node/${encodeURIComponent(props.nodeId)}`,
    );
    data.value = res.data?.data?.output ?? res.data ?? {};
  } catch (err) {
    error.value = Helpers.parseAxiosResponseError(err);
  } finally {
    loading.value = false;
  }
}
watch(() => [props.jobId, props.nodeId], load, { immediate: true });

// what is shown : the node's extravars or its artifacts, {} when it has none
const value = computed(() => data.value?.[props.kind] ?? {});

/**
 * Hands what is shown to the page to copy, as JSON or YAML as it is shown.
 */
function copy() {
  emit('copy', asYaml.value ? YAML.stringify(value.value) : JSON.stringify(value.value, null, 2));
}
</script>
<template>
  <div class="af-output-data af-node-data" @click.stop>
    <div class="af-data-head">
      <span class="af-data-title">
        <FaIcon :icon="kind === 'artifacts' ? 'square-poll-vertical' : 'eye'" />
        {{ kind === 'artifacts' ? t('jobs.artifacts') : t('jobs.extravars') }}
      </span>
      <div class="af-data-tools">
        <div class="af-segmented" role="group">
          <button type="button" class="af-tool-btn" :class="{ active: !asYaml }" @click="asYaml = false">JSON</button>
          <button type="button" class="af-tool-btn" :class="{ active: asYaml }" @click="asYaml = true">YAML</button>
        </div>
        <button type="button" class="af-tool-btn" :disabled="loading || !!error" @click="copy()">
          <FaIcon icon="copy" />{{ t('jobs.copy') }}
        </button>
        <button type="button" class="af-tool-btn af-tool-icon" :aria-label="t('common.close')" @click="emit('close')">
          <FaIcon icon="xmark" />
        </button>
      </div>
    </div>
    <div class="af-data-body">
      <div v-if="loading" class="text-body-secondary small">
        <span class="spinner-border spinner-border-sm me-2" role="status"></span>{{ t('common.loading') }}
      </div>
      <div v-else-if="error" class="text-danger small">{{ error }}</div>
      <VueJsonPretty v-else-if="!asYaml" :data="value" />
      <pre
        v-else
        v-highlightjs
      ><code language="yaml" style="border:none;padding:0;background:none">{{ YAML.stringify(value) }}</code></pre>
    </div>
  </div>
</template>
<style scoped>
/* inside a node's card, under its header : the card's own frame around it */
.af-node-data {
  border-bottom: 1px solid var(--af-field-border);
}
</style>
