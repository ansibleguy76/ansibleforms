<script setup>

    /******************************************************************/
    /*                                                                */
    /*  App Admin Single component                                    */
    /*  Create a single admin page with a form and update/save button */
    /*                                                                */
    /*  @props:                                                       */
    /*      settings: Object                                          */
    /*                                                                */
    /*  @emits:                                                       */
    /*      test: Function                                            */
    /*      import: Function                                          */
    /*                                                                */
    /******************************************************************/

    import { ref, onMounted } from "vue";
    import axios from "axios";
    import Helpers from "@/lib/Helpers";
    import { toast } from "vue-sonner";
    import TokenStorage from "@/lib/TokenStorage";
    import { useVuelidate } from "@vuelidate/core";
    import { required, helpers, email, sameAs } from "@vuelidate/validators";



    const props = defineProps({
        settings: Object,
        apiVersion: {
            type: [String, Number],
            default: 1
        }
    });

    const emit = defineEmits(["test","import"]);

    const objectLabel = props.settings.label || '';
    const objectIcon = props.settings.icon || '';
    const objectType = props.settings.type || '';
    const fields = props.settings.fields || [];
    const actions = props.settings.actions || [];
    const actionsCheckboxes = props.settings.fields.filter(f => f.type == 'checkbox' && f.isAction);

    // make a dictionary of the fields with the key as the key of the field and the value as the field itself
    const fieldsDict = fields.reduce((acc, field) => {
        acc[field.key] = field;
        return acc;
    }, {});

    // validation
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
            ruleObj.item[field.key] = rule
        })
        return ruleObj
    };
    const item = ref({});
    const rules = getRules()

    const $v = useVuelidate(rules, { item });
    

    function objectTitle(prefix = '', suffix = '') {
        return `${prefix} ${objectLabel} ${suffix}`.trim()
    }

    async function loadItem() {
        try {
            const result = await axios.get(
                `/api/v${props.apiVersion}/${objectType}/`,
                TokenStorage.getAuthentication()
            );
            if (props.apiVersion == 1) {
                item.value = result.data.data.output;
            } else if (props.apiVersion == 2) {
                item.value = result.data;
            } else {
                throw new Error("Unsupported API version");
            }
            for(const field of props.settings.fields){
                if(field.type == 'checkbox'){
                    item.value[field.key] = !!item.value[field.key]; // convert to boolean
                }
            }

        } catch (err) {
            console.log(objectTitle('Error loading'));
            toast.error(Helpers.parseAxiosResponseError(err, "Failed to load item"));
        }
    }

    function doEmit(action) {

        $v.value.item.$touch();
        if (action == 'test' && isInvalid.value) {
            return;
        }
        emit(action, item.value);
    }



    async function updateItem() {
        if (!isInvalid.value) {
            try{
                const result = await axios.put(`/api/v${props.apiVersion}/${objectType}/`, item.value, TokenStorage.getAuthentication());
                toast.success(objectTitle('', 'is updated'));
                loadItem();
            }catch(err){
                if (props.apiVersion == 2) {
                    const errorMessage = err.response?.data?.error || err.message;
                    const errorDetail = err.response?.data?.details || "";
                    toast.error(errorDetail ? `${errorMessage}: ${errorDetail}` : errorMessage);
                } else {
                    toast.error(Helpers.parseAxiosResponseError(err, "Failed to save item"));
                }
            }
        } else {
            $v.value.item.$touch()
        }
    }


    function isDisabled(field) {
        if (!field.dependency) {
            return false;
        }
        var isCurrentFieldDisabled = false;
        const dependencyField = fieldsDict[field.dependency];
        if(field.negateDependency){
            isCurrentFieldDisabled = item.value[dependencyField.key];
        }else{
            isCurrentFieldDisabled = !item.value[dependencyField.key];
        }
        const isParentFieldDisabled = isDisabled(dependencyField);
        return isCurrentFieldDisabled || isParentFieldDisabled;
    }

    const  isInvalid = computed(() => {
        // check if any field is invalid, but only check the ones that are not disabled
        for (const field of fields) {
            if (!disabledFields.value[field.key] && $v.value.item[field.key].$invalid) {
                return true;
            }
        }
    })

    const disabledFields = computed(() => {
        const disabledFields = {};
        for (const field of fields) {
            disabledFields[field.key] = isDisabled(field);
        }
        return disabledFields;
    })

    const rows = computed(() => {
        const rows = [];
        for (const field of fields) {
            if (field.isAction) {
                continue;
            }
            const line = field.line || 0;
            if (!rows[line]) {
                rows[line] = [];
            }
            rows[line].push(field);
        }
        return rows;
    })

    onMounted(async () => {
        await loadItem();
    });

    defineExpose({
        loadItem
    });
</script>
<template>
    <AppSettings :icon="objectIcon" :title="objectLabel">
        <template #actions>
            <BsInput v-for="field in actionsCheckboxes" type="checkbox" :disabled="disabledFields[field.key]" :isSwitch="true" cssClass="ms-3" v-model="item[field.key]" :label="field.label" />
            <BsButton v-for="action in actions" :icon="action.icon" cssClass="ms-3" :disabled="action.dependency && !item[action.dependency]" @click="doEmit(action.name)">{{ action.title }}</BsButton>
            <BsButton cssClass="ms-3" icon="save" @click="updateItem()">Update</BsButton> 
        </template>
        <template #default>
            <div v-for="cols in rows" class="row">
                <div class="col" v-for="field in cols">
                    <BsInput :isFloating="false" :placeholder="field.placeholder" :description="field.description" :style="field.style" :icon="field.icon" :help="field.help" :type="field.type" v-model="$v.item[field.key].$model" :disabled="disabledFields[field.key]" :label="field.label" :required="field.required" :hasError="$v.item[field.key].$invalid && $v.item[field.key].$dirty && !disabledFields[field.key]" :errors="$v.item[field.key].$errors" />
                </div>
            </div>
        </template>
        <template #footer>
            <slot></slot>
        </template>
    </AppSettings>

</template>