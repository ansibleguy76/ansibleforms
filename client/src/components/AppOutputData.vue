<script setup>
/******************************************************************/
/*                                                                */
/*  AppOutputData : what a job was given or gave back - its       */
/*  extravars (payload, parameters) or its artifacts - in a       */
/*  panel over its output : its title, JSON or YAML, Copy, and a  */
/*  close. A job's page and the form's output use it.             */
/*                                                                */
/*  @props:                                                       */
/*      title: String - what it is (Extravars, Artifacts ...)     */
/*      icon: String - its icon                                   */
/*      value: any - the data                                     */
/*  @emits:                                                       */
/*      close, copy (value, asYaml)                               */
/*                                                                */
/******************************************************************/
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import YAML from 'yaml';

defineProps({
  title: { type: String, default: '' },
  icon: { type: String, default: 'square-poll-vertical' },
  value: { type: [Object, Array, String, Number, Boolean], default: null },
});
const emit = defineEmits(['close', 'copy']);
const { t } = useI18n();
const viewAsYaml = ref(false);
</script>

<template>
  <div class="af-output-data">
    <div class="af-data-head">
      <span class="af-data-title"><FaIcon :icon="icon" /> {{ title }}</span>
      <div class="af-data-tools">
        <div class="af-segmented" role="group">
          <button type="button" class="af-tool-btn" :class="{ active: !viewAsYaml }" @click="viewAsYaml = false">
            JSON
          </button>
          <button type="button" class="af-tool-btn" :class="{ active: viewAsYaml }" @click="viewAsYaml = true">
            YAML
          </button>
        </div>
        <button type="button" class="af-tool-btn" @click="emit('copy', value, viewAsYaml)">
          <FaIcon icon="copy" />{{ t('jobs.copy') }}
        </button>
        <button type="button" class="af-tool-btn af-tool-icon" :aria-label="t('common.close')" @click="emit('close')">
          <FaIcon icon="xmark" />
        </button>
      </div>
    </div>
    <div class="af-data-body">
      <VueJsonPretty v-if="!viewAsYaml" :data="value" />
      <pre
        v-else
        v-highlightjs
      ><code language="yaml" style="border:none;padding:0;background:none">{{ YAML.stringify(value) }}</code></pre>
    </div>
  </div>
</template>
