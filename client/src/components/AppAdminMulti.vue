<script setup>

    /******************************************************************/
    /*                                                                */
    /*  App Admin Multi component                                     */
    /*  Creates a table with CRUD actions for a given object type     */
    /*  Optional actions: test, preview, trigger                      */
    /*                                                                */
    /*  @props:                                                       */
    /*      settings: Object                                          */
    /*      busyItems: Object                                         */
    /*                                                                */
    /*  @emits:                                                       */
    /*      test: Object                                              */
    /*      preview: Object                                           */
    /*      trigger: Object                                           */
    /*                                                                */
    /******************************************************************/

    import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
    import { watch } from 'vue';    
    import { toast } from 'vue-sonner';
    import axios from 'axios';
    import Helpers from '@/lib/Helpers';
    import TokenStorage from '@/lib/TokenStorage';
    import { useVuelidate } from "@vuelidate/core";
    import yaml from 'yaml';
    import { required, helpers, email, sameAs } from "@vuelidate/validators";
    import { useI18n } from 'vue-i18n';
    import BsDataTable from './BsDataTable.vue';

    // INIT

    const { t } = useI18n();
    const emit = defineEmits(['test','preview','trigger','reset','sync']);

    // PROPS

    const props = defineProps({
        settings: {
            type: Object,
            required: true
        },
        busyItems: {
            type: Object,
            default: () => ({})
        },
        apiVersion: {
            type: [String, Number],
            default: 1
        }
    })

    // DATA

    const itemList = ref([]);
    const parentLists = ref({});
    const childLists = ref({});
    const loading = ref(false);
    const itemId = ref(undefined);
    const action = ref('');
    const pagination = ref({ currentId: undefined, enabled: true });
    const activeChild = ref(0);
    const interval = ref(null);
    const config = ref({});

    // flatten
    const isFlat = props.settings.flat || false;
    const reloadSeconds = props.settings.reloadSeconds === false ? false : (props.settings.reloadSeconds || 60)*1000;
    const removeDoubles = props.settings.removeDoubles || false;
    const idKey = props.settings.idKey || 'id';
    const objectType = props.settings.type;
    const objectLabel = computed(() => props.settings.label || '');
    const objectLabelPlural = computed(() => props.settings.labelPlural || `${objectLabel.value}s`);
    const objectIcon = computed(() => props.settings.icon);
    const children = computed(() => props.settings.children || []);
    const actions = computed(() => props.settings.actions || []);
    const fields = computed(() => props.settings.fields || []);
    const childFields = computed(() => props.settings.childFields || {});
    const noCreate = computed(() => props.settings.noCreate === true);

    // VUELIDATE

    function getRules() {
        const ruleObj = { item: {} }
        fields.value.forEach(field => {
            var rule = {}
            if (field.required) {
                rule.required = helpers.withMessage(`${field.label} is required`, required)
            }
            if (field.type == 'email') {
                rule.email = helpers.withMessage(`${field.label} must be a valid email address`, email)
            }
            if (field.type == 'checkbox' && field.required) {
                rule.checkboxRequired = helpers.withMessage(`${field.label} is required`, sameAs(computed(() => true)))
            }
            // regex validation
            if (field.regex && field.regex.expression) {
                var regexObj = new RegExp(field.regex.expression)
                var description = field.regex.description
                rule.regex = helpers.withMessage(description, (value) => !helpers.req(value) || regexObj.test(value))
            }
            if (field.type == 'editor' && field.lang == 'yaml') {
                rule.editorType = helpers.withMessage(
                    `${field.label} must be valid YAML`,
                    (value) => {
                        if (!helpers.req(value)) return true;
                        try {
                            const parsed = yaml.parse(value);
                            return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
                        } catch (e) {
                            return false;
                        }
                    }
                );
            }
            ruleObj.item[field.key] = rule
            // if (field.type == 'password') {
            //     rule = {}
            //     rule.password_comfirmation = sameAs(computed(() => item.value.password))
            //     ruleObj.item["password2"] = rule
            // }
        });
        return ruleObj

    };
    const item = ref({});
    const rules = computed(() => getRules());
    const $v = useVuelidate(rules, { item });

    // METHODS
    
    function objectTitle(prefix = '', suffix = '') {
        return `${prefix} ${objectLabel.value} ${suffix}`.trim()
    }
    function resetItems() {
        itemList.value = [];
        itemId.value = undefined;
        pagination.value.currentId = undefined; // reset selected item
        action.value = '';
    }
    async function loadItems(force=true) {
        // if the offcanvas is open, do not load items
        if (['select', 'edit', 'new', 'change_password'].includes(action.value) && !force){ 
            return 
        }
        resetItems();
        itemList.value = await loadList(objectType,isFlat);
        for (const field of fields.value) {
            if (field.parent && field.values && typeof field.values == 'string') {
                parentLists.value[field.parent] = await loadList(field.values);
            }
            if (field.parent && field.values && Array.isArray(field.values)) {
                parentLists.value[field.parent] = field.values;
            }
        }
    }
    async function loadList(type,isFlat=false) {
        try {
            const result = await axios.get(`/api/v${props.apiVersion}/${type}/`, TokenStorage.getAuthentication());
            if(props.apiVersion == 1) {
                if(isFlat){
                    const raw = Array.isArray(result.data.data.output) ? result.data.data.output : [];
                    const deduped = removeDoubles ? Array.from(new Set(raw)) : raw;
                    // v1 flat assumed array of primitive values (string/number)
                    return deduped.map((val, idx) => ({ id: idx, name: String(val) }));
                }
                return result.data.data.output;
            } else if (props.apiVersion == 2) {
                if(isFlat){
                    const records = Array.isArray(result.data.records) ? result.data.records : [];
                    if (records.length === 0) return [];
                    // If primitives (strings/numbers)
                    if (typeof records[0] !== 'object' || records[0] === null) {
                        const deduped = removeDoubles ? Array.from(new Set(records)) : records;
                        return deduped.map((val, idx) => ({ id: idx, name: String(val) }));
                    }
                    // Objects: ensure id & name exist generically
                    return records.map((obj, idx) => {
                        const out = { ...obj };
                        // establish id
                        if (out[idKey] === undefined && out.id === undefined) {
                            out.id = idx;
                        } else if (out.id === undefined) {
                            out.id = out[idKey];
                        }
                        // establish name fallback (used in selection/delete modals)
                        if (out.name === undefined) {
                            const fallback = out[idKey] ?? out.id ?? out.label ?? `item_${idx}`;
                            out.name = String(fallback);
                        }
                        return out;
                    });
                }
                return result.data.records;
            } else {
                throw new Error("Unsupported API version");
            }
        } catch (err) {
            toast.error(Helpers.parseAxiosResponseError(err, "Failed to load data"))
        }



    }
    async function loadItem() {
        if (itemId.value) {
            try {
                var result
                if (isFlat) {
                    item.value = itemList.value[itemId.value]
                } else {
                    result = await axios.get(`/api/v${props.apiVersion}/${objectType}/${itemId.value}`, TokenStorage.getAuthentication())
                    if (props.apiVersion == 1) {
                        item.value = result.data.data.output;
                    } else if (props.apiVersion == 2) {
                        item.value = result.data;
                    } else {
                        throw new Error("Unsupported API version");
                    }
                    for (const field of fields.value) {
                        if (field.type == 'checkbox') {
                            item.value[field.key] = !!item.value[field.key]
                        }
                        if (field.type == 'editor' && item.value[field.key] === null) {
                            item.value[field.key] = ''
                        }
                        // if (field.isKey) {
                        //     itemPassword.value[field.key] = item.value[field.key]
                        // }
                    }
                    delete item.value.password // remove password ; updates don't need password
                    delete item.value.token // remove token, update don't need token
                    delete item.value.client_secret // do not return client_secret in the API
                    // TODO : in de future, do not return passwords in the api

                    for (const childList of children.value) {
                        childLists.value[childList.type] = (await loadList(childList.type)).filter(child => child[childList.key] == itemId.value)
                    }
                }
            } catch (err) {
                toast.error(Helpers.parseAxiosResponseError(err, "Failed to load item"))
            }
        }
    }
    async function selectItem(value) {
        itemId.value = value[idKey];
        pagination.value.currentId = value[idKey];
        await loadItem()
        action.value = 'select';    
        removeUnwantedProperties()
        // Set defaults for all fields with defaultMap
        fields.value.forEach(field => {
            if (field.defaultMap && field.dependency && item.value[field.dependency] && !item.value[field.key]) {
                console.log("Setting default")
                setFieldDefaults(field.dependency);
            }
        });
    }
    async function editItem(value) {
        itemId.value = value[idKey];
        pagination.value.currentId = value[idKey];
        await loadItem()
        action.value = 'edit';    
        removeUnwantedProperties()
        // Set defaults for all fields with defaultMap
        fields.value.forEach(field => {
            if (field.defaultMap && field.dependency && item.value[field.dependency] && !item.value[field.key]) {
                console.log("Setting default")
                setFieldDefaults(field.dependency);
            }
        });        
    }
    function setItemProperty(setting) { // to set a property of an item (example status for repos)
        const founditem = itemList.value.find((x) => { 
            return x[idKey] == setting.id ;  
        })
        if (founditem) {
            founditem[setting.key] = setting.value
        }
    }
    async function changePasswordItem(value) {
        itemId.value = value[idKey];
        await loadItem()
        action.value = 'change_password';    
        item.value.password = '';
        item.value.client_secret = ''; // reset client secret
        item.value.token = '';
        pagination.value.currentId = value[idKey];
        removeUnwantedProperties()
    }
    async function deleteItem(value) {
        itemId.value = value[idKey];
        await loadItem()
        action.value = 'delete';   
        pagination.value.currentId = value[idKey]; 
    }
    function unselectItem() {
        itemId.value = undefined;
        pagination.value.currentId = undefined;
        action.value = '';
    }
    function newItem() {
        item.value = {};
        // Initialize fields with defaults to prevent undefined warnings
        fields.value.forEach(field => {
            if (field.type === 'editor' && item.value[field.key] === undefined) {
                item.value[field.key] = '';
            }
        });
        action.value = 'new';
    }
    async function createItem() {
        var invalid=false
        invalid = isInvalid.value
        if (!invalid) {
            try {
                const result = await axios.post(`/api/v${props.apiVersion}/${objectType}/`, item.value, TokenStorage.getAuthentication())

                if (props.apiVersion == 1) {
                    if (result.data.status == "error") {
                        toast.error(result.data.message + ", " + result.data.data.error);
                    } else {
                        toast.success(objectTitle('', t('settings.common.isCreated')));
                        loadItems();
                    }
                } else if (props.apiVersion == 2) {
                    toast.success(objectTitle('', t('settings.common.isCreated')));
                    loadItems();
                }
            }
            catch (err) {
                toast.error(Helpers.parseAxiosResponseError(err, "Failed to save item"))
            }
        } else {
            $v.value.item.$touch()
        }
    }
    async function updateItem(passwordOnly=false) {
        var invalid=false
        if(passwordOnly){
            invalid = isInvalidPassword.value
        }else{
            invalid = isInvalid.value
        }
        if (!invalid) {
            try {
                const result = await axios.put(`/api/v${props.apiVersion}/${objectType}/${itemId.value}`, item.value, TokenStorage.getAuthentication())
                if (props.apiVersion == 1) {
                    if (result.data.status == "error") {
                        toast.error(result.data.message + ", " + result.data.data.error);
                    } else {
                        toast.success(objectTitle('', t('settings.common.isUpdated')));
                        loadItems();
                    }
                } else if (props.apiVersion == 2) {
                    toast.success(objectTitle('', t('settings.common.isUpdated')));
                    loadItems();
                }
            } catch (err) {
                toast.error(Helpers.parseAxiosResponseError(err, "Failed to update item"))
            }
        } else {
            $v.value.item.$touch()
        }
    }
    async function removeItem() {
        try {
            var result
            if(isFlat){
                result = await axios.delete(`/api/v${props.apiVersion}/${objectType}?name=${encodeURIComponent(item.value.name)}`, TokenStorage.getAuthentication())
            }else{
                result = await axios.delete(`/api/v${props.apiVersion}/${objectType}/${itemId.value}`, TokenStorage.getAuthentication())
            }
            if (props.apiVersion == 1) {
                if (result.data.status == "error") {
                    toast.error(result.data.message + ", " + result.data.data.error);
                } else {
                    toast.success(objectTitle('', t('settings.common.isDeleted')));
                    unselectItem();
                    loadItems();
                }
            } else if (props.apiVersion == 2) {
                toast.success(objectTitle('', t('settings.common.isDeleted')));
                unselectItem();
                loadItems();
            }
        } catch (err) {
            toast.error(Helpers.parseAxiosResponseError(err, "Failed to delete item"))
        }

    }
    function testItem(value) {
        emit('test', value)
    }
    function previewItem(value){
        emit('preview', value)
    }
    function triggerItem(value){
        emit('trigger', value)
    }
    function resetItem(value) {
        emit('reset', value)
    }
    function getParentValues(key) {
        if (!key) return []
        if (Array.isArray(key)) return key
        if (!parentLists.value) return []
        return parentLists.value[key] || []
    }

    function showField(field) {
        // Only hide if noInput is set, not readonly
        if (field.noInput) return false;
        let depShow = true;
        if (field.dependency) {
            const depValue = item.value[field.dependency];
            if (Array.isArray(field.dependencyValues)) {
                depShow = field.dependencyValues.includes(depValue);
            } else if (field.negateDependency) {
                depShow = !depValue;
            } else {
                depShow = depValue;
            }
        }
        if (field.type == 'password' && ["new","change_password"].includes(action.value)) return (true && depShow);
        if (field.type != 'password' && action.value == 'change_password') return false;
        if (field.type == 'password' && action.value != 'change_password') return false;
        return depShow;
    }

    // Set dynamic defaults for fields with defaultMap when dependency changes
    function setFieldDefaults(depKey) {
        fields.value.forEach(field => {
            if (field.defaultMap && field.dependency === depKey) {
                const depValue = item.value[depKey];
                const def = field.defaultMap[depValue];
                if (typeof def === 'function') {
                    item.value[field.key] = def(config.value);
                } else if (def !== undefined) {
                    item.value[field.key] = def;
                }
            }
        });
    }


    fields.value.forEach(field => {
        if (field.dependency) {
            watch(() => item.value[field.dependency], () => setFieldDefaults(field.dependency));
        }
    });

    // Load config (AnsibleForms URL) on mount
    onMounted(async () => {
        try {
            const result = await axios.get(`/api/v2/settings`, TokenStorage.getAuthentication());
            config.value = result.data;
        } catch (err) {
            // fallback: leave config empty
        }
    });
    function removeUnwantedProperties(){
        for (const field of fields.value) {
            if (field.type == 'password' && !["new","change_password"].includes(action.value)) {
                delete item.value[field.key]
            }
            if (field.type != 'password' && field.key!=idKey && !field.password_related && action.value=='change_password') {
                delete item.value[field.key]
            }
        }
    }

    // COMPUTED

    const selectedItem = computed(() => {
        return itemList.value.find((item) => item[idKey] == itemId.value);
    });
    const title = computed(() => {
        if (action.value == 'change_password') {
            return t('settings.common.changePassword')
        }
        if (action.value == 'new') {
            return t('settings.common.newItem', { item: objectLabel.value })
        } else if (action.value == 'edit') {
            return `${t('settings.common.edit')} ${objectLabel.value}`
        } else {
            return objectLabel.value
        }

    });

    const  isInvalid = computed(() => {
        // check if any field is invalid, but only check the ones that are not disabled
        for (const field of fields.value) {
            if (showField(field) && !["password","token","client_secret"].includes(field.key) && $v.value.item[field.key]?.$invalid) {
                return true;
            }
        }
        return false
    })
    const  isInvalidPassword = computed(() => {
        // check if any field is invalid, but only check the ones that are not disabled
        for (const field of fields.value) {
            if (showField(field) && (["password","token","client_secret"].includes(field.key) || field.key == idKey) && $v.value.item[field.key]?.$invalid) {
                return true;
            }
        }
        return false
    })
    const checkboxFields = computed(() => {
        return fields.value.filter(field => field.type === 'checkbox').map(field => field.key);
    });

    // BsDataTable mode (always on — BsDataTable is the only table renderer)
    const dataTableSelectable = computed(() => props.settings.selectable !== false);
    const selectedIds = ref(new Set());
    const activeRowId = ref(null);

    const hasEditAction = computed(() => actions.value.some(a => a.name === 'edit'));
    const dataTableShowRowMenu = computed(() => actions.value.length > 0);

    const dataTableColumns = computed(() => {
        // Include every field as a possible column (so the user can opt any of
        // them in via the column picker). Skip explicit `noTable` opt-outs and
        // password-like fields whose values are never returned by the API.
        const SECRET_KEYS = new Set(['password', 'token', 'client_secret']);
        return fields.value
            .filter(f => !f.noTable && !SECRET_KEYS.has(f.key) && f.type !== 'password')
            .map(f => {
                const col = {
                    key: f.key,
                    label: f.label,
                    sortable: f.sortable !== false,
                    filterable: f.filterable || false,
                    mobileHidden: f.mobileHidden || false,
                    // Fields previously flagged `hidden: true` keep that as the
                    // default visibility but remain available in the column
                    // picker so users can show them when wanted.
                    defaultHidden: !!f.hidden,
                };
                if (f.type === 'select' && f.parent) {
                    col.render = (val) => {
                        const list = parentLists.value[f.parent] || [];
                        const found = list.find(itm => itm[f.valueKey] == val);
                        return found ? found[f.labelKey] : (val || '');
                    };
                }
                if (f.type === 'checkbox') {
                    col.type = 'checkbox';
                }
                return col;
            });
    });

    // Whether a per-row action should be enabled. Honours `dependency`,
    // `dependencyValues`, and `negateDependency` from the action definition.
    function isActionEnabled(action, item) {
        if (!action.dependency) return true;
        // an array dependency means "enabled if ANY of these fields is truthy"
        if (Array.isArray(action.dependency)) {
            return action.dependency.some(dep => !!item[dep]);
        }
        const v = item[action.dependency];
        if (Array.isArray(action.dependencyValues)) {
            return action.dependencyValues.includes(v);
        }
        if (action.negateDependency) return !v;
        return !!v;
    }

    // Map child-list `fields` (settings.js → childFields) to BsDataTable
    // column defs so the read-only child tables get the same sort / filter /
    // column-picker behaviour as the main table.
    function childTableColumns(fieldList) {
        if (!Array.isArray(fieldList)) return [];
        return fieldList.map(f => ({
            key: f.key,
            label: f.label,
            sortable: f.sortable !== false,
            filterable: f.filterable !== false,
            defaultHidden: !!f.hidden,
            type: f.type === 'checkbox' ? 'checkbox' : undefined,
        }));
    }

    function dispatchAction(action, item) {
        if (!isActionEnabled(action, item)) return;
        switch (action.name) {
            case 'edit': return editItem(item);
            case 'delete': return deleteItem(item);
            case 'change_password': return changePasswordItem(item);
            case 'select': return selectItem(item);
            case 'preview': return previewItem(item);
            case 'test': return testItem(item);
            case 'trigger': return triggerItem(item);
            case 'reset': return resetItem(item);
            default: return emit(action.name, item);
        }
    }

    function onDataTableRowClick(item) {
        if (!dataTableSelectable.value) {
            activeRowId.value = item[idKey];
            if (hasEditAction.value) {
                editItem(item);
            } else {
                // No edit action defined → open the read-only "show" offcanvas
                // (used by pages like groups that have children to display).
                selectItem(item);
                emit('row-select', item);
            }
        }
    }

    async function bulkDelete() {
        const ids = [...selectedIds.value];
        if (!ids.length) return;
        if (!confirm(`Delete ${ids.length} item(s)?`)) return;
        try {
            await Promise.all(ids.map(id => {
                if (isFlat) {
                    const row = itemList.value.find(r => r[idKey] === id);
                    const name = row?.name ?? id;
                    return axios.delete(`/api/v${props.apiVersion}/${objectType}?name=${encodeURIComponent(name)}`, TokenStorage.getAuthentication());
                }
                return axios.delete(`/api/v${props.apiVersion}/${objectType}/${id}`, TokenStorage.getAuthentication());
            }));
            toast.success(t('settings.common.isDeleted'));
            selectedIds.value = new Set();
            await loadItems();
        } catch (err) {
            toast.error(Helpers.parseAxiosResponseError(err, "Failed to delete items"));
        }
    }


    // HOOKS

    onMounted(async () => {
        loading.value = true
        await loadItems();
        loading.value = false;
        // set interval await (only if reloadSeconds is not explicitly disabled)
        if (reloadSeconds !== false) {
            interval.value = setInterval(async () => {
                await loadItems(false);
            }, reloadSeconds);
        }
    });


    onBeforeUnmount(() => {
        if (interval.value) {
            clearInterval(interval.value);
            interval.value = null;
        }
    });

    defineExpose({
        loadItems,
        setItemProperty
    });

</script>
<template>
    <BsModal v-if="action == 'delete'" @close="unselectItem">
        <template #title>
            {{ t('common.delete') }} {{ objectLabel }}
        </template>
        <template #default>
            <p class="mt-3 fs-6 user-select-none">
                {{ t('settings.common.deleteConfirm') }} <strong>{{ selectedItem.name }}</strong>?
            </p>
        </template>
        <template #footer>
            <BsButton icon="trash" @click="removeItem()">{{ t('common.delete') }}</BsButton>
        </template>
    </BsModal>
    <AppSettings :icon="objectIcon" :title="objectLabelPlural">
        <template #actions>
            <BsButton v-if="!noCreate" cssClass="ms-3" icon="plus" @click="newItem()">{{ t('settings.common.newItem', { item: objectLabel }) }}</BsButton>
        </template>
        <template #default>
            <BsDataTable v-if="!loading && itemList!=undefined"
                :items="itemList"
                :columns="dataTableColumns"
                :idKey="idKey"
                :selectedIds="selectedIds"
                :selectable="dataTableSelectable"
                :activeId="!dataTableSelectable ? activeRowId : null"
                :name="Helpers.cleanupString(objectLabelPlural)"
                @update:selectedIds="selectedIds = $event"
                @row-click="onDataTableRowClick"
            >
                <template v-if="dataTableSelectable" #bulk-actions="{ count }">
                    <BsButton v-if="count" cssClass="ms-2 btn-sm btn-outline-danger" icon="trash" @click="bulkDelete">
                        {{ t('common.delete') }} ({{ count }})
                    </BsButton>
                </template>
                <template v-if="dataTableShowRowMenu" #row-actions="{ item }">
                    <div class="dropdown">
                        <a role="button" class="bs-dt-row-menu px-2" data-bs-toggle="dropdown" data-bs-strategy="fixed">
                            <font-awesome-icon icon="ellipsis-vertical" />
                        </a>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <template v-for="(action, idx) in actions" :key="action.name + idx">
                                <li v-if="action.name === 'delete'"><hr class="dropdown-divider" /></li>
                                <li>
                                    <a class="dropdown-item"
                                       :class="{ 'disabled text-muted': !isActionEnabled(action, item), 'text-danger': action.name === 'delete' && isActionEnabled(action, item) }"
                                       href="#"
                                       @click.prevent="dispatchAction(action, item)">
                                        <font-awesome-icon :icon="action.icon || 'circle'" class="me-2" />{{ action.title }}
                                    </a>
                                </li>
                            </template>
                        </ul>
                    </div>
                </template>
            </BsDataTable>
            <div class="spinner-border" role="status" v-if="loading">
                <span class="visually-hidden">{{ t('settings.common.loading') }}</span>
            </div>
        </template>
        <template #footer>
            <slot></slot>
        </template>
    </AppSettings>
    <BsOffCanvas v-if="!loading" :show="['select', 'edit', 'new', 'change_password'].includes(action)" :icon="objectIcon" :title="title" @close="unselectItem">
        <template #actions>
            <BsButton v-if="action == 'new'" icon="save" @click="createItem()">{{ t('settings.common.save') }}</BsButton>
            <BsButton v-if="action == 'edit'" icon="save" @click="updateItem()">{{ t('settings.common.save') }}</BsButton>
            <BsButton v-if="action == 'change_password'" icon="lock" @click="updateItem(true)">{{ t('settings.common.changePassword') }}</BsButton>
        </template>
        <template #default>
            <template v-for="field in fields">
                <!-- DATETIME FIELD -->
                <div v-if="showField(field) && field.type === 'datetime'" class="row mb-3">
                    <label class="col-sm-2 col-form-label fw-bold">
                        {{ field.label }}
                        <span v-if="field.required" class="text-danger">*</span>
                    </label>
                    <div class="col-sm-10">
                        <BsDateTime 
                            v-model="$v.item[field.key].$model"
                            :icon="field.icon || 'calendar'"
                            :placeholder="field.placeholder"
                            :hasError="$v.item[field.key].$invalid && $v.item[field.key].$dirty"
                            :convertToUtc="field.convertToUtc !== undefined ? field.convertToUtc : true"
                            dateType="datetime"
                        />
                        <small v-if="field.help" class="form-text text-muted d-block mt-1">{{ field.help }}</small>
                        <div v-if="$v.item[field.key].$invalid && $v.item[field.key].$dirty" class="invalid-feedback d-block">
                            <div v-for="error in $v.item[field.key].$errors" :key="error.$uid">
                                {{ error.$message }}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- ALL OTHER FIELD TYPES -->
                <BsInput v-if="showField(field) && field.type !== 'datetime'" 
                    :isHorizontal="true" 
                    :type="field.type" 
                    :placeholder="field.placeholder" 
                    :icon="field.icon" 
                    :help="field.help"
                    :readonly="field.readonly" 
                    v-model="$v.item[field.key].$model" 
                    :isFloating="false" 
                    :required="field.required" 
                    :label="field.label" 
                    :hasError="$v.item[field.key].$invalid && $v.item[field.key].$dirty" 
                    :errors="$v.item[field.key].$errors" 
                    :valueKey="field.valueKey" 
                    :labelKey="field.labelKey" 
                    :style="field.style"
                    :lang="field.lang"
                    :values="getParentValues(field.parent)" />
            </template>
            <div v-if="action == 'select' && childLists">
                <ul class="nav nav-tabs">
                    <li class="nav-item" v-for="(childList, index) in children">
                        <a role="button" class="nav-link" @click="activeChild = index" :class="{ 'active': index == activeChild }"><span class="me-2">
                                <FaIcon :icon="childList.icon" />
                            </span>{{ childList.labelPlural }}</a>
                    </li>
                </ul>
                <div v-for="(childList, index) in children">
                    <div class="p-2 border border-top-0" v-if="index == activeChild">
                        <BsDataTable
                            :items="childLists[childList.type] || []"
                            :columns="childTableColumns(childFields[childList.type])"
                            :selectable="false"
                            :name="`child_${objectType}_${childList.type}`" />
                    </div>
                </div>
            </div>
        </template>
    </BsOffCanvas>
    
</template>
<style scoped>
/* 3-dot row action trigger: muted by default, inherits color when the row is
   selected/active (dark bg → light icon). */
.bs-dt-row-menu {
  color: var(--bs-secondary-color);
  text-decoration: none;
}
.bs-dt-row-menu:hover {
  color: var(--bs-body-color);
}
:deep(.bs-dt-selected) .bs-dt-row-menu,
:deep(.bs-dt-selected) .bs-dt-row-menu:hover {
  color: inherit;
}
</style>
