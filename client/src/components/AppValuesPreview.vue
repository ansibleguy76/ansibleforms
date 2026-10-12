<script setup>
/******************************************************************/
/*                                                                */
/*  The Preview of the constants, or of a vars file : each value  */
/*  by its path (a map's keys under it), its kind and its value,  */
/*  how it is referenced - $(PATH) in a form, {{ path }} in a     */
/*  playbook - with a button to copy it, and the forms that use   */
/*  it (a constant) or that load the file (a vars file). Read     */
/*  only.                                                         */
/*                                                                */
/*  @props:                                                       */
/*      text: String - the YAML (the constants, the vars file)    */
/*      mode: String - 'constants' or 'vars'                      */
/*      forms: Array - { name, text } : the designer's forms      */
/*      file: String - the vars file's path (mode vars)           */
/*  @emits:                                                       */
/*      reveal: the line to open the YAML on                      */
/*                                                                */
/******************************************************************/
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast } from 'vue-sonner';
import { flatten, readMap, formsUsingConstant, formsUsingVarsFile } from '@/config/previews';

const props = defineProps({
  text: { type: String, default: '' },
  mode: { type: String, default: 'constants' },
  forms: { type: Array, default: () => [] },
  file: { type: String, default: '' },
});
const emit = defineEmits(['reveal']);
const { t } = useI18n();

const read = computed(() => readMap(props.text));
const rows = computed(() =>
  flatten(read.value.data || {}).map((r) => ({
    ...r,
    reference: props.mode === 'constants' ? `$(${r.path})` : `{{ ${r.path} }}`,
    usedBy: props.mode === 'constants' ? formsUsingConstant(r.path, props.forms) : [],
  })),
);
// a vars file : the forms that load it
const fileUsedBy = computed(() => (props.mode === 'vars' ? formsUsingVarsFile(props.file, props.forms) : []));

/**
 * Copies a reference.
 *
 * Args:
 *   text (string): the reference.
 */
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(t('valuesPreview.copied', { text }));
  } catch {
    toast.error(t('valuesPreview.copyFailed'));
  }
}
</script>
<template>
  <div>
    <div v-if="!read.data" class="alert alert-warning d-flex align-items-center gap-2">
      <FaIcon icon="triangle-exclamation" />
      <span class="flex-grow-1">{{ t('designer.files.visualInvalid', { error: read.error }) }}</span>
      <BsButton v-if="read.line" icon="code" @click="emit('reveal', read.line)">{{
        t('designer.files.showInYaml')
      }}</BsButton>
    </div>
    <template v-else>
      <!-- a vars file : who loads it -->
      <div v-if="mode === 'vars'" class="mb-3">
        <span class="fw-bold me-2">{{ t('valuesPreview.loadedBy') }}</span>
        <span v-for="f in fileUsedBy" :key="f" class="badge rounded-pill af-vp-form me-1"
          ><FaIcon icon="rectangle-list" class="me-1" />{{ f }}</span
        >
        <span v-if="!fileUsedBy.length" class="text-body-secondary">{{ t('valuesPreview.noForm') }}</span>
      </div>
      <div v-if="!rows.length" class="empty-state">
        <FaIcon :icon="mode === 'constants' ? 'sliders-h' : 'file-lines'" class="empty-state-icon" />
        <span>{{ t(mode === 'constants' ? 'valuesPreview.noConstant' : 'valuesPreview.noVar') }}</span>
      </div>
      <div v-else class="table-responsive">
        <table class="table table-sm align-middle af-vp">
          <thead>
            <tr>
              <th>{{ t('valuesPreview.name') }}</th>
              <th>{{ t('valuesPreview.value') }}</th>
              <th>{{ t(mode === 'constants' ? 'valuesPreview.inAForm' : 'valuesPreview.inAPlaybook') }}</th>
              <th v-if="mode === 'constants'">{{ t('valuesPreview.usedBy') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rows" :key="r.path">
              <td :style="{ paddingLeft: r.depth * 1.25 + 0.5 + 'rem' }">
                <span class="fw-semibold">{{ r.path.split('.').pop() }}</span>
                <span class="badge af-vp-kind ms-2">{{ t(`valuesPreview.kinds.${r.kind}`) }}</span>
              </td>
              <td class="af-vp-value">
                <span v-if="r.kind === 'map'" class="text-body-secondary">{{ t('valuesPreview.keys', r.value) }}</span>
                <span v-else-if="r.value === ''" class="text-body-secondary fst-italic">{{
                  t('valuesPreview.empty')
                }}</span>
                <span v-else class="font-monospace">{{ r.value }}</span>
              </td>
              <td>
                <span class="d-inline-flex align-items-center gap-1">
                  <code class="af-vp-ref">{{ r.reference }}</code>
                  <button
                    type="button"
                    class="btn btn-sm af-vp-copy"
                    :title="t('valuesPreview.copy')"
                    @click="copy(r.reference)"
                  >
                    <FaIcon icon="copy" />
                  </button>
                </span>
              </td>
              <td v-if="mode === 'constants'">
                <span v-for="f in r.usedBy" :key="f" class="badge rounded-pill af-vp-form me-1 mb-1">{{ f }}</span>
                <span v-if="!r.usedBy.length" class="text-body-secondary small">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
<style scoped lang="scss">
.af-vp {
  border: 1px solid var(--af-field-border, var(--bs-border-color));
  th,
  td {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }
  th {
    background: var(--bs-tertiary-bg);
    font-weight: 600;
    white-space: nowrap;
  }
}
.af-vp-kind {
  background: var(--bs-secondary-bg);
  color: var(--bs-secondary-color);
  border: 1px solid var(--bs-border-color);
  font-weight: 500;
}
.af-vp-value {
  max-width: 28rem;
  word-break: break-word;
}
.af-vp-ref {
  white-space: nowrap;
}
.af-vp-copy {
  color: var(--bs-secondary-color);
  padding: 0 0.3rem;
  &:hover {
    color: var(--bs-primary);
  }
}
.af-vp-form {
  background: var(--bs-primary-bg-subtle);
  color: var(--bs-primary-text-emphasis);
  font-weight: 500;
}
</style>
