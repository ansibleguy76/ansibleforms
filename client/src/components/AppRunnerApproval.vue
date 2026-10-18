<script setup>
/******************************************************************/
/*                                                                */
/*  An RTE that asked to join, reviewed : who it says it is (its  */
/*  token's fingerprint, its host, where it called from, its      */
/*  mode, its version, when it asked) and Approve or Reject, as   */
/*  the jobs page reviews a job waiting for approval.             */
/*                                                                */
/*  @props:                                                       */
/*      runner: Object - the runner, with pending_info            */
/*                                                                */
/*  @emits:                                                       */
/*      close - closed, nothing decided                           */
/*      decided (what) - approve or reject done                   */
/*                                                                */
/******************************************************************/
import { ref, computed } from 'vue';
import axios from 'axios';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';
import Helpers from '@/lib/Helpers';

const { t } = useI18n();

const props = defineProps({
  runner: { type: Object, required: true },
});
const emit = defineEmits(['close', 'decided']);

// what it said of itself when it asked (rteHub.askToJoin)
const info = computed(() => {
  try {
    return JSON.parse(props.runner.pending_info || '{}') || {};
  } catch {
    return {};
  }
});

// one decision at a time
const deciding = ref(false);

/**
 * Approves it (it takes jobs from now on) or rejects it (it is removed with its credential).
 *
 * Args:
 *   what (string): approve or reject.
 */
async function decide(what) {
  deciding.value = true;
  try {
    await axios.post(`/api/v2/runner/${encodeURIComponent(props.runner.id)}/${what}`, {});
    toast.success(
      t(what === 'approve' ? 'settings.runners.approved' : 'settings.runners.rejected', { name: props.runner.name }),
    );
    emit('decided', what);
  } catch (err) {
    toast.error(Helpers.parseAxiosResponseError(err, t(`settings.runners.${what}`)));
  } finally {
    deciding.value = false;
  }
}
</script>
<template>
  <BsModal size="md" :footerClose="false" @close="emit('close')" icon="hourglass-half">
    <template #title>{{ t('settings.runners.reviewApproval') }}</template>
    <template #default>
      <div class="af-review-ask">{{ t('settings.runners.pendingHelp') }}</div>
      <dl class="af-review-facts">
        <dt>{{ t('settings.fields.name') }}</dt>
        <dd>{{ runner.name }}</dd>
        <dt>{{ t('settings.runners.pendingFingerprint') }}</dt>
        <dd class="font-monospace">{{ info.fingerprint || '–' }}</dd>
        <dt>{{ t('settings.runners.pendingHost') }}</dt>
        <dd>{{ info.host || '–' }}</dd>
        <dt>{{ t('settings.runners.pendingIp') }}</dt>
        <dd>{{ info.ip || '–' }}</dd>
        <dt>{{ t('settings.runners.rteMode') }}</dt>
        <dd>{{ info.mode ? t(`settings.runners.rteMode_${info.mode}`) : '–' }}</dd>
        <template v-if="info.url">
          <dt>{{ t('settings.fields.uri') }}</dt>
          <dd>{{ info.url }}</dd>
        </template>
        <dt>{{ t('settings.runners.pendingVersion') }}</dt>
        <dd>{{ info.version || '–' }}</dd>
        <dt>{{ t('settings.runners.pendingSince') }}</dt>
        <dd>{{ runner.pending_since ? Helpers.formatServerDate(runner.pending_since) : '–' }}</dd>
      </dl>
    </template>
    <!-- nothing focused, and no Enter : approving gives it jobs and their secrets, it takes a click -->
    <template #footer>
      <BsButton icon="circle-xmark" colorClass="danger" :disabled="deciding" @click="decide('reject')">{{
        t('settings.runners.reject')
      }}</BsButton>
      <BsButton icon="circle-check" colorClass="success" :disabled="deciding" @click="decide('approve')">{{
        t('settings.runners.approve')
      }}</BsButton>
    </template>
  </BsModal>
</template>
<style scoped lang="scss">
/* as the jobs page's review of a job waiting for approval (pages/jobs.vue) */
.af-review-ask {
  margin-bottom: 0.75rem;
  padding: 0.75rem 1rem;
  border-left: 3px solid #ef6009;
  border-radius: 0.375rem;
  background: color-mix(in srgb, #ef6009 8%, transparent);
  overflow-wrap: anywhere;
}
.af-review-facts {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: baseline;
  gap: 0.5rem 1.5rem;
  margin: 0;
  dt {
    font-size: 0.7rem;
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
</style>
