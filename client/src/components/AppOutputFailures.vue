<script setup>
/******************************************************************/
/*                                                                */
/*  AppOutputFailures : the output toolbar's button to what went  */
/*  wrong - "2 failed" (the tasks that failed), else "1 error"    */
/*  (the error lines, for a job without ansible tasks) - each     */
/*  click the next one, unfolded and highlighted, round again     */
/*  after the last. Shown only when there is something.           */
/*                                                                */
/*  A job's page and the form's output use it, beside their       */
/*  output (components/AppAnsibleOutput.vue : its failures,       */
/*  failureKind and goToFailure).                                 */
/*                                                                */
/*  @props:                                                       */
/*      output: Object - the AppAnsibleOutput (its ref)           */
/*      jobId: Number|String - the job : another one starts from  */
/*             its first failure                                  */
/*                                                                */
/******************************************************************/
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  output: { type: Object, default: null },
  jobId: { type: [Number, String], default: null },
});
const { t } = useI18n();

const failures = computed(() => props.output?.failures || []);
const isError = computed(() => props.output?.failureKind === 'error');
// the one the next click goes to
const at = ref(0);
watch(
  () => props.jobId,
  () => (at.value = 0),
);
const next = computed(() => failures.value[at.value % Math.max(1, failures.value.length)]);

/**
 * Goes to the next failure, then the one after, round again after the last.
 */
function goNext() {
  const count = failures.value.length;
  if (!count) return;
  props.output.goToFailure(at.value % count);
  at.value = (at.value + 1) % count;
}
</script>

<template>
  <button
    v-if="failures.length"
    type="button"
    class="af-tool-btn af-tool-danger"
    :title="
      t(isError ? 'jobs.nextError' : 'jobs.nextFailure', {
        n: (at % failures.length) + 1,
        count: failures.length,
        name: next?.name,
      })
    "
    @click="goNext"
  >
    <FaIcon icon="triangle-exclamation" />
    {{
      isError
        ? t('jobs.errorLines', { count: failures.length }, failures.length)
        : t('jobs.failedTasks', { count: failures.length })
    }}
  </button>
</template>
