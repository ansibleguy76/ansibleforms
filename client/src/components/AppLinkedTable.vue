<script setup>
/******************************************************************/
/*                                                                */
/*  A read-only table of the items linked to a settings page's    */
/*  record : a user's stored jobs, a role's forms, a runner's     */
/*  jobs... A row opens its item when `to` gives it an address ;  */
/*  none linked, a short note says so.                            */
/*                                                                */
/*  columns: [{ key, label, value?(row), html?(row), class?,      */
/*    keep? }] - keep : never cut (a date, a status), the others  */
/*    give way                                                    */
/*    value - the cell's text (default row[key]) ; html - its     */
/*    html instead, escaped by the caller (a cron and its hover)  */
/*    a cell slot #cell-<key>="{ row }" draws a cell itself (a    */
/*    status pill)                                                */
/*  rows: the items ; rowKey: the field that keys a row (id)      */
/*  to: (row) => an address, or null for a row that opens nothing */
/*  empty: the note shown with no rows                            */
/*  children: (row) => its rows, or null - a row that has some    */
/*    unfolds them under it with a caret (a multistep job's       */
/*    steps), right while folded and down once they show ;        */
/*  childrenBefore: the column the caret's own column goes before */
/*    (the form), as the jobs list's                              */
/*  The rows a page at a time, the pager under the table          */
/*  (AppTablePager : the page in the address). Its controls, as a */
/*  list's, on the page's title line (AppSettings' 'afToolbarTo') */
/*  : a filter on every column, the columns shown, the export to  */
/*  CSV (named after exportName, else none).                      */
/*  exportName: the CSV file's name                               */
/*  Each row has its checkbox, as a list's : Select all and Clear */
/*  selection on the title line, the export then of the rows      */
/*  ticked ; a slot #bulk-actions="{ selected, count }" adds what */
/*  the page does with them.                                      */
/*                                                                */
/******************************************************************/
import { ref, computed, inject } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useCellPopovers } from '@/composables/useCellPopovers';
import { csvCell, htmlToText } from '@/lib/dataTable';
import BsSearch from './BsSearch.vue';
import BsColumnPicker from './BsColumnPicker.vue';

const props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, required: true },
  rowKey: { type: String, default: 'id' },
  to: { type: Function, default: null },
  empty: { type: String, default: '' },
  children: { type: Function, default: null },
  childrenBefore: { type: String, default: '' },
  exportName: { type: String, default: '' },
});
const { t } = useI18n();

// ─── the controls : on the page's title line, as a list's ─────────────────────
const toolbarTo = inject('afToolbarTo', null);
// the filter : a row is kept when one of its cells has the text (case aside)
const filter = ref('');
// the columns the picker hid
const hidden = ref(new Set());
const shownColumns = computed(() => props.columns.filter((c) => !hidden.value.has(c.key)));
/**
 * A cell's plain text : its column's value(), its html() without the tags, or its field.
 *
 * Args:
 *   col (object): the column.
 *   row (object): the item.
 *
 * Returns:
 *   string: the text, empty for none.
 */
function plain(col, row) {
  const v = col.html ? htmlToText(col.html(row)) : col.value ? col.value(row) : row[col.key];
  return v === null || v === undefined ? '' : String(v);
}
const filteredRows = computed(() => {
  const q = filter.value.trim().toLowerCase();
  if (!q) return props.rows;
  return props.rows.filter((row) => props.columns.some((col) => plain(col, row).toLowerCase().includes(q)));
});
/**
 * Shows or hides a column (the picker's tick).
 *
 * Args:
 *   key (string): the column's key.
 */
function toggleColumn(key) {
  const set = new Set(hidden.value);
  if (set.has(key)) set.delete(key);
  else set.add(key);
  hidden.value = set;
}
/**
 * Hides the columns of a preset of the picker.
 *
 * Args:
 *   keys (string[]): the columns it hides.
 */
function applyPreset(keys) {
  hidden.value = new Set(keys);
}
// ─── the rows ticked (their key), as a list's ─────────────────────────────────
const selected = ref(new Set());
const selectedRows = computed(() => props.rows.filter((r) => selected.value.has(r[props.rowKey])));
const allShownTicked = computed(
  () => shownRows.value.length > 0 && shownRows.value.every((r) => selected.value.has(r[props.rowKey])),
);
/**
 * Ticks or unticks a row.
 *
 * Args:
 *   row (object): the item.
 */
function tick(row) {
  const set = new Set(selected.value);
  const key = row[props.rowKey];
  if (set.has(key)) set.delete(key);
  else set.add(key);
  selected.value = set;
}
/**
 * The header's box : ticks the rows of the page shown, or unticks them when they all are.
 */
function tickPage() {
  const set = new Set(selected.value);
  const keys = shownRows.value.map((r) => r[props.rowKey]);
  if (allShownTicked.value) keys.forEach((k) => set.delete(k));
  else keys.forEach((k) => set.add(k));
  selected.value = set;
}
/**
 * Select all : every row the filter keeps.
 */
function selectAll() {
  selected.value = new Set(filteredRows.value.map((r) => r[props.rowKey]));
}

/**
 * Saves the rows as a CSV file, the columns shown : those ticked, else those the filter keeps.
 */
function exportCsv() {
  const cols = shownColumns.value;
  const lines = [cols.map((c) => csvCell(c.label)).join(',')];
  const rows = selectedRows.value.length ? selectedRows.value : filteredRows.value;
  for (const row of rows) lines.push(cols.map((c) => csvCell(plain(c, row))).join(','));
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${props.exportName || 'export'}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

const router = useRouter();
// the rows of the page shown (AppTablePager) ; the first page's until it says
const pageRows = ref(null);
const shownRows = computed(() => pageRows.value ?? filteredRows.value.slice(0, 25));
// the rows unfolded (their key) ; the rows drawn : each row of the page, its children under it
// when unfolded
const unfolded = ref(new Set());
const drawnRows = computed(() => {
  const out = [];
  for (const row of shownRows.value) {
    out.push({ row, child: false });
    if (props.children && unfolded.value.has(row[props.rowKey])) {
      for (const c of props.children(row) || []) out.push({ row: c, child: true });
    }
  }
  return out;
});

/**
 * Whether a row unfolds : it has children.
 *
 * Args:
 *   row (object): the item.
 *
 * Returns:
 *   boolean: true when it has some.
 */
function foldable(row) {
  return !!props.children && (props.children(row) || []).length > 0;
}

/**
 * Unfolds a row's children, or folds them back.
 *
 * Args:
 *   row (object): the item.
 */
function toggle(row) {
  const set = new Set(unfolded.value);
  const key = row[props.rowKey];
  if (set.has(key)) set.delete(key);
  else set.add(key);
  unfolded.value = set;
}

// a cell that has more to say (data-af-popover, a cron's meaning) : its text on hover
const { onCellHover } = useCellPopovers();

/**
 * The address a row opens, if any.
 *
 * Args:
 *   row (object): the item.
 *
 * Returns:
 *   string|object|null: the address, or null.
 */
function target(row) {
  return props.to ? props.to(row) : null;
}

/**
 * Opens a row's item.
 *
 * Args:
 *   row (object): the item.
 */
function open(row) {
  const to = target(row);
  if (to) router.push(to);
}

/**
 * A cell's text : its column's value(), or the field of its key ; an en dash for none.
 *
 * Args:
 *   col (object): the column.
 *   row (object): the item.
 *
 * Returns:
 *   string: the text.
 */
function text(col, row) {
  const v = col.value ? col.value(row) : row[col.key];
  return v === null || v === undefined || v === '' ? '–' : String(v);
}
</script>
<template>
  <!-- the controls, on the title line : the filter at its left, the columns and the export -->
  <Teleport v-if="toolbarTo" defer :to="toolbarTo">
    <div class="d-flex align-items-center gap-2 bs-dt-toolbar-moved flex-wrap">
      <BsSearch v-model="filter" class="af-table-search" />
      <!-- the selection : how many, Clear selection, Select all, and what the page does with them -->
      <span v-if="selected.size" class="text-muted small">{{ selected.size }} {{ t('dataTable.selected') }}</span>
      <button v-if="selected.size" class="btn btn-outline-primary" @click="selected = new Set()">
        <FaIcon icon="xmark" class="me-1" />{{ t('dataTable.clearSelection') }}
      </button>
      <button v-if="selected.size < filteredRows.length" class="btn btn-outline-primary" @click="selectAll">
        <FaIcon icon="check-double" class="me-1" />{{ t('dataTable.selectAll', { count: filteredRows.length }) }}
      </button>
      <slot name="bulk-actions" :selected="selectedRows" :count="selected.size" />
      <div class="ms-auto d-flex align-items-center gap-2">
        <BsColumnPicker
          :columns="columns"
          :hidden="hidden"
          buttonClass="btn-outline-primary"
          @toggle="toggleColumn"
          @apply="applyPreset"
        />
        <button v-if="exportName" class="btn btn-outline-primary" @click="exportCsv">
          <FaIcon icon="file-csv" class="me-1" />{{ t('dataTable.export') }}
        </button>
      </div>
    </div>
  </Teleport>
  <!-- always a table, as every list : none linked, its note in it -->
  <div class="af-table-frame">
    <table v-fit-columns class="table af-table" @mouseover="onCellHover">
      <thead>
        <tr>
          <!-- the page's rows ticked at once -->
          <th class="text-center bs-dt-select">
            <input
              type="checkbox"
              class="form-check-input"
              :checked="allShownTicked"
              :indeterminate="selected.size > 0 && !allShownTicked"
              @change="tickPage"
            />
          </th>
          <template v-for="col in shownColumns" :key="col.key">
            <!-- the caret's own column, before its column (a job's form) -->
            <th v-if="children && col.key === childrenBefore" class="af-expand-col"></th>
            <th :class="col.class" :data-fit-keep="col.keep ? '' : null">
              {{ col.label }}
            </th>
          </template>
          <!-- the room left, after the last column (v-fit-columns) -->
          <th class="af-fit-spacer"></th>
        </tr>
      </thead>
      <tbody>
        <!-- a row, and under it its children when unfolded (a step's first cell marked, as the
             jobs list's) -->
        <tr
          v-for="{ row, child } in drawnRows"
          :key="(child ? 'c/' : '') + row[rowKey]"
          :role="target(row) ? 'button' : null"
          :class="{ 'bs-dt-selected': !child && selected.has(row[rowKey]) }"
          @click="open(row)"
        >
          <!-- its box (a step under a job has none : the job is ticked) -->
          <td class="text-center bs-dt-select" @click.stop>
            <input
              v-if="!child"
              type="checkbox"
              class="form-check-input"
              :checked="selected.has(row[rowKey])"
              @change="tick(row)"
            />
          </td>
          <template v-for="(col, i) in shownColumns" :key="col.key">
            <!-- the caret : its cell unfolds the row (the rest of the row opens it) -->
            <td
              v-if="children && col.key === childrenBefore"
              class="af-expand-col text-center"
              :role="!child && foldable(row) ? 'button' : null"
              @click.stop="!child && foldable(row) ? toggle(row) : open(row)"
            >
              <FaIcon
                v-if="!child && foldable(row)"
                :icon="unfolded.has(row[rowKey]) ? 'angle-down' : 'angle-right'"
                :fixedwidth="true"
              />
            </td>
            <!-- the first cell names the item : a link's colour when the row opens it -->
            <td :class="[col.class, { 'af-row-open': i === 0 && target(row), 'af-child-row': i === 0 && child }]">
              <slot :name="`cell-${col.key}`" :row="row">
                <!-- eslint-disable-next-line vue/no-v-html -- html() is escaped by its column -->
                <span v-if="col.html" v-html="col.html(row)"></span>
                <template v-else>{{ text(col, row) }}</template>
              </slot>
            </td>
          </template>
          <td class="af-fit-spacer"></td>
        </tr>
        <!-- none : the page's note (no job yet...), or none the filter keeps -->
        <tr v-if="!drawnRows.length">
          <td :colspan="shownColumns.length + (children ? 3 : 2)" class="text-center text-muted py-3">
            {{ rows.length ? t('common.noData') : empty || t('common.noData') }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <!-- the rows shown, the page size and the pages, under the table as a list's -->
  <AppTablePager :items="filteredRows" @change="(r) => (pageRows = r)" />
</template>
