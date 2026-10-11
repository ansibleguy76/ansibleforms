<script setup>
/******************************************************************/
/*                                                                */
/*  The disclaimer (Settings > Access > Disclaimer), over the     */
/*  page after signing in : its text, a checkbox to tick, then    */
/*  Accept - recorded on the server, once per version - or        */
/*  Decline, which signs out. It cannot be closed otherwise : the */
/*  server answers nothing else until it is accepted              */
/*  (server/src/lib/middleware.js disclaimerGate).                */
/*                                                                */
/*  @props:                                                       */
/*      preview: Object - { title, text, checkbox_label } : the   */
/*         dialog as users will see it (Settings > Access >       */
/*         Disclaimer's Preview) ; closable, its buttons only     */
/*         close it                                               */
/*                                                                */
/*  @emit:                                                        */
/*      close: the preview closed                                 */
/*                                                                */
/******************************************************************/
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import Helpers from '@/lib/Helpers';
import { useAppStore } from '@/stores/app';

const props = defineProps({
  preview: { type: Object, default: null },
});
const emit = defineEmits(['close']);

const { t } = useI18n();
const router = useRouter();
const store = useAppStore();
// the disclaimer as the server has it : its version, title, text and checkbox label
const disclaimer = ref(null);
const agreed = ref(false);
const busy = ref(false);

/**
 * Reads the disclaimer ; none to accept (switched off meanwhile, accepted in another tab) : the
 * page is loaded again, as it was refused.
 */
async function load() {
  if (props.preview) {
    disclaimer.value = props.preview;
    return;
  }
  try {
    const res = await axios.get('/api/v2/disclaimer');
    if (!res.data?.required) {
      done();
      return;
    }
    disclaimer.value = res.data;
    agreed.value = false;
  } catch (err) {
    toast.error(Helpers.parseAxiosResponseError(err));
  }
}

/**
 * Closes the dialog and loads the page again : what it asked before was refused.
 */
function done() {
  store.disclaimerOpen = false;
  window.location.reload();
}

/**
 * Accepts the version shown ; changed while it was read, the new one is shown instead.
 */
async function accept() {
  if (props.preview) return emit('close');
  busy.value = true;
  try {
    await axios.post('/api/v2/disclaimer/accept', { version: disclaimer.value.version });
    done();
  } catch (err) {
    toast.error(Helpers.parseAxiosResponseError(err));
    await load();
  } finally {
    busy.value = false;
  }
}

/**
 * Declines : said to the server (the audit log), then signed out.
 */
async function decline() {
  if (props.preview) return emit('close');
  busy.value = true;
  await axios.post('/api/v2/disclaimer/decline').catch(() => null);
  store.disclaimerOpen = false;
  router.push('/logout');
}

onMounted(load);
</script>
<template>
  <BsModal
    v-if="disclaimer"
    icon="file-signature"
    size="lg"
    :closable="!!preview"
    :footerClose="false"
    @close="emit('close')"
  >
    <template #title>{{ disclaimer.title }}</template>
    <template #default>
      <div class="af-disclaimer-text">{{ disclaimer.text }}</div>
      <div class="form-check mt-3 mb-0">
        <input id="af-disclaimer-agree" v-model="agreed" class="form-check-input" type="checkbox" />
        <label class="form-check-label fw-bold" for="af-disclaimer-agree">{{ disclaimer.checkbox_label }}</label>
      </div>
    </template>
    <template #footer>
      <BsButton icon="right-from-bracket" colorClass="secondary" :disabled="busy" @click="decline()">{{
        t('disclaimer.decline')
      }}</BsButton>
      <BsButton
        icon="check"
        :colorClass="agreed ? 'primary' : 'secondary'"
        :disabled="!agreed || busy"
        @click="accept()"
        >{{ t('disclaimer.accept') }}</BsButton
      >
    </template>
  </BsModal>
</template>
<style scoped>
/* the text as written : its line breaks kept, long ones wrapped ; a long text scrolls in the
   dialog's body */
.af-disclaimer-text {
  white-space: pre-line;
  overflow-wrap: anywhere;
}
</style>
