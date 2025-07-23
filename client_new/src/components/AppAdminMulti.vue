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
    import { useToast } from 'vue-toastification';
    import axios from 'axios';
    import TokenStorage from '@/lib/TokenStorage';
    import { useVuelidate } from "@vuelidate/core";

    import { required, helpers, email, sameAs } from "@vuelidate/validators";

    // INIT

    const emit = defineEmits(['test','preview','trigger','reset']);
    const toast = useToast();

    // PROPS

    const props = defineProps({
        settings: {
            type: Object,
            required: true
        },
        busyItems: {
            type: Object,
            default: () => ({})
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

    // flatten
    const isFlat = props.settings.flat || false;
    const reloadSeconds = (props.settings.reloadSeconds || 60)*1000;
    const removeDoubles = props.settings.removeDoubles || false;
    const idKey = props.settings.idKey || 'id';
    const objectType = props.settings.type;
    const objectLabel = props.settings.label || '';
    const objectLabelPlural = props.settings.labelPlural || `${objectLabel}s`;
    const objectIcon = props.settings.icon;
    const children = props.settings.children || []
    const actions = props.settings.actions || []
    const fields = props.settings.fields || []
    const childFields = props.settings.childFields || {}

    // VUELIDATE

    function getRules() {
        const ruleObj = { item: {} }
        fields.forEach(field => {
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
                        return !helpers.req(value) || typeof value === 'object' && value !== null && !Array.isArray(value);
                    }
                );
            }
            ruleObj.item[field.key] = rule
            if (field.type == 'password') {
                rule = {}
                rule.password_comfirmation = sameAs(computed(() => item.value.password))
                ruleObj.item["password2"] = rule
            }
        });
        return ruleObj

    };
    const item = ref({});
    const rules = getRules()
    const $v = useVuelidate(rules, { item });

    // METHODS
    
    function objectTitle(prefix = '', suffix = '') {
        return `${prefix} ${objectLabel} ${suffix}`.trim()
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
        for (const field of fields) {
            if (field.values && typeof field.values == 'string') {
                parentLists.value[field.values] = await loadList(field.values);
            }
        }
    }
    async function loadList(type,isFlat=false) {
        try {
            const result = await axios.get(`/api/v1/${type}/`, TokenStorage.getAuthentication());
            if(isFlat){
                return result.data.data.output.map((item,index) => {
                    return { id: index, name: item }
                });
            }
            return result.data.data.output;
        } catch (err) {
            toast.error(err.message)
        }
    }
    async function loadItem() {
        if (itemId.value) {
            try {
                var result
                if (isFlat) {
                    item.value = itemList.value[itemId.value]
                } else {
                    result = await axios.get(`/api/v1/${objectType}/${itemId.value}`, TokenStorage.getAuthentication())
                    item.value = result.data.data.output
                    for (const field of fields) {
                        if (field.type == 'checkbox') {
                            item.value[field.key] = !!item.value[field.key]
                        }
                        // if (field.isKey) {
                        //     itemPassword.value[field.key] = item.value[field.key]
                        // }
                    }
                    delete item.value.password // remove password ; updates don't need password
                    // TODO : in de future, do not return passwords in the api

                    for (const childList of children) {
                        childLists.value[childList.type] = (await loadList(childList.type)).filter(child => child[childList.key] == itemId.value)
                    }
                }
            } catch (err) {
                toast.error(err.message)
            }
        }
    }
    async function selectItem(value) {
        itemId.value = value[idKey];
        pagination.value.currentId = value[idKey];
        await loadItem()
        action.value = 'select';    
        removeUnwantedProperties()
    }
    async function editItem(value) {
        itemId.value = value[idKey];
        pagination.value.currentId = value[idKey];
        await loadItem()
        action.value = 'edit';    
        removeUnwantedProperties()
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
        item.value.password2 = '';
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
        item.value = {
        };
        action.value = 'new';
    }
    async function createItem() {
        var invalid=false
        invalid = isInvalid.value
        if (!invalid) {
            try {
                const result = await axios.post(`/api/v1/${objectType}/`, item.value, TokenStorage.getAuthentication())

                if (result.data.status == "error") {
                    toast.error(result.data.message + ", " + result.data.data.error);
                } else {
                    toast.success(objectTitle('', 'is created'));
                    loadItems();
                }
            }
            catch (err) {
                toast.error(err.message)
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
                const result = await axios.put(`/api/v1/${objectType}/${itemId.value}`, item.value, TokenStorage.getAuthentication())
                if (result.data.status == "error") {
                    toast.error(result.data.message + ", " + result.data.data.error);
                } else {
                    toast.success(objectTitle('', 'is updated'));
                    loadItems();
                }
            } catch (err) {
                toast.error(err.message)
            }
        } else {
            $v.value.item.$touch()
        }
    }
    async function removeItem() {
        try {
            var result
            if(isFlat){
                result = await axios.delete(`/api/v1/${objectType}?name=${encodeURIComponent(item.name)}`, TokenStorage.getAuthentication())
            }else{
                result = await axios.delete(`/api/v1/${objectType}/${itemId.value}`, TokenStorage.getAuthentication())
            }
            if (result.data.status == "error") {
                toast.error(result.data.message + ", " + result.data.data.error);
            } else {
                toast.success(objectTitle('', 'is deleted'));
                unselectItem();
                loadItems();
            }
        } catch (err) {
            toast.error(err.message)
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
        if (field.readonly) return false
        if (field.noInput) return false
        if (field.type == 'password' && ["new","change_password"].includes(action.value)) return true
        if (field.type != 'password' && action.value == 'change_password') return false
        if (field.type == 'password' && action.value != 'change_password') return false
        if (field.dependency && !item.value[field.dependency]) {
            return false
        }
        return true
    }
    function removeUnwantedProperties(){
        for (const field of fields) {
            if (field.type == 'password' && !["new","change_password"].includes(action.value)) {
                delete item.value[field.key]
            }
            if (field.type != 'password' && field.key!=idKey && action.value=='change_password') {
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
            return "Change Password"
        }
        if (action.value == 'new') {
            return objectTitle('New')
        } else if (action.value == 'edit') {
            return objectTitle('Edit')
        } else {
            return objectTitle()
        }

    });

    const  isInvalid = computed(() => {
        // check if any field is invalid, but only check the ones that are not disabled
        for (const field of fields) {
            if (showField(field) && !["password","password2"].includes(field.key) && $v.value.item[field.key].$invalid) {
                return true;
            }
        }
        return false
    })
    const  isInvalidPassword = computed(() => {
        // check if any field is invalid, but only check the ones that are not disabled
        for (const field of fields) {
            if (showField(field) &&(["password","password2"].includes(field.key) || field.key == idKey) && $v.value.item[field.key].$invalid) {
                return true;
            }
        }
        return false
    })


    // HOOKS

    onMounted(async () => {
        loading.value = true
        await loadItems();
        loading.value = false;
        // set interval await
        interval.value = setInterval(async () => {
            await loadItems(false);
        }, reloadSeconds);
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
            Delete {{ objectLabel }}
        </template>
        <template #default>
            <p class="mt-3 fs-6 user-select-none">
                Are you sure you want to delete <strong>{{ selectedItem.name }}</strong>?
            </p>
        </template>
        <template #footer>
            <BsButton icon="trash" @click="removeItem()">Delete</BsButton>
        </template>
    </BsModal>
    <AppSettings :icon="objectIcon" :title="objectLabelPlural">
        <template #actions>
            <BsButton cssClass="ms-3" icon="plus" @click="newItem()">New {{ objectLabel }}</BsButton>
        </template>
        <template #default>
            <BsAdminTable v-if="!loading && itemList!=undefined" 
                :items="itemList" 
                :busyItems="busyItems"
                :parentLists="parentLists" 
                :fields="fields" 
                :idKey="idKey"
                :actions="actions" 
                :removeDoubles="removeDoubles"
                @preview="previewItem" 
                @edit="editItem" 
                @test="testItem" 
                @select="selectItem" 
                @delete="deleteItem" 
                @trigger="triggerItem"
                @change_password="changePasswordItem" 
                @reset="resetItem"
                :pagination="pagination" />
            <div class="spinner-border" role="status" v-if="loading">
                <span class="visually-hidden">Loading...</span>
            </div>
        </template>
        <template #footer>
            <slot></slot>
        </template>
    </AppSettings>
    <BsOffCanvas v-if="!loading" :show="['select', 'edit', 'new', 'change_password'].includes(action)" :icon="objectIcon" :title="title" @close="unselectItem">
        <template #actions>
            <BsButton v-if="action == 'new'" icon="save" @click="createItem()">Save</BsButton>
            <BsButton v-if="action == 'edit'" icon="save" @click="updateItem()">Save</BsButton>
            <BsButton v-if="action == 'change_password'" icon="lock" @click="updateItem(true)">Change Password</BsButton>
        </template>
        <template #default>
            <template v-for="field in fields">
                <BsInput v-if="showField(field)" 
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
                    :values="getParentValues(field.values)" />
                <BsInput v-if="showField(field) && field.type == 'password'" 
                    :isHorizontal="true" 
                    type="password" 
                    icon="lock" 
                    :help="field.help"
                    :placeholder="field.placeholder" 
                    v-model="$v.item['password2'].$model" 
                    :isFloating="false" 
                    :required="true" 
                    label="Confirm" 
                    :hasError="$v.item['password2'].$invalid && $v.item['password2'].$dirty" 
                    :errors="$v.item['password2'].$errors" /> <!-- password confirmation -->
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
                        <BsAdminTable :items="childLists[childList.type]" :fields="childFields[childList.type]" />
                    </div>
                </div>
            </div>
        </template>
    </BsOffCanvas>
    
</template>