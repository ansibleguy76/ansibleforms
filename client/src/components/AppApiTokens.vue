<script setup>
/******************************************************************/
/*                                                                */
/*  A user's API tokens : when each was made, when it ends, when  */
/*  it was last used, and a button to revoke it (its session      */
/*  ends at once). On the profile (the user's own) and on a       */
/*  user's page in Settings (an admin's view of theirs).          */
/*                                                                */
/*  @props:                                                       */
/*      url: String - the list ; a token is revoked at <url>/<sid>*/
/*      reload: Number - changed, the list is read again (a token */
/*         just made)                                             */
/*                                                                */
/******************************************************************/
import { ref, watch } from 'vue';
import axios from 'axios';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';
import Time from '@/lib/Time';
import { neverExpires } from '@/lib/apiTokens';
import Helpers from '@/lib/Helpers';

const props = defineProps({
  url: { type: String, required: true },
  reload: { type: Number, default: 0 },
});

const { t } = useI18n();
const tokens = ref([]);
const loaded = ref(false);
const revoking = ref(null);

async function load() {
  try {
    const result = await axios.get(props.url);
    tokens.value = result.data?.records || [];
  } catch (err) {
    toast.error(Helpers.parseAxiosResponseError(err, t('apiTokens.failed')));
  } finally {
    loaded.value = true;
  }
}

async function revoke() {
  const token = revoking.value;
  if (!token) return;
  try {
    await axios.delete(`${props.url}/${encodeURIComponent(token.sid)}`);
    toast.success(t('apiTokens.revoked'));
    tokens.value = tokens.value.filter((x) => x.sid !== token.sid);
  } catch (err) {
    toast.error(Helpers.parseAxiosResponseError(err, t('apiTokens.failed')));
  } finally {
    revoking.value = null;
  }
}

watch(() => [props.url, props.reload], load, { immediate: true });
</script>
<template>
  <BsModal v-if="revoking" size="md" icon="ban" @close="revoking = null">
    <template #title>{{ t('apiTokens.revoke') }}</template>
    <template #default>
      <p class="mb-0 fs-6">
        {{ t('apiTokens.revokeConfirm', { name: revoking.name || Time.format(revoking.created_at) }) }}
      </p>
    </template>
    <template #footer>
      <BsButton icon="ban" @click="revoke()">{{ t('apiTokens.revoke') }}</BsButton>
    </template>
  </BsModal>
  <div class="af-api-tokens">
    <p v-if="loaded && !tokens.length" class="text-body-secondary mb-0">{{ t('apiTokens.none') }}</p>
    <div v-else-if="tokens.length" class="table-responsive">
      <table class="table table-sm align-middle mb-0">
        <thead>
          <tr>
            <th>{{ t('apiTokens.name') }}</th>
            <th>{{ t('apiTokens.createdAt') }}</th>
            <th>{{ t('apiTokens.expiresAt') }}</th>
            <th>{{ t('apiTokens.lastUsedAt') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="token in tokens" :key="token.sid">
            <td>{{ token.name || '–' }}</td>
            <td class="text-nowrap">{{ Time.format(token.created_at) }}</td>
            <td class="text-nowrap">
              {{ neverExpires(token.expires_at) ? t('apiTokens.neverExpires') : Time.format(token.expires_at) }}
            </td>
            <td class="text-nowrap">
              {{ token.last_used_at ? Time.format(token.last_used_at) : t('apiTokens.neverUsed') }}
            </td>
            <td class="text-end">
              <button type="button" class="btn btn-sm btn-outline-danger" @click="revoking = token">
                <FaIcon icon="ban" class="me-1" />{{ t('apiTokens.revoke') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
