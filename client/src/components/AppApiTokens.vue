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
/*  @emits count: Number - how many tokens it lists, once read    */
/*      and after a revoke (the count of the page's tab)          */
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
  // a selector the pager moves to (under the page's card, as the other lists) ; else in the table
  pagerTo: { type: String, default: null },
  // the page's search (a user's page searches all its tabs at once) : the tokens filtered on it,
  // no box of the table's ; while a word is searched the table keeps its controls and pager in
  // its own frame (other tables may be on the page then)
  search: { type: String, default: null },
});
const searchingWord = computed(() => !!(props.search && props.search.trim()));

const emit = defineEmits(['count']);
const { t } = useI18n();
const tokens = ref([]);
const loaded = ref(false);
// the tokens Revoke asks about : a row's, or those ticked
const revoking = ref(null);
// the rows ticked (their sid), as a list's
const selectedIds = ref(new Set());
const tokenName = (token) => token.name || Time.format(token.created_at);

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

/**
 * Revokes the tokens asked about, one after the other ; a failure stops there and says why.
 */
async function revoke() {
  const list = revoking.value || [];
  for (const token of list) {
    try {
      await axios.delete(`${props.url}/${encodeURIComponent(token.sid)}`);
      tokens.value = tokens.value.filter((x) => x.sid !== token.sid);
    } catch (err) {
      toast.error(Helpers.parseAxiosResponseError(err, t('apiTokens.failed')));
      break;
    }
  }
  if (list.length && !tokens.value.some((x) => list.some((r) => r.sid === x.sid)))
    toast.success(t('apiTokens.revoked'));
  selectedIds.value = new Set();
  revoking.value = null;
}

watch(() => [props.url, props.reload], load, { immediate: true });
// how many, for the count of the page's tab
watch(
  () => tokens.value.length,
  (n) => loaded.value && emit('count', n),
);
watch(loaded, (done) => done && emit('count', tokens.value.length));
</script>
<template>
  <BsModal v-if="revoking" size="md" icon="ban" @close="revoking = null">
    <template #title>{{ t('apiTokens.revoke') }}</template>
    <template #default>
      <p class="mb-0 fs-6">
        {{ t('apiTokens.revokeConfirm', { name: revoking.map(tokenName).join(', ') }) }}
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
    :key="searchingWord ? 'search' : 'list'"
    :toolbarTo="searchingWord ? null : toolbarTo"
    :pagerTo="searchingWord ? null : pagerTo"
    :search="search"
    :items="tokens"
    :columns="columns"
    idKey="sid"
    :selectedIds="selectedIds"
    :rowClickSelects="false"
    linkColumn="none"
    :name="'apitokens'"
    :exportName="t('apiTokens.title')"
    :empty="t('apiTokens.none')"
    @update:selectedIds="selectedIds = $event"
  >
    <!-- those ticked : revoked, after asking -->
    <template #bulk-actions="{ count }">
      <BsButton v-if="count" icon="ban" @click="revoking = tokens.filter((x) => selectedIds.has(x.sid))"
        >{{ t('apiTokens.revoke') }} ({{ count }})</BsButton
      >
    </template>
    <template #row-actions="{ item }">
      <div class="dropdown">
        <button
          type="button"
          class="bs-dt-row-menu px-2"
          data-bs-toggle="dropdown"
          data-bs-popper-config='{"strategy":"fixed"}'
          @click.stop
          :aria-label="t('common.actions')"
        >
          <FaIcon icon="ellipsis-vertical" />
        </button>
        <ul class="dropdown-menu dropdown-menu-end">
          <li>
            <a class="dropdown-item text-danger" href="#" @click.prevent="revoking = [item]">
              <FaIcon icon="ban" class="me-2" />{{ t('apiTokens.revoke') }}
            </a>
          </li>
        </ul>
      </div>
    </template>
  </BsDataTable>
</template>
