<script setup>
/******************************************************************/
/*                                                                */
/*  The pager of a table in a record page's tab (its Forms, Jobs, */
/*  Users... ) : as a list's - the rows shown at the left, the    */
/*  page size and the page boxes at the right - under the page's  */
/*  card (AppSettings' 'afPagerTo'), else under the table.        */
/*  The page is kept in the address (?page=2), so a reload or     */
/*  Back shows that page of that tab ; the page size is one for   */
/*  every tab (a cookie, BsPagination).                           */
/*                                                                */
/*  @props:                                                       */
/*      items: Array - every row of the table                     */
/*  @emit:                                                        */
/*      change: Array - the rows of the page shown                */
/*                                                                */
/******************************************************************/
import { ref, computed, inject } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  items: { type: Array, required: true },
});
const emit = defineEmits(['change']);
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
// where the pager goes : under the page's card (AppSettings), else right here under the table
const pagerTo = inject('afPagerTo', null);

// the page the address names ; 1 without one
const page = computed(() => Math.max(1, parseInt(route.query.page, 10) || 1));
// the rows shown and the page size, as the pager says them
const shown = ref({ from: 0, count: 0 });

/**
 * The pager changed page or size : the rows of the page to the table, the page to the address
 * (none for the first).
 *
 * Args:
 *   rows (Array): the rows of the page.
 *   state (object): { page, pageSize }.
 */
function onChange(rows, state) {
  shown.value = { from: (state.page - 1) * state.pageSize + 1, count: rows.length };
  emit('change', rows);
  const wanted = state.page > 1 ? String(state.page) : undefined;
  if ((route.query.page || undefined) !== wanted) {
    router.replace({ path: route.path, query: { ...route.query, page: wanted } });
  }
}

// 1-25 of 140, as a list's
const range = computed(() => {
  const total = props.items.length;
  if (!total || !shown.value.count) return t('dataTable.rangeOf', { from: 0, to: 0, total });
  return t('dataTable.rangeOf', { from: shown.value.from, to: shown.value.from + shown.value.count - 1, total });
});
</script>
<template>
  <Teleport defer :to="pagerTo || 'body'" :disabled="!pagerTo">
    <div class="af-table-pager" :class="{ 'af-table-pager-inline': !pagerTo }">
      <span class="af-table-count">{{ range }}</span>
      <BsPagination
        :dataList="items"
        :perPage="10"
        :buttonsShown="7"
        name="record_tabs"
        :currentPage="page"
        @change="onChange"
      />
    </div>
  </Teleport>
</template>
