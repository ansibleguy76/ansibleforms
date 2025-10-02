<script setup>

/******************************************************************/
/*                                                                */
/*  App AnsibleForms Form Input Table Field component             */
/*                                                                */
/*  @props:                                                       */
/*      tableFields: Array                                        */
/*      tableClass: String                                        */
/*      click: Boolean                                            */
/*      form: Object                                              */
/*      dynamicFieldStatus: Object                                */
/*      values: Array                                             */
/*      isLoading: Boolean                                        */
/*      allowInsert: Boolean                                      */
/*      allowDelete: Boolean                                      */
/*      deleteMarker: String                                      */
/*      insertMarker: String                                      */
/*      updateMarker: String                                      */
/*      readonlyColumns: Array                                    */
/*      insertColumns: Array                                      */
/*      hasError: Boolean                                         */
/*                                                                */
/*  @emits:                                                       */
/*      update:model-value                                        */
/*      warning                                                   */
/*      row-click                                                 */
/*                                                                */
/******************************************************************/


import { useVuelidate } from '@vuelidate/core';
import { required, helpers, sameAs } from "@vuelidate/validators";
import Helpers from '@/lib/Helpers';

// INIT

var v$ = null;

const emit = defineEmits(['update:model-value', 'warning', 'row-click']);

// PROPS

const props = defineProps({
    tableFields: {
        type: Array,
        required: true
    },
    tableClass: {
        type: String,
        required: false,
        default: 'table table-bordered'
    },
    click: {
        required: false,
        type: Boolean,
        default: false
    },
    form: {
        required: true,
        type: Object
    },
    dynamicFieldStatus: {
        required: true,
        type: Object
    },
    values: {},
    isLoading: { type: Boolean },
    allowInsert: { type: Boolean, default: true },
    allowDelete: { type: Boolean, default: true },
    deleteMarker: { type: String, default: "" },
    insertMarker: { type: String, default: "" },
    updateMarker: { type: String, default: "" },
    readonlyColumns: { type: Array },
    insertColumns: { type: Array },
    hasError: { type: Boolean }
});


// DATA

const sort = ref({
    field: '',
    desc: true
});

const rows = ref(undefined);
const editedItem = ref({});
const showEdit = ref(false);
const action = ref("");
const editIndex = ref(-1);
const insert_marker = ref(undefined);

// COMPUTED

// validation rules for each field in the form
const rules = computed(() => {
    const ruleObj = { editedItem: {} } // holdes the rules for each field
    props.tableFields.forEach((ff, i) => {
        var rule = {} // holds the rules for a single field

        // required but not for checkboxes, expressions and enums, where we simply expect a value to be present
        if (ff.type != 'checkbox' && ff.type != 'enum' && ff.required) {
            rule.required = helpers.withMessage(`${ff.label} is required`, required)
        }
        // required for checkboxes (we required the value to be true)
        if (ff.type == 'checkbox' && ff.required) {
            rule.checkboxRequired = helpers.withMessage(`${ff.label} is required`, sameAs(computed(() => true)))
        }
        // required for expressions and enums, the value must be present, but can be a special value like __auto__, __none__ or __all__
        if ((ff.type == 'enum') && ff.required) {
            var description = `${ff.label} is required`
            rule.required = helpers.withParams(
                { description: description, type: "required" },
                (value) => (value != undefined && value != null && value != '__auto__' && value != '__none__' && value != '__all__')
            )
        }
        // min and max value for numbers
        if ("minValue" in ff) {
            var description = `${ff.label} must be at least ${ff.minValue}`
            rule.minValue = helpers.withParams(
                { description: description, type: "minValue" },
                (value) => !helpers.req(value) || value >= ff.minValue
            )
        }
        if ("maxValue" in ff) {
            var description = `${ff.label} must be at most ${ff.maxValue}`
            rule.maxValue = helpers.withParams(
                { description: description, type: "maxValue" },
                (value) => !helpers.req(value) || value <= ff.maxValue
            )
        }
        // min and max length for strings
        if ("minLength" in ff) {
            var description = `${ff.label} must be at least ${ff.minLength} characters long`
            rule.minLength = helpers.withParams(
                { description: description, type: "minLength" },
                (value) => !helpers.req(value) || value.length >= ff.minLength
            )
        }
        if ("maxLength" in ff) {
            var description = `${ff.label} must be at most ${ff.maxLength} characters long`
            rule.maxLength = helpers.withParams(
                { description: description, type: "maxLength" },
                (value) => !helpers.req(value) || value.length <= ff.maxLength
            )
        }
        // regex validation
        if ("regex" in ff) {
            var regexObj = new RegExp(ff.regex.expression)
            var description = ff.regex.description
            if (ff.type == 'file') {
                rule.regex = helpers.withParams(
                    { description: description, type: "regex" },
                    (file) => !helpers.req(file?.name) || regexObj.test(file?.name)
                )
            } else {
                rule.regex = helpers.withParams(
                    { description: description, type: "regex" },
                    (value) => !helpers.req(value) || regexObj.test(value)
                )
            }
        }
        // notIn and in
        if ("notIn" in ff) {
            var description = ff.notIn.description
            rule.notIn = helpers.withParams(
                { description: description, type: "notIn" },
                (value) => !helpers.req(value) || (form.value[ff.notIn.ff] != undefined && Array.isArray(form.value[ff.notIn.ff]) && !form.value[ff.notIn.ff].includes(value))
            )
        }
        if ("in" in ff) {
            var description = ff.in.description
            rule.in = helpers.withParams(
                { description: description, type: "in" },
                (value) => !helpers.req(value) || (form.value[ff.in.ff] != undefined && Array.isArray(form.value[ff.in.ff]) && form.value[ff.in.ff].includes(value))
            )
        }
        if ("sameAs" in ff) {
            var description = `Must match the field '${currentForm.value.fields.find((x) => ff.sameAs == x.name).label || ff.sameAs}'`
            rule.sameAs = helpers.withParams(
                { description: description, type: "sameAs" },
                (value) => !helpers.req(value) || (form.value[ff.sameAs] != undefined && value == form.value[ff.sameAs])
            )
        }

        ruleObj.editedItem[ff.name] = rule
    })
    return ruleObj
});

const editFields = computed(() => {
    return props.tableFields.filter(x => (action.value != "Add" || props.insertColumns.length == 0 || props.insertColumns.includes(x.name)));
});

const getTableClass = computed(() => {
    let tmp = props.tableClass;
    if (props.hasError) {
        tmp += " hasError";
    }
    return tmp;
});

// WATCHERS

watch(
    () => props.values,
    (newValues) => {
        rows.value = newValues;
        if (newValues?.length > 0) {
            const fields = props.tableFields.map(x => x.name);
            const data = Object.keys(newValues[0]);
            // const missing = Helpers.findMissing(data, fields);
            // if (missing.length > 0) {
            //     emit('warning', missing);
            // }
        }
    },
    { immediate: true }
);

// METHODS

function getValueLabel(field) {
    if (field) {
        if (field.valueColumn) {
            return field.valueColumn;
        }
        if (field.columns && field.columns.length > 0) {
            return field.columns[0];
        }
        if (typeof editedItem.value[field.name] == "object") {
            try {
                if (Object.keys(editedItem.value[field.name]) && Object.keys(editedItem.value[field.name]).length > 0) {
                    return Object.keys(editedItem.value[field.name])[0];
                }
            } catch (e) {
                return undefined;
            }
        }
        return undefined;
    } else {
        return undefined;
    }
}

function stringify(v, field = undefined) {
    var valueLabel;
    if (v) {
        if (Array.isArray(v)) {
            return "[ Array ]";
        }
        if (typeof v == "object") {
            valueLabel = getValueLabel(field);
            if (valueLabel)
                return v[valueLabel];
            return "{ Object }";
        }
        return v.toString();
    } else {
        return v;
    }
}

function addItem(index) {
    updateEditedItem({});
    props.tableFields.forEach((item) => {
        editedItem.value[item.name] = item.default;
    });
    action.value = "Add";
    editIndex.value = index;
    openOffCanvas();
}

function editItem(index) {
    updateEditedItem(rows.value[index]);
    action.value = "Edit";
    editIndex.value = index;
    openOffCanvas();
}

function removeItem(index) {
    if (!props.deleteMarker) {
        rows.value.splice(index, 1);
    } else {
        var tmp = rows.value[index];
        if (tmp[insert_marker.value]) {
            rows.value.splice(index, 1);
        } else {
            tmp[props.deleteMarker] = true;
            rows.value[index] = tmp;
        }
    }
    emit('update:model-value', rows.value);
}

function undoRemoveItem(index) {
    var tmp = rows.value[index];
    delete tmp[props.deleteMarker];
    rows.value[index] = tmp;
    emit('update:model-value', rows.value);
}

function saveItem() {
    v$.value.editedItem.$touch();

    if (!v$.value.editedItem.$invalid) {
        if (action.value == "Add") {
            if (insert_marker.value) {
                editedItem.value[insert_marker.value] = true;
            }
            if (editIndex.value < 0) {
                rows.value.push(editedItem.value);
            } else {
                rows.value.splice(editIndex.value, 0, editedItem.value);
            }
        } else {
            if (props.updateMarker && !editedItem.value[props.updateMarker] && !editedItem.value[insert_marker.value]) {
                // compare original and edited item
                const original = rows.value[editIndex.value];
                const edited = editedItem.value;
                if (JSON.stringify(original) !== JSON.stringify(edited)) {
                    editedItem.value[props.updateMarker] = true; // mark as updated
                }
            }
            rows.value[editIndex.value] = editedItem.value;
        }
        emit('update:model-value', rows.value);
        closeOffCanvas();
        // reset editedItem
        updateEditedItem(undefined);
    }
}

function rowClick(row) {
    if (props.click) emit('row-click', row);
}

function updateEditedItem(value) {
    editedItem.value = Helpers.deepClone(value);
    v$.value.editedItem.$touch();
}

function openOffCanvas() {
    showEdit.value = true;
}

function closeOffCanvas() {
    updateEditedItem(undefined);
    showEdit.value = false;
}

function init() {

    insert_marker.value = props.insertMarker;
    // force insert marker if delete marker is set, we need to have an insert marker
    if ((props.deleteMarker || !props.allowDelete) && (!insert_marker.value || insert_marker.value.length == 0)) {
        insert_marker.value = "__inserted__";
    }
    // force insert marker if update marker is set, we need to have an insert marker
    if (props.updateMarker && (!insert_marker.value || insert_marker.value.length == 0)) {
        insert_marker.value = "__inserted__";
    }

    rows.value = props.values;

}

// HOOKS

onMounted(() => {
    v$ = useVuelidate(rules, { editedItem }); // use vuelidate, form is a ref that holds the form data
    init();
});

</script>
<template>
    <div>

        <!-- EDIT FORM -->
        <BsOffCanvas :show="showEdit" :title="action" @close="closeOffCanvas()">
            <template #actions>
                <BsButton icon="save" @click="saveItem()">Save</BsButton>
            </template>
            <template #default v-if="!!v$?.editedItem?.$model">

                <div v-for="field, index in editFields" :key="field.name" class="mt-3">

                    <!-- FIELD LABEL -->
                    <label class="flex-grow-1 fw-bold mb-2"
                        :class="{ 'text-body': !field.hide, 'text-grey': field.hide }">{{ field.label || field.name }}
                        <span v-if="field.required" class="text-danger">*</span></label>

                    <!-- TYPE = TEXT, PASSWORD, TEXTAREA, NUMBER, CHECKBOX -->
                    <BsInputForForm
                        v-if="['text', 'password', 'textarea', 'number', 'checkbox', 'radio'].includes(field.type)"
                        :autofocus="index == 0" :hasError="v$.editedItem[field.name].$invalid"
                        v-model="v$.editedItem[field.name].$model" :name="field.name" v-bind="field.attrs"
                        :required="field.required" :type="field.type" :icon="field.icon" :readonly="field.hide"
                        :placeholder="field.placeholder" 
                        :isSwitch="field.switch"
                        :errors="v$.editedItem[field.name].$errors" 
                        :values="field.values" 
                        :help="field.help"
                        />
                    <BsInputForForm v-if="field.type == 'enum'" type="select"
                        :defaultValue="v$.editedItem[field.name].$model || field.default || ''"
                        :required="field.required || false" :multiple="field.multiple || false" :name="field.name"
                        :placeholder="field.placeholder || 'Select...'" :values="field.values || form[field.from] || []"
                        :hasError="v$.editedItem[field.name].$invalid"
                        :isLoading="!field.values && !['fixed', 'variable'].includes(dynamicFieldStatus[field.from])"
                        v-model="v$.editedItem[field.name].$model" :icon="field.icon" :columns="field.columns || []"
                        :pctColumns="field.pctColumns || []" :filterColumns="field.filterColumns || []"
                        :previewColumn="field.previewColumn || ''" :valueColumn="field.valueColumn || ''"
                        :sticky="field.sticky || false" :horizontal="field.horizontal || false"
                        :disabled="action == 'Edit' && readonlyColumns.includes(field.name)" :help="field.help" />
                </div>
            </template>
        </BsOffCanvas>



        <!-- TABLE -->

        <table :class="getTableClass">
            <thead>
                <tr>
                    <th>Actions</th>
                    <slot v-for="field in tableFields" :name="'table-header-' + field.name" :field="field">
                        <th class="bg-primary-subtle" :key="'table-header-' + field.name" :width="field.width || ''">
                            {{ field.label || field.name }}
                        </th>
                    </slot>
                </tr>
            </thead>
            <tbody>
                <template v-if="!isLoading">
                    <tr class="is-unselectable" v-for="row, index in rows" :key="'table-row-' + index"
                        @click="rowClick(row)">
                        <template v-if="deleteMarker && row[deleteMarker]">
                            <td>
                                <span class="me-2 text-secondary"><font-awesome-icon icon="plus-square" /></span>
                                <span class="me-2 text-secondary"><font-awesome-icon icon="pencil-alt" /></span>
                                <span class="me-2 text-success" role="button"
                                    @click="undoRemoveItem(index)"><font-awesome-icon icon="undo" /></span>
                            </td>
                            <slot name="table-body" :row="row">
                                <template v-for="field in tableFields" :key="'table-cell-' + field.name + '-' + index">
                                    <td class="text-secondary" v-if="field.type != 'checkbox'" :class="field.bodyClass">
                                        {{ stringify(row[field.name], field) }} </td>
                                    <td class="text-secondary" v-else :class="field.bodyClass"><font-awesome-icon
                                            :icon="(row[field.name]) ? ['far', 'check-square'] : ['far', 'square']" /></td>
                                </template>
                            </slot>
                        </template>
                        <template v-else>
                            <td>
                                <span role="button" class="me-2 text-success" v-if="allowInsert"
                                    @click="addItem(index)"><font-awesome-icon icon="plus-square" /></span>
                                <span role="button" class="me-2 text-orange" @click="editItem(index)"><font-awesome-icon
                                        icon="pencil-alt" /></span>
                                <span role="button" class="me-2 text-danger" v-if="allowDelete || row[insert_marker]"
                                    @click="removeItem(index)"><font-awesome-icon icon="times" /></span>
                                <span role="button" class="me-2 text-secondary" v-else><font-awesome-icon
                                        icon="times" /></span>
                            </td>
                            <slot name="table-body" :row="row">
                                <template v-for="field in tableFields" :key="'table-cell-' + field.name + '-' + index">
                                    <td v-if="field.type != 'checkbox'" :class="field.bodyClass"> {{
                                        stringify(row[field.name],field) }} </td>
                                    <td v-else :class="field.bodyClass"><font-awesome-icon
                                            :icon="(row[field.name]) ? ['far', 'check-square'] : ['far', 'square']" /></td>
                                </template>
                            </slot>
                        </template>
                    </tr>
                    <tr v-if="allowInsert">
                        <td>
                            <span role="button" class="me-2 text-success" @click="addItem(-1)"><font-awesome-icon
                                    icon="plus-square" /></span>
                        </td>

                        <slot name="table-body">
                            <td v-for="field in tableFields" :key="'table-cell-' + field.name"
                                class="bg-secondary-subtle"></td>
                        </slot>
                    </tr>
                </template>
                <template v-else>
                    <tr>
                        <td class="bg-secondary-subtle"><font-awesome-icon icon="spinner" spin /></td>
                        <slot name="table-body">
                            <td v-for="field in tableFields" :key="'table-cell-' + field.name"
                                class="bg-secondary-subtle"></td>
                        </slot>
                    </tr>
                </template>
            </tbody>
        </table>
    </div>
</template>