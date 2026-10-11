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
/*                                                                */
/******************************************************************/
import { useRouter } from 'vue-router';
import { useCellPopovers } from '@/composables/useCellPopovers';

const props = defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, required: true },
  rowKey: { type: String, default: 'id' },
  to: { type: Function, default: null },
  empty: { type: String, default: '' },
});

const router = useRouter();
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
          <th v-for="col in columns" :key="col.key" :class="col.class" :data-fit-keep="col.keep ? '' : null">
            {{ col.label }}
          </th>
          <!-- the room left, after the last column (v-fit-columns) -->
          <th class="af-fit-spacer"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row[rowKey]" :role="target(row) ? 'button' : null" @click="open(row)">
          <!-- the first cell names the item : a link's colour when the row opens it -->
          <td
            v-for="(col, i) in columns"
            :key="col.key"
            :class="[col.class, { 'af-row-open': i === 0 && target(row) }]"
          >
            <slot :name="`cell-${col.key}`" :row="row">
              <!-- eslint-disable-next-line vue/no-v-html -- html() is escaped by its column -->
              <span v-if="col.html" v-html="col.html(row)"></span>
              <template v-else>{{ text(col, row) }}</template>
            </slot>
          </td>
          <td class="af-fit-spacer"></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
