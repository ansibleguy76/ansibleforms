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
/*  (AppTablePager : the page in the address).                    */
/*                                                                */
/******************************************************************/
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useCellPopovers } from '@/composables/useCellPopovers';

const props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, required: true },
  rowKey: { type: String, default: 'id' },
  to: { type: Function, default: null },
  empty: { type: String, default: '' },
  children: { type: Function, default: null },
  childrenBefore: { type: String, default: '' },
});

const router = useRouter();
// the rows of the page shown (AppTablePager) ; the first page's until it says
const pageRows = ref(null);
const shownRows = computed(() => pageRows.value ?? props.rows.slice(0, 25));
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
  <p v-if="!rows.length" class="text-muted small mb-0">{{ empty }}</p>
  <div v-else class="af-table-frame">
    <table v-fit-columns class="table af-table" @mouseover="onCellHover">
      <thead>
        <tr>
          <template v-for="col in columns" :key="col.key">
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
          @click="open(row)"
        >
          <template v-for="(col, i) in columns" :key="col.key">
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
      </tbody>
    </table>
  </div>
  <!-- the rows shown, the page size and the pages, under the table as a list's -->
  <AppTablePager v-if="rows.length" :items="rows" @change="(r) => (pageRows = r)" />
</template>
