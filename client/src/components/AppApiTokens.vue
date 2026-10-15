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
/*      toolbarTo: String - a selector the table's search and     */
/*         buttons move to (the profile's title line) ; else in   */
/*         the table's own bar                                    */
/*  The list of the other pages (BsDataTable) : search, columns,  */
/*  export, pager, a row's menu with Revoke.                      */
/*                                                                */
/******************************************************************/
import { ref, computed, watch } from 'vue';
import axios from 'axios';
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';
import Time from '@/lib/Time';
import { neverExpires } from '@/lib/apiTokens';
import Helpers from '@/lib/Helpers';
import { esc } from '@/lib/tableCells';

const props = defineProps({
  url: { type: String, required: true },
  reload: { type: Number, default: 0 },
  toolbarTo: { type: String, default: null },
});

const { t } = useI18n();
const tokens = ref([]);
const loaded = ref(false);
const revoking = ref(null);

// the columns : what the token is for, when it was made, when it ends, when it was last used
const columns = computed(() => [
  { key: 'name', label: t('apiTokens.name'), sortable: true, filterable: true, render: (v) => esc(v || '–') },
  {
    key: 'created_at',
    label: t('apiTokens.createdAt'),
    sortable: true,
    render: (v) => esc(Time.format(v)),
    sortValue: (row) => Date.parse(row.created_at) || 0,
  },
  {
    key: 'expires_at',
    label: t('apiTokens.expiresAt'),
    sortable: true,
    render: (v) => esc(neverExpires(v) ? t('apiTokens.neverExpires') : Time.format(v)),
    sortValue: (row) => Date.parse(row.expires_at) || 0,
  },
  {
    key: 'last_used_at',
    label: t('apiTokens.lastUsedAt'),
    sortable: true,
    render: (v) => esc(v ? Time.format(v) : t('apiTokens.neverUsed')),
    sortValue: (row) => Date.parse(row.last_used_at) || 0,
  },
]);

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
  <!-- the tokens in the list of the other pages, a row's menu to revoke one -->
  <AppSkeleton v-if="!loaded" shape="table" :count="3" />
  <BsDataTable
    v-else
    framed
    :toolbarTo="toolbarTo"
    :items="tokens"
    :columns="columns"
    idKey="sid"
    :selectable="false"
    :name="'apitokens'"
    :exportName="t('apiTokens.title')"
  >
    <template #row-actions="{ item }">
      <div class="dropdown">
        <a
          role="button"
          class="bs-dt-row-menu px-2"
          data-bs-toggle="dropdown"
          data-bs-popper-config='{"strategy":"fixed"}'
          @click.stop
        >
          <FaIcon icon="ellipsis-vertical" />
        </a>
        <ul class="dropdown-menu dropdown-menu-end">
          <li>
            <a class="dropdown-item text-danger" href="#" @click.prevent="revoking = item">
              <FaIcon icon="ban" class="me-2" />{{ t('apiTokens.revoke') }}
            </a>
          </li>
        </ul>
      </div>
    </template>
  </BsDataTable>
</template>
