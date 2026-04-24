<script setup>

/******************************************************************/
/*                                                                */
/*  AppListField - list of rows, each row edited via a subform    */
/*  pane that replaces the main form (drilldown pattern).         */
/*  Arbitrarily deep nesting is supported by delegating the edit  */
/*  stack to the root page via `provide('formEditStack')`.        */
/*                                                                */
/*  @props:                                                       */
/*      field: Object         (the parent list field definition)  */
/*      subform: Object       (target subform definition)         */
/*      subforms: Array       (all subforms inlined by server)    */
/*      constants: Object     (form constants, pass-through)      */
/*      hasError: Boolean                                         */
/*      errors: Array                                             */
/*      help: String                                              */
/*      modelValue: Array     (v-model, list of row objects)      */
/*                                                                */
/*  @emits:                                                       */
/*      update:modelValue                                         */
/*                                                                */
/******************************************************************/

import { ref, computed, watch, inject } from 'vue';

const props = defineProps({
    field: { type: Object, required: true },
    subform: { type: Object, default: null },
    subforms: { type: Array, default: () => [] },
    constants: { type: Object, default: () => ({}) },
    hasError: { type: Boolean, default: false },
    errors: { type: Array, default: () => [] },
    help: { type: String, default: '' },
    modelValue: { type: Array, default: () => [] },
});

const emit = defineEmits(['update:modelValue']);

// Local rows state synchronised with v-model.
const rows = ref(Array.isArray(props.modelValue) ? [...props.modelValue] : []);

watch(() => props.modelValue, (v) => {
    rows.value = Array.isArray(v) ? [...v] : [];
}, { deep: true });

function commit() {
    emit('update:modelValue', rows.value);
}

// Markers (row state tracking) - same semantics as AppTableField.
// If `allowDelete: false` or a `deleteMarker` is configured but no
// `insertMarker` is provided, fall back to `__inserted__` so freshly added
// rows remain fully removable (locked rows are the pre-existing ones).
const insertMarker = computed(() => {
    if (props.field.insertMarker) return props.field.insertMarker;
    if (props.field.allowDelete === false || props.field.deleteMarker || props.field.updateMarker) {
        return '__inserted__';
    }
    return '';
});
const updateMarker = computed(() => props.field.updateMarker || '');
const deleteMarker = computed(() => props.field.deleteMarker || '');
const allowInsert = computed(() => props.field.allowInsert !== false);
const allowDelete = computed(() => props.field.allowDelete !== false);

// Visible rows with their original index preserved.
const visibleRows = computed(() => rows.value.map((row, index) => ({ row, index })));

// Resolve the list of columns to display. Authors can pick a subset via
// `field.columns` (array of field-name strings). Unknown names are kept so
// authors can expose arbitrary data keys that aren't declared subform fields
// - the cell renderer falls back to a generic stringifier for those.
const columns = computed(() => {
    const subfields = props.subform?.fields || [];
    const byName = Object.fromEntries(subfields.map(f => [f.name, f]));
    if (Array.isArray(props.field.columns) && props.field.columns.length > 0) {
        return props.field.columns.map(name => byName[name] || { name, label: name, _unknown: true });
    }
    return subfields.filter(f => !f.hide && f.type !== 'local' && f.type !== 'local_out');
});

// Cell rendering descriptor. Returns `{ kind, value }` where kind is one of:
//   'blank'  - empty string (rendered as nothing)
//   'null'   - null/undefined (rendered as italic 'null' badge)
//   'bool'   - checkbox-like icon
//   'count'  - array length (N items)
//   'object' - object literal (rendered as italic '{object}' badge)
//   'text'   - plain string
function cellData(row, f) {
    const v = row?.[f.name];
    if (v === undefined || v === null) return { kind: 'null' };
    if (v === '') return { kind: 'blank' };
    const type = f._unknown ? undefined : f.type;
    if (type === 'checkbox' || typeof v === 'boolean') {
        return { kind: 'bool', value: !!v };
    }
    if (type === 'list' || type === 'table' || Array.isArray(v)) {
        if (Array.isArray(v)) {
            if (v.length === 0) return { kind: 'count', value: '0 items' };
            if (v.every(x => x == null || typeof x !== 'object')) {
                return { kind: 'text', value: v.filter(x => x != null).map(String).join(', ') };
            }
            return { kind: 'count', value: `${v.length} item${v.length === 1 ? '' : 's'}` };
        }
        return { kind: 'null' };
    }
    if (type === 'password') {
        return { kind: 'text', value: '•'.repeat(String(v).length) };
    }
    if (typeof v === 'object') {
        if (f.valueColumn && v[f.valueColumn] != null) {
            return { kind: 'text', value: String(v[f.valueColumn]) };
        }
        return { kind: 'object' };
    }
    return { kind: 'text', value: String(v) };
}

// Injected by the page-level orchestrator (see pages/form.vue). Provides
// push/pop operations for the tab stack. If missing (e.g. designer preview),
// fall back to no-op so the field still renders.
const editStack = inject('formEditStack', null);

function openEditor({ row, index }) {
    if (!editStack || !props.subform) return;
    const isAdd = index == null;
    // Tab title is always the parent list-field label (e.g. "People",
    // "Addresses") - short and consistent. The Add/Edit distinction is
    // shown as a subtitle inside the subform pane. Authors can override
    // via the field's `titleAdd` / `titleEdit` properties.
    const title = props.field.label || props.field.name || props.subform.description || props.subform.name;
    const subtitle = isAdd
        ? (props.field.titleAdd || `Add ${title}`)
        : (props.field.titleEdit || `Edit ${title}`);
    editStack.push({
        title,
        subtitle,
        subform: props.subform,
        row: row || defaultRow(),
        onSave: (value) => applySave(value, index),
    });
}

function defaultRow() {
    const fresh = {};
    for (const f of (props.subform?.fields || [])) {
        if (f.default !== undefined) fresh[f.name] = f.default;
        else if (f.type === 'list') fresh[f.name] = [];
    }
    return fresh;
}

function applySave(value, index) {
    const isAdd = index == null;
    if (isAdd) {
        if (insertMarker.value) value[insertMarker.value] = true;
        rows.value.push(value);
    } else {
        const existing = rows.value[index] || {};
        if (insertMarker.value && existing[insertMarker.value]) {
            value[insertMarker.value] = true;
        } else if (updateMarker.value) {
            value[updateMarker.value] = true;
        }
        rows.value.splice(index, 1, value);
    }
    commit();
}

function removeItem(index) {
    const row = rows.value[index];
    if (!row) return;
    if (insertMarker.value && row[insertMarker.value]) {
        rows.value.splice(index, 1);
    } else if (deleteMarker.value) {
        rows.value.splice(index, 1, { ...row, [deleteMarker.value]: true });
    } else {
        rows.value.splice(index, 1);
    }
    commit();
}

function undoRemove(index) {
    const row = rows.value[index];
    if (!row || !deleteMarker.value) return;
    const copy = { ...row };
    delete copy[deleteMarker.value];
    rows.value.splice(index, 1, copy);
    commit();
}

function isDeleted(row) {
    return deleteMarker.value && row[deleteMarker.value];
}

// When deletion is disabled, you can still delete rows you added in this
// session (i.e. rows carrying the insertMarker). Mirrors AppTableField.
function canDelete(row) {
    if (allowDelete.value) return true;
    if (insertMarker.value && row && row[insertMarker.value]) return true;
    return false;
}
</script>

<template>
    <div>
        <!-- Missing subform placeholder -->
        <div v-if="!subform" class="alert alert-danger">
            Subform <code>{{ field.subform }}</code> referenced by field
            <code>{{ field.name }}</code> was not found.
        </div>

        <template v-else>
            <div class="form-control" :class="{ 'is-invalid': hasError }">
                <table class="table table-bordered mb-0">
                    <thead>
                        <tr>
                            <th style="width: 6rem">Actions</th>
                            <th v-for="col in columns" :key="'list-th-' + col.name" class="bg-primary-subtle">
                                {{ col.label || col.name }}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="{ row, index } in visibleRows" :key="'list-row-' + index"
                            :class="{ 'list-row-deleted': isDeleted(row) }">
                            <td>
                                <template v-if="isDeleted(row)">
                                    <span class="me-2 text-secondary"><font-awesome-icon icon="pencil-alt" /></span>
                                    <span class="me-2 text-success" role="button"
                                        @click="undoRemove(index)"><font-awesome-icon icon="undo" /></span>
                                </template>
                                <template v-else>
                                    <span role="button" class="me-2 text-orange"
                                        @click="openEditor({ row, index })"><font-awesome-icon icon="pencil-alt" /></span>
                                    <span role="button" class="me-2"
                                        :class="canDelete(row) ? 'text-danger' : 'text-secondary'"
                                        @click="canDelete(row) && removeItem(index)"><font-awesome-icon icon="times" /></span>
                                </template>
                            </td>
                            <td v-for="col in columns" :key="'list-td-' + col.name + '-' + index" :class="col.bodyClass">
                                <template v-if="cellData(row, col).kind === 'blank'"></template>
                                <template v-else-if="cellData(row, col).kind === 'null'">
                                    <span class="badge bg-secondary-subtle text-body-secondary">null</span>
                                </template>
                                <template v-else-if="cellData(row, col).kind === 'bool'">
                                    <font-awesome-icon :icon="cellData(row, col).value ? ['far', 'check-square'] : ['far', 'square']" />
                                </template>
                                <template v-else-if="cellData(row, col).kind === 'count'">
                                    <span class="badge bg-secondary-subtle text-body-secondary">{{ cellData(row, col).value }}</span>
                                </template>
                                <template v-else-if="cellData(row, col).kind === 'object'">
                                    <span class="badge bg-secondary-subtle text-body-secondary">object</span>
                                </template>
                                <template v-else>{{ cellData(row, col).value }}</template>
                            </td>
                        </tr>
                        <tr v-if="allowInsert">
                            <td>
                                <span role="button" class="me-2 text-success"
                                    @click="openEditor({ row: null, index: null })"><font-awesome-icon icon="plus-square" /></span>
                            </td>
                            <td v-for="col in columns" :key="'list-add-' + col.name" class="bg-secondary-subtle"></td>
                        </tr>
                        <tr v-if="!allowInsert && rows.length === 0">
                            <td :colspan="columns.length + 1" class="text-muted">No items</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div v-if="hasError && errors.length > 0" class="invalid-feedback">
                {{ errors[0].$message || errors[0].$params?.description || errors[0] }}
            </div>
            <div class="form-text" v-if="help">{{ help }}</div>
        </template>
    </div>
</template>

<style scoped>
/* Soft-deleted rows: muted text with strikethrough on data cells.
   The first cell (actions column) keeps normal styling so the undo icon
   stays clearly tappable. */
.list-row-deleted > td {
    color: var(--bs-secondary-color);
    background-color: var(--bs-secondary-bg-subtle);
    text-decoration: line-through;
    text-decoration-color: var(--bs-secondary);
}
.list-row-deleted > td:first-child {
    text-decoration: none;
}
</style>
