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
import YAML from 'yaml';
import { toast } from 'vue-sonner';

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
    readonlyColumns: { type: Array, default: () => [] },
    insertColumns: { type: Array },
    hasError: { type: Boolean },
    errors: { type: Array, default: () => [] },
    help: { type: String, default: "" },
    showLoadButton: { type: Boolean, default: false },
    showDownloadButton: { type: Boolean, default: false },
    name: { type: String, default: 'table-field' },
});


// DATA

const rows = ref(undefined);
const editedItem = ref({});
const showEdit = ref(false);
const action = ref("");
const editIndex = ref(-1);
const insert_marker = ref(undefined);
const fileInputRef = ref(null);

// COMPUTED

// validation rules for each field in the form
const rules = computed(() => {
    const ruleObj = { editedItem: {} } // holdes the rules for each field
    props.tableFields.forEach((ff, _i) => {
        var rule = {} // holds the rules for a single field
        if(!ff.label){
            ff.label = ff.name
        }
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
            const description = `${ff.label} is required`
            rule.required = helpers.withParams(
                { description: description, type: "required" },
                (value) => (value != undefined && value != null && value != '__auto__' && value != '__none__' && value != '__all__')
            )
        }
        // min and max value for numbers
        if ("minValue" in ff) {
            const description = `${ff.label} must be at least ${ff.minValue}`
            rule.minValue = helpers.withParams(
                { description: description, type: "minValue" },
                (value) => !helpers.req(value) || value >= ff.minValue
            )
        }
        if ("maxValue" in ff) {
            const description = `${ff.label} must be at most ${ff.maxValue}`
            rule.maxValue = helpers.withParams(
                { description: description, type: "maxValue" },
                (value) => !helpers.req(value) || value <= ff.maxValue
            )
        }
        // min and max length for strings
        if ("minLength" in ff) {
            const description = `${ff.label} must be at least ${ff.minLength} characters long`
            rule.minLength = helpers.withParams(
                { description: description, type: "minLength" },
                (value) => !helpers.req(value) || value.length >= ff.minLength
            )
        }
        if ("maxLength" in ff) {
            const description = `${ff.label} must be at most ${ff.maxLength} characters long`
            rule.maxLength = helpers.withParams(
                { description: description, type: "maxLength" },
                (value) => !helpers.req(value) || value.length <= ff.maxLength
            )
        }
        // regex validation
        if ("regex" in ff) {
            // Guarded like the identical rule in AppForm. This is inside `rules`, a
            // computed, so a throw here kills the whole table field rather than
            // reporting one column's problem. Two ways it went wrong: an author typo in
            // the pattern raises a SyntaxError, and writing `regex: "^x"` instead of
            // `regex: {expression: "^x"}` made new RegExp(undefined) compile to /(?:)/,
            // which matches everything - so the constraint silently never failed.
            const regexSource = (ff.regex && typeof ff.regex === 'object') ? ff.regex.expression : ff.regex
            var regexObj = null
            if (typeof regexSource === 'string' && regexSource) {
                try { regexObj = new RegExp(regexSource) } catch (e) {
                    console.error(`Column '${ff.name}': the regex '${regexSource}' is not valid (${e.message}); the rule is ignored.`)
                }
            } else {
                console.error(`Column '${ff.name}': regex must be given as { expression: "...", description: "..." }; the rule is ignored.`)
            }
            const description = (ff.regex && typeof ff.regex === 'object') ? ff.regex.description : undefined
            if (regexObj) {
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
        }
        // notIn and in
        if ("notIn" in ff) {
            const description = ff.notIn.description
            rule.notIn = helpers.withParams(
                { description: description, type: "notIn" },
                (value) => !helpers.req(value) || (props.form[ff.notIn.field] != undefined && Array.isArray(props.form[ff.notIn.field]) && !props.form[ff.notIn.field].includes(value))
            )
        }
        if ("in" in ff) {
            const description = ff.in.description
            rule.in = helpers.withParams(
                { description: description, type: "in" },
                (value) => !helpers.req(value) || (props.form[ff.in.field] != undefined && Array.isArray(props.form[ff.in.field]) && props.form[ff.in.field].includes(value))
            )
        }
        if ("sameAs" in ff) {
            const description = `Must match the field '${props.tableFields.find((x) => ff.sameAs == x.name)?.label || ff.sameAs}'`
            rule.sameAs = helpers.withParams(
                { description: description, type: "sameAs" },
                (value) => !helpers.req(value) || (props.form[ff.sameAs] != undefined && value == props.form[ff.sameAs])
            )
        }

        ruleObj.editedItem[ff.name] = rule
    })
    return ruleObj
});

const editFields = computed(() => {
    return props.tableFields.filter(x => (action.value != "Add" || props.insertColumns.length == 0 || props.insertColumns.includes(x.name)));
});


// WATCHERS

watch(
    () => props.values,
    (newValues) => {
        // A COPY. `rows` used to be the parent's own array, so every splice/push/assign
        // below wrote straight into it - and AppForm hands the same array object to
        // form[name] AND defaults[name] (both by reference). Deleting a row therefore
        // mutated the defaults too, so when the field was re-evaluated and "reset to its
        // default" the deleted row never came back: the original prefill of a stored job
        // was gone for the rest of the session. Every mutation here already emits
        // update:model-value, so the parent gets the new array that way.
        rows.value = Array.isArray(newValues) ? [...newValues] : newValues;
        // if (newValues?.length > 0) {
        //     const fields = props.tableFields.map(x => x.name);
        //     const data = Object.keys(newValues[0]);
        //     const missing = Helpers.findMissing(data, fields);
        //     if (missing.length > 0) {
        //         emit('warning', missing);
        //     }
        // }
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
        try{
            if (typeof editedItem.value[field.name] == "object") {
                try {
                    if (Object.keys(editedItem.value[field.name]) && Object.keys(editedItem.value[field.name]).length > 0) {
                        return Object.keys(editedItem.value[field.name])[0];
                    }
                } catch (e) {
                    return undefined;
                }
            }
        } catch(e){
            return undefined;
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
            return v.map(item => stringify(item, field)).join(', ');
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

// Key-sorted JSON, so two rows compare equal when they hold the same data whatever order
// their properties happen to be in.
function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') {
        return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
    }
    return JSON.stringify(value ?? null);
}

function getEditedItemValues() {
    // Create a copy of editedItem and flatten enum fields with valueColumn
    const result = Helpers.deepClone(editedItem.value);
    
    props.tableFields.forEach(field => {
        if (field.type === 'enum' && field.valueColumn) {
            const fieldValue = result[field.name];
            
            if (fieldValue === null || fieldValue === undefined) {
                // Leave null/undefined as-is
                return;
            }
            
            if (Array.isArray(fieldValue)) {
                // Array of objects -> map to array of valueColumn values
                result[field.name] = fieldValue.map(obj => 
                    typeof obj === 'object' && obj !== null ? obj[field.valueColumn] : obj
                );
            } else if (typeof fieldValue === 'object') {
                // Single object -> extract valueColumn
                result[field.name] = fieldValue[field.valueColumn];
            }
            // If it's already a primitive, leave as-is
        }
    });
    
    return result;
}

function saveItem() {
    v$.value.editedItem.$touch();
    
    if (!v$.value.editedItem.$invalid) {
        if (action.value == "Add") {
            if (insert_marker.value) {
                editedItem.value[insert_marker.value] = true;
            }
            if (editIndex.value < 0) {
                rows.value.push(getEditedItemValues());
            } else {
                rows.value.splice(editIndex.value, 0, getEditedItemValues());
            }
        } else {
            // Compare what will actually be STORED, not the live edit buffer.
            //
            // getEditedItemValues() flattens an `enum` column that has a valueColumn back
            // from the selected row object to its primitive - and merely opening the edit
            // pane inflates it, because the select matches the string default and emits
            // the whole row. So the old comparison was {host:"web01"} against
            // {host:{name:"web01",...}}: they differ as text, and a row where nothing had
            // been touched was written back marked as updated. The playbook then received
            // an unchanged row flagged as changed.
            //
            // Key-sorted, so a difference in property ORDER between the stored row and the
            // edit buffer cannot masquerade as a change either.
            const stored = getEditedItemValues();
            if (props.updateMarker && !stored[props.updateMarker] && !stored[insert_marker.value]) {
                const original = rows.value[editIndex.value];
                if (canonical(original) !== canonical(stored)) {
                    stored[props.updateMarker] = true; // mark as updated
                }
            }
            rows.value[editIndex.value] = stored;
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

    rows.value = Array.isArray(props.values) ? [...props.values] : props.values; // copy - see the watcher above

}

// Trigger file input click
function triggerFileInput() {
    fileInputRef.value?.click();
}

// Handle file load with strict validation
async function handleFileLoad(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    // try/finally : the early returns below (wrong extension, unparsable file)
    // used to skip the reset at the end, so the <input type=file> kept the same
    // value - re-picking the SAME path fired no change event and the button was
    // simply dead until a different file was chosen.
    try {
    
        // Check file extension
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.yml') && !fileName.endsWith('.yaml')) {
            toast.error('Please select a .yml or .yaml file');
            return;
        }
    
        try {
            const text = await file.text();
            const parsed = YAML.parse(text);
        
            // Must be valid YAML
            if (parsed === null || parsed === undefined) {
                toast.error('Invalid YAML file - no data found');
                return;
            }
        
            // Force to array if not already
            let arrayData;
            if (Array.isArray(parsed)) {
                arrayData = parsed;
            } else {
                // Wrap single object in array
                arrayData = [parsed];
                toast.info('Single object converted to array');
            }
        
            rows.value = arrayData;
            emit('update:model-value', arrayData);
            toast.success(`Loaded ${arrayData.length} row(s) from ${file.name}`);
        } catch (e) {
            toast.error(`Failed to parse ${file.name}: ${e.message}`);
        }
    
    } finally {
        // Reset input so same file can be loaded again
        event.target.value = '';
    }
}

// Handle download as YAML
function handleDownload() {
    try {
        if (!rows.value || rows.value.length === 0) {
            toast.error('No data to download');
            return;
        }
        
        // Build list of additional fields to strip (marker fields)
        const additionalFields = [
            props.insertMarker,
            props.updateMarker,
            props.deleteMarker
        ].filter(Boolean); // Remove any undefined/null markers
        
        const cleanRows = Helpers.stripInternalFields(rows.value, additionalFields);
        const yamlContent = YAML.stringify(cleanRows);
        const blob = new Blob([yamlContent], { type: 'text/yaml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${props.name || 'table'}.yml`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Table data downloaded as YAML');
    } catch (e) {
        toast.error(`Failed to download: ${e.message}`);
    }
}

// HOOKS

onMounted(() => {
    v$ = useVuelidate(rules, { editedItem }); // use vuelidate, form is a ref that holds the form data
    init();
});

</script>
<template>
    <div>

        <!-- Load/Download buttons -->
        <div v-if="showLoadButton || showDownloadButton" class="mb-2 d-flex gap-2">
            <BsButton 
                v-if="showLoadButton" 
                cssClass="btn-sm"
                icon="file-import"
                @click="triggerFileInput">
                Load YAML
            </BsButton>
            
            <BsButton 
                v-if="showDownloadButton" 
                cssClass="btn-sm"
                icon="download"
                @click="handleDownload"
                :disabled="!rows || rows.length === 0">
                Download
            </BsButton>
            
            <!-- Hidden file input -->
            <input 
                v-if="showLoadButton"
                ref="fileInputRef"
                type="file" 
                accept=".yml,.yaml"
                @change="handleFileLoad"
                style="display: none"
            />
        </div>

        <!-- EDIT FORM -->
        <BsOffCanvas :show="showEdit" :title="action" @close="closeOffCanvas()">
            <template #actions>
                <BsButton icon="save" @click="saveItem()">Save</BsButton>
            </template>
            <template #default v-if="!!v$?.editedItem?.$model && showEdit">

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
                        :required="field.required" :type="field.type" :icon="field.icon" :readonly="field.hide || readonlyColumns.includes(field.name)"
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
                        :readonly="readonlyColumns.includes(field.name)" :help="field.help" />
                </div>
            </template>
        </BsOffCanvas>



        <!-- TABLE -->
        <div class="form-control" :class="{ 'is-invalid': hasError }">
            <table :class="props.tableClass">
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
        <div v-if="hasError && errors.length>0" class="invalid-feedback">
                {{ errors[0].$message || errors[0].$params?.description || errors[0] }}
        </div>  
        <div class="form-text" v-if="help">
            {{ help }}
        </div>          
    </div>
</template>
