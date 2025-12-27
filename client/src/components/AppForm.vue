<script setup>

/******************************************************************/
/*                                                                */
/*  App AnsibleForms Form component                               */
/*  From yaml, builds a form                                      */
/*  Including validations, defaults, dependencies, ...            */
/*  Dynamic fields are evaluated                                  */
/*                                                                */
/*  @props:                                                       */
/*      currentForm: Object                                       */
/*      constants: Object                                         */
/*      status: String                                            */
/*      submitLabel: String                                       */
/*      submitIcon: String                                        */
/*      showExtraVars: Boolean                                    */
/*      fileProgress: Object                                      */
/*                                                                */
/*  @emits:                                                      */
/*      update:status                                             */
/*      change                                                    */
/*      submit                                                    */
/*      abort                                                     */
/*                                                                */
/******************************************************************/

import { useRoute } from "vue-router";
import { useToast } from "vue-toastification";
import { useVuelidate } from '@vuelidate/core';
import { required, helpers, sameAs } from "@vuelidate/validators";
import { useTemplateRef, nextTick } from "vue";
import { copyText } from 'vue3-clipboard'
import { useAppStore } from "@/stores/app";
import Helpers from '@/lib/Helpers';
import TokenStorage from "@/lib/TokenStorage";
import axios from "axios";

// INIT
//----------------------------------------------------------------

// for vuelidate, no ref needed, a ref will be created by useVuelidate
var v$ = null;

// use
const route = useRoute();
const toast = useToast();
const store = useAppStore();

// define
const emit = defineEmits(["update:status", "change", "submit", "abort"]);

const form = defineModel()

// PROPS
//----------------------------------------------------------------

const props = defineProps(
    {
        currentForm: {
            type: Object,
            required: true
        },
        constants: {
            type: Object,
            required: true
        },
        status: {
            type: String,
            required: true
        },
        submitLabel: {
            type: String,
            default: "Submit"
        },
        submitIcon: {
            type: String,
            default: "circle-play"
        },
        showExtraVars: {
            type: Boolean,
            default: false
        },
        fileProgress: {
            type: Object,
            default: () => { return {} }
        },
        initialData: {
            type: Object,
            default: () => { return {} }
        },
    }
)

// DATA
//----------------------------------------------------------------

const interval = ref(undefined);  // interval how fast fields need to be re-evaluated and refreshed
const externalData = ref({});         // object to hold external data
const hideForm = ref(false);         // flag to hide form
const watchdog = ref(0);                  // main loop counter
const loopDelay = ref(100);                // main loop delay
const isInitializing = ref(false);         // flag set during pre-fill initialization to suppress defaults
const pendingInitialData = ref({});        // tracks initialData fields not yet applied
const dynamicFieldDependencies = ref({});                 // which fields need to be re-evaluated if other fields change
const dynamicFieldDependentOf = ref({});                 // which fields are dependend from others
const unevaluatedFields = ref([]);                 // list of unevaluatedFields
const defaults = ref({});                 // holds default info per field
const dynamicFieldStatus = ref({});                 // holds the status of dynamics fields (running=currently being evaluated, variable=depends on others, fixed=only need 1-time lookup, default=has defaulted, undefined=trigger eval/query)
const queryresults = ref({});                 // holds the results of dynamic dropdown boxes
const queryerrors = ref({});                 // holds errors of dynamic dropdown boxes
const fieldOptions = ref({});                 // holds a couple of fieldoptions for fast access (valueColumn,ignoreIncomplete, ...), only for expression,query and table
const warnings = ref([]);                 // holds form warnings.
const showWarnings = ref(false);              // flag to show/hide warnings
const visibility = ref({});                 // holds which fields are visiable or not
const canSubmit = ref(false);              // flag must be true to enable submit - allows to finish background queries - has a watchdog in case not possible
const validationsLoaded = ref(false);              // ready flag if field validations are ready, we don't show the form otherwise
const pretasksFinished = ref(false);              // ready flag for form pre tasks (future use - use to be gitpulls)
const timeout = ref(undefined);          // determines how long we should show the result of run
const showHidden = ref(false);              // flag to show/hide hidden field / = debug mode
const pauseJsonOutput = ref(false);              // flag to pause jsonoutput interval
const containerSize = ref({
    x: 0,
    width: 0
});          // width of container

const containerRef = useTemplateRef("containerRef");

// COMPUTED
//----------------------------------------------------------------

const status = computed({
    get() {
        return props.status
    },
    set(value) {
        emit('update:status', value)
    }
})

const showDebugButtons = computed(() => {
    return store.profile.options?.showDebugButtons ?? true
})

// calculated fields that are not yet evaluated
const unevaluatedFieldsWarning = computed(() => {
    if (canSubmit.value) {
        return undefined;
    } else {
        return unevaluatedFields.value.join(",") + " " + ((unevaluatedFields.value.length == 1) ? "is" : "are") + " unevaluated...";
    }
});

// vuelidate rules
const rules = computed(() => {
    const ruleObj = { form: {} } // holdes the rules for each field
    props.currentForm.fields.forEach((ff, i) => {
        var rule = {} // holds the rules for a single field
        if(!ff.label){
            ff.label = ff.name
        }
        // required but not for checkboxes, expressions and enums, where we simply expect a value to be present
        if (ff.type != 'checkbox' && ff.type != 'expression' && ff.type != 'enum' && ff.required) {
            rule.required = helpers.withMessage(`${ff.label} is required`, required)
        }
        // required for checkboxes (we required the value to be true)
        if (ff.type == 'checkbox' && ff.required) {
            rule.checkboxRequired = helpers.withMessage(`${ff.label} is required`, sameAs(computed(() => true)))
        }
        // required for expressions and enums, the value must be present, but can be a special value like __auto__, __none__ or __all__
        if (((ff.type == 'expression') || (ff.type == 'enum')) && ff.required) {
            var description = `${ff.label} is required`
            rule.required = helpers.withParams(
                { description: description, type: "required" },
                (value) => (value != undefined && value != null && value != '__auto__' && value != '__none__' && value != '__all__')
            )
        }
        // min and max size for files
        if ("minSize" in ff) {
            if (ff.type == 'file') {
                const hasPlaceholder = typeof ff.minSize === 'string' && /\$\(([^)]+)\)/.test(ff.minSize);
                
                if (hasPlaceholder) {
                    rule.minSize = helpers.withParams(
                        { 
                            description: computed(() => {
                                const result = replacePlaceholderInString(String(ff.minSize), false);
                                const resolvedValue = result.value !== undefined ? Number(result.value) : ff.minSize;
                                return `Size (${Helpers.humanFileSize(form.value[ff.name]?.size)}) cannot be lower than ${Helpers.humanFileSize(resolvedValue)}`;
                            }),
                            type: "minSize" 
                        },
                        (file) => {
                            if (!helpers.req(file?.name)) return true;
                            const result = replacePlaceholderInString(String(ff.minSize), false);
                            if (result.value === undefined) return true;
                            const minVal = Number(result.value);
                            if (isNaN(minVal)) {
                                console.warn(`minSize placeholder resolved to non-numeric value: ${result.value}`);
                                return true;
                            }
                            return file?.size >= minVal;
                        }
                    );
                } else {
                    const numericMin = Number(ff.minSize);
                    var description = `Size (${Helpers.humanFileSize(form.value[ff.name]?.size)}) cannot be lower than ${Helpers.humanFileSize(numericMin)}`
                    rule.minSize = helpers.withParams(
                        { description: description, type: "minSize" },
                        (file) => !helpers.req(file?.name) || file?.size >= numericMin
                    );
                }
            }
        }
        if ("maxSize" in ff) {
            if (ff.type == 'file') {
                const hasPlaceholder = typeof ff.maxSize === 'string' && /\$\(([^)]+)\)/.test(ff.maxSize);
                
                if (hasPlaceholder) {
                    rule.maxSize = helpers.withParams(
                        { 
                            description: computed(() => {
                                const result = replacePlaceholderInString(String(ff.maxSize), false);
                                const resolvedValue = result.value !== undefined ? Number(result.value) : ff.maxSize;
                                return `Size (${Helpers.humanFileSize(form.value[ff.name]?.size)}) cannot be higher than ${Helpers.humanFileSize(resolvedValue)}`;
                            }),
                            type: "maxSize" 
                        },
                        (file) => {
                            if (!helpers.req(file?.name)) return true;
                            const result = replacePlaceholderInString(String(ff.maxSize), false);
                            if (result.value === undefined) return true;
                            const maxVal = Number(result.value);
                            if (isNaN(maxVal)) {
                                console.warn(`maxSize placeholder resolved to non-numeric value: ${result.value}`);
                                return true;
                            }
                            return file?.size <= maxVal;
                        }
                    );
                } else {
                    const numericMax = Number(ff.maxSize);
                    description = `Size (${Helpers.humanFileSize(form.value[ff.name]?.size)}) cannot be higher than ${Helpers.humanFileSize(numericMax)}`
                    rule.maxSize = helpers.withParams(
                        { description: description, type: "maxSize" },
                        (file) => !helpers.req(file?.name) || file?.size <= numericMax
                    );
                }
            }
        }
        // min and max value for numbers
        if ("minValue" in ff) {
            const hasPlaceholder = typeof ff.minValue === 'string' && /\$\(([^)]+)\)/.test(ff.minValue);
            
            if (hasPlaceholder) {
                rule.minValue = helpers.withParams(
                    { 
                        description: computed(() => {
                            const result = replacePlaceholderInString(String(ff.minValue), false);
                            const resolvedValue = result.value !== undefined ? result.value : ff.minValue;
                            return `${ff.label} must be at least ${resolvedValue}`;
                        }),
                        type: "minValue" 
                    },
                    (value) => {
                        if (!helpers.req(value)) return true;
                        const result = replacePlaceholderInString(String(ff.minValue), false);
                        if (result.value === undefined) return true;
                        const minVal = Number(result.value);
                        if (isNaN(minVal)) {
                            console.warn(`minValue placeholder resolved to non-numeric value: ${result.value}`);
                            return true;
                        }
                        return value >= minVal;
                    }
                );
            } else {
                const numericMin = Number(ff.minValue);
                var description = `${ff.label} must be at least ${numericMin}`;
                rule.minValue = helpers.withParams(
                    { description: description, type: "minValue" },
                    (value) => !helpers.req(value) || value >= numericMin
                );
            }
        }
        if ("maxValue" in ff) {
            const hasPlaceholder = typeof ff.maxValue === 'string' && /\$\(([^)]+)\)/.test(ff.maxValue);
            
            if (hasPlaceholder) {
                rule.maxValue = helpers.withParams(
                    { 
                        description: computed(() => {
                            const result = replacePlaceholderInString(String(ff.maxValue), false);
                            const resolvedValue = result.value !== undefined ? result.value : ff.maxValue;
                            return `${ff.label} must be at most ${resolvedValue}`;
                        }),
                        type: "maxValue" 
                    },
                    (value) => {
                        if (!helpers.req(value)) return true;
                        const result = replacePlaceholderInString(String(ff.maxValue), false);
                        if (result.value === undefined) return true;
                        const maxVal = Number(result.value);
                        if (isNaN(maxVal)) {
                            console.warn(`maxValue placeholder resolved to non-numeric value: ${result.value}`);
                            return true;
                        }
                        return value <= maxVal;
                    }
                );
            } else {
                const numericMax = Number(ff.maxValue);
                var description = `${ff.label} must be at most ${numericMax}`;
                rule.maxValue = helpers.withParams(
                    { description: description, type: "maxValue" },
                    (value) => !helpers.req(value) || value <= numericMax
                );
            }
        }
        // min and max length for strings
        if ("minLength" in ff) {
            const hasPlaceholder = typeof ff.minLength === 'string' && /\$\(([^)]+)\)/.test(ff.minLength);
            
            if (hasPlaceholder) {
                rule.minLength = helpers.withParams(
                    { 
                        description: computed(() => {
                            const result = replacePlaceholderInString(String(ff.minLength), false);
                            const resolvedValue = result.value !== undefined ? result.value : ff.minLength;
                            return `${ff.label} must be at least ${resolvedValue} characters long`;
                        }),
                        type: "minLength" 
                    },
                    (value) => {
                        if (!helpers.req(value)) return true;
                        const result = replacePlaceholderInString(String(ff.minLength), false);
                        if (result.value === undefined) return true;
                        const minLen = Number(result.value);
                        if (isNaN(minLen)) {
                            console.warn(`minLength placeholder resolved to non-numeric value: ${result.value}`);
                            return true;
                        }
                        return value.length >= minLen;
                    }
                );
            } else {
                const numericMin = Number(ff.minLength);
                var description = `${ff.label} must be at least ${numericMin} characters long`;
                rule.minLength = helpers.withParams(
                    { description: description, type: "minLength" },
                    (value) => !helpers.req(value) || value.length >= numericMin
                );
            }
        }
        if ("maxLength" in ff) {
            const hasPlaceholder = typeof ff.maxLength === 'string' && /\$\(([^)]+)\)/.test(ff.maxLength);
            
            if (hasPlaceholder) {
                rule.maxLength = helpers.withParams(
                    { 
                        description: computed(() => {
                            const result = replacePlaceholderInString(String(ff.maxLength), false);
                            const resolvedValue = result.value !== undefined ? result.value : ff.maxLength;
                            return `${ff.label} must be at most ${resolvedValue} characters long`;
                        }),
                        type: "maxLength" 
                    },
                    (value) => {
                        if (!helpers.req(value)) return true;
                        const result = replacePlaceholderInString(String(ff.maxLength), false);
                        if (result.value === undefined) return true;
                        const maxLen = Number(result.value);
                        if (isNaN(maxLen)) {
                            console.warn(`maxLength placeholder resolved to non-numeric value: ${result.value}`);
                            return true;
                        }
                        return value.length <= maxLen;
                    }
                );
            } else {
                const numericMax = Number(ff.maxLength);
                var description = `${ff.label} must be at most ${numericMax} characters long`;
                rule.maxLength = helpers.withParams(
                    { description: description, type: "maxLength" },
                    (value) => !helpers.req(value) || value.length <= numericMax
                );
            }
        }
        // regex validation
        if ("regex" in ff) {
            var regexObj = new RegExp(ff.regex.expression)
            var description = computed(() => {
                const result = replacePlaceholderInString(ff.regex.description, false);
                return result.value !== undefined ? result.value : ff.regex.description;
            });
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
        // validIf and validIfNot
        if ("validIf" in ff) {
            var description = computed(() => {
                const result = replacePlaceholderInString(ff.validIf.description, false);
                return result.value !== undefined ? result.value : ff.validIf.description;
            });
            rule.validIf = helpers.withParams(
                { description: description, type: "validIf" },
                (value) => !helpers.req(value) || !!form.value[ff.validIf.field]
            )
        }
        if ("validIfNot" in ff) {
            var description = computed(() => {
                const result = replacePlaceholderInString(ff.validIfNot.description, false);
                return result.value !== undefined ? result.value : ff.validIfNot.description;
            });
            rule.validIfNot = helpers.withParams(
                { description: description, type: "validIfNot" },
                (value) => !helpers.req(value) || !form.value[ff.validIfNot.field]
            )
        }
        // notIn and in
        if ("notIn" in ff) {
            var description = computed(() => {
                const result = replacePlaceholderInString(ff.notIn.description, false);
                return result.value !== undefined ? result.value : ff.notIn.description;
            });
            rule.notIn = helpers.withParams(
                { description: description, type: "notIn" },
                (value) => !helpers.req(value) || (form.value[ff.notIn.field] != undefined && Array.isArray(form.value[ff.notIn.field]) && !form.value[ff.notIn.field].includes(value))
            )
        }
        if ("in" in ff) {
            var description = computed(() => {
                const result = replacePlaceholderInString(ff.in.description, false);
                return result.value !== undefined ? result.value : ff.in.description;
            });
            rule.in = helpers.withParams(
                { description: description, type: "in" },
                (value) => !helpers.req(value) || (form.value[ff.in.field] != undefined && Array.isArray(form.value[ff.in.field]) && form.value[ff.in.field].includes(value))
            )
        }
        if ("sameAs" in ff) {
            var description = `Must match the field '${props.currentForm.fields.find((x) => ff.sameAs == x.name).label || ff.sameAs}'`
            rule.sameAs = helpers.withParams(
                { description: description, type: "sameAs" },
                (value) => !helpers.req(value) || (form.value[ff.sameAs] != undefined && value == form.value[ff.sameAs])
            )
        }

        ruleObj.form[ff.name] = rule
    })
    return ruleObj
})

// form is ready when all validations are loaded, the form is loaded and all pretasks are finished
const formIsReady = computed(() => validationsLoaded.value && pretasksFinished.value);

// set field groups in to groups
const fieldGroups = computed(() => {
    // bundle all groups and make unique
    return props.currentForm.fields?.reduce((pV, cV) => {
        if ("group" in cV) {
            return [...pV, cV.group];
        } else {
            return pV;
        }
    }, [""])
        .filter((v, i, a) => a.indexOf(v) === i) || []

})

// set fieldLines in to groups
const fieldLines = computed(() => {

    var linecount = 0
    return props.currentForm.fields?.reduce((pV, cV, cI) => {
        linecount++
        if ("line" in cV) {
            return [...pV, cV.line];
        } else {
            props.currentForm.fields[cI].line = `__line__${linecount}`
            return [...pV, `__line__${linecount}`];
        }
    }, [""]).filter((v, i, a) => a.indexOf(v) === i) || [];
})

// flag if formloop is busy or not (evaluating fields)
const formLoopIsBusy = computed(() => loopDelay.value != 500)

// the interval to refresh json generation
const loopDivider = computed(() => 5000 / loopDelay.value);

// computed field labels with placeholder support
const fieldLabels = computed(() => {
    const labels = {};
    props.currentForm.fields?.forEach(field => {
        if (field.label && typeof field.label === 'string' && /\$\(([^)]+)\)/.test(field.label)) {
            // Has placeholder - create reactive computed
            labels[field.name] = computed(() => {
                form.value; // Track form for reactivity
                const result = replacePlaceholderInString(field.label, false);
                return result.value !== undefined ? result.value : field.label;
            });
        } else {
            // No placeholder - use static value
            labels[field.name] = field.label || field.name;
        }
    });
    return labels;
});

// computed field help text with placeholder support
const fieldHelp = computed(() => {
    const help = {};
    props.currentForm.fields?.forEach(field => {
        if (field.help && typeof field.help === 'string' && /\$\(([^)]+)\)/.test(field.help)) {
            // Has placeholder - create reactive computed
            help[field.name] = computed(() => {
                form.value; // Track form for reactivity
                const result = replacePlaceholderInString(field.help, false);
                return result.value !== undefined ? result.value : field.help;
            });
        } else {
            // No placeholder - use static value
            help[field.name] = field.help || '';
        }
    });
    return help;
});

// computed field placeholders with placeholder support
const fieldPlaceholders = computed(() => {
    const placeholders = {};
    props.currentForm.fields?.forEach(field => {
        if (field.placeholder && typeof field.placeholder === 'string' && /\$\(([^)]+)\)/.test(field.placeholder)) {
            // Has placeholder - create reactive computed
            placeholders[field.name] = computed(() => {
                form.value; // Track form for reactivity
                const result = replacePlaceholderInString(field.placeholder, false);
                return result.value !== undefined ? result.value : field.placeholder;
            });
        } else {
            // No placeholder - use static value
            placeholders[field.name] = field.placeholder || '';
        }
    });
    return placeholders;
});

// METHODS
//----------------------------------------------------------------

function changed() {
    emit('change', { visibility: visibility.value })
}

// we inject the file into the form validation object
async function handleFiles(e) {
    const name = e.target.name;
    const files = e.target.files;
    if (!name) return;
    if (!files) return;
    form.value[name] = files[0];
    v$.value.form[name].$touch();
}

// calculate the size of the container
function calcContainerSize() {
    var rect = containerRef.value?.getBoundingClientRect();
    if (rect) {
        containerSize.value.x = rect.x;
        containerSize.value.width = rect.width;
    }
}

// prevent default focus
function preventFocus(e) {
    e.preventDefault();
}

// set some expression field options
function setExpressionFieldEditable(fieldname, value) {
    if (typeof form.value[fieldname] == 'string' || typeof form.value[fieldname] == 'number' || form.value[fieldname] == undefined) {
        fieldOptions.value[fieldname].editable = value
    } else {
        toast.warning("You can only edit string or number expression fields.")
    }
    if (!value) {
        resetField(fieldname)
    }
}

function setExpressionFieldViewable(fieldname, value) {
    fieldOptions.value[fieldname].viewable = value
}

function setExpressionFieldDebug(fieldname, value) {
    fieldOptions.value[fieldname].debug = value
}

// copy to clipboard
function clip(v, doNotStringify = false) {
    try {
        if (doNotStringify) {
            copyText(v)
        } else {
            copyText(JSON.stringify(v))
        }
        toast.success("Copied to clipboard")
    } catch (err) {
        toast.error("Error copying to clipboard : \n" + err.toString())
    }
}

// Create a list of fields per group
function filterfieldsByGroup(group) {
    return props.currentForm.fields.filter((el) => {
        return (
            (("group" in el && el.group === group)
                || !("group" in el) && (group == ""))
            && (el.hide !== true || showHidden.value))
    });
}

// create of fields per group & line
function filterfieldsByGroupAndLine(group, line) {
    const fields = filterfieldsByGroup(group).filter((el) => {
        return (
            (("line" in el && el.line === line)
                || !("line" in el) && (line == ""))
            && (el.hide !== true || showHidden.value))
    });
    // console.log(`[${group || 'default'}] [${line}] => ${fields.map(x => x.name).join(",")}`)
    return fields
}

// check if a field must be shown based on dependencies
function checkDependencies(field) {
    const dependencyFn = field.dependencyFn || "and";
    const isAnd = (dependencyFn == "and" || dependencyFn == "nand");
    const isOr = (dependencyFn == "or" || dependencyFn == "nor");

    if ("dependencies" in field) {
        var result
        if (dependencyFn == "and" || dependencyFn == "nand") {
            result = true // and starts with true
        } else {
            result = false // or starts with false
        }
        for (let i = 0; i < field.dependencies.length; i++) {
            const item = field.dependencies[i]
            var value = undefined
            var column = ""
            var inversed = item.name.startsWith("!")                            // detect ! => inversion
            var fieldname = inversed ? item.name.slice(1) : item.name           // drop the !
            var columnRegex = /(.+)\.(.+)/g;                                     // detect a "." in the field
            var tmpArr = columnRegex.exec(fieldname)                             // found aaa.bbb
            var tmp
            if (tmpArr && tmpArr.length > 0) {
                fieldname = tmpArr[1]                                          // aaa
                column = tmpArr[2]                                             // bbb
            } else {
                if (fieldname in fieldOptions.value) {
                    column = fieldOptions.value[fieldname].valueColumn || ""         // get placeholder column
                }
            }
            if (column) {
                value = Helpers.getFieldValue(form.value[fieldname], column, false)
            } else {
                value = form.value[fieldname]
            }

            // dependency on validated
            if (item.isValid != undefined) {
                if(fieldOptions.value[fieldname]['hasDependencies'] || false){
                    tmp = (item.isValid != (v$.value.form[fieldname]?.$invalid)) && fieldOptions.value[fieldname]['dependencyOk']
                }else{
                    tmp = item.isValid != (v$.value.form[fieldname]?.$invalid)
                }
                if (isAnd && ((!inversed && !tmp) || ((inversed && tmp)))) {
                    result = false
                    // console.log("and not valid")
                    break
                }
                if (isOr && ((!inversed && tmp) || (inversed && !tmp))) {
                    result = true
                    // console.log("or valid")
                    break
                }
            } else {
                tmp = item.values?.includes(value)
                if (isAnd && ((!inversed && !tmp) || ((inversed && tmp)))) {
                    result = false
                    // console.log("and not valid")
                    break
                }
                if (isOr && ((!inversed && tmp) || (inversed && !tmp))) {
                    result = true
                    // console.log("or valid")
                    break
                }
            }

        }
        // console.log("sub => " + result)
        // invert if nand or nor
        if (dependencyFn == "nand" || dependencyFn == "nor") {
            result = !result
            // console.log("inverting")
        }
        // console.log("final => " + result)
        fieldOptions.value[field.name]["dependencyOk"] = result
        if (result) {
            setVisibility(field.name, true)
        } else {
            setVisibility(field.name, false)
        }
    }
}

// set field visibility
function setVisibility(fieldname, status) {
    if (visibility.value[fieldname] != status) {
        visibility.value[fieldname] = status
        resetField(fieldname)
    }
}

//----------------------------------------------------------------
// check if an entire group can be shown, based on field depencies
// hide a group if all fields inside are hidden
//----------------------------------------------------------------
function checkGroupDependencies(group) {
    var result = false
    filterfieldsByGroup(group).forEach((item, i) => {
        if (visibility.value[item.name]) {
            result = true
        }
    });
    return result
}

// get group class
function getGroupClass(group) {
    var result = []
    if (checkGroupDependencies(group)) {
        result.push('card')
        if (group && props.currentForm.fieldGroupClasses) {
            var bg = props.currentForm.fieldGroupClasses[group]
            if (bg)
                result.push(bg)
        }
    }
    return result
}

// reset value of field - only for expression
function resetField(fieldname) {
    // reset to default value
    // reset this field status
    // console.log(`[${fieldname}] reset`)
    initiateDefaults(fieldname)
    setFieldStatus(fieldname, undefined)
    form.value[fieldname] = defaults.value[fieldname]
}

// reset number field => input type number seems to evaluate to empty string instead of undefined
function setFieldUndefined(fieldname) {
    // reset to undefined
    form.value[fieldname] = undefined;
    evaluateDynamicFields(fieldname);
    changed() // refresh json output
}

// reset all fields
function resetFields() {
    props.currentForm.fields.forEach((item, i) => {
        resetField(item.name)
    });
}

// instead of taking the default value, see if it needs to be evaluated
// allowing dynamic defaults
function getDefaultValue(fieldname, value) {
    if (value != undefined) {
        var _value = replacePlaceholderInString(value).value
        // console.log(`${fieldname} -> ${value} -> ${_value}`)
        if (fieldOptions.value[fieldname].evalDefault) {
            var r = undefined
            try {
                r = Helpers.evalSandbox(_value)
                return r
            } catch (err) {
                console.log(`Error evaluating default value : ${err.toString()}`)
            }
        } else {
            return _value
        }
    } else {
        return value
    }
}

// load default value in field => only for expressions
function setFieldToDefault(fieldname) {
    // reset to default value
    // console.log(`defaulting ${fieldname}`)
    try {
        // During initialization, check if field is in pending queue
        if (isInitializing.value && fieldname in pendingInitialData.value) {
            console.log(`[INIT] Skipping default for ${fieldname} - waiting for initialData`);
            return; // Don't apply default, let initialData win
        }
        
        // if there is a default, set "default" status
        if (defaults.value[fieldname] != undefined) {
            setFieldStatus(fieldname, "default")
        }
        else {
            // if no default, set to undefined
            var prevState = dynamicFieldStatus.value[fieldname]

            if (prevState == "running") {
                // console.log(`defaulting ${fieldname}`)
                // if the field was running, don't re-eval, we just did that
                setFieldStatus(fieldname, undefined, false)
            } else {
                // if the field was something diff, re-eval
                // console.log(`defaulting ${fieldname}`)
                setFieldStatus(fieldname, undefined, true)
            }
        }
        // set default value
        form.value[fieldname] = defaults.value[fieldname]
    } catch (err) {
        // this error should not hit, unless we have a bug
        console.log("Error: " + err.toString())
        throw err
    }
}

// set dynamic field status, only for expressions and table
function setFieldStatus(fieldname, status, reeval = true) {
    // console.log(`[${fieldname}] ----> ${status}`)
    if (fieldOptions.value[fieldname]?.isDynamic) {
        var prevState = dynamicFieldStatus.value[fieldname]
        dynamicFieldStatus.value[fieldname] = status
        if (reeval && (prevState != status)) {
            // re-evaluate if need
            evaluateDynamicFields(fieldname)
        }
    }
}

// if 2 dependend fields (parent-child) both have defaults
// this can potentially be an issue.
// parent could fall back to default before the child is evaluated
// we track this status and loop a continuous loop on the parent
// if the parent cannot be resolved however, this becomes an infinite loop => we flag this as warning
function hasDefaultDependencies(fieldname) {
    var result = false
    if (dynamicFieldDependentOf.value[fieldname] && dynamicFieldStatus.value[fieldname] == "default") {
        dynamicFieldDependentOf.value[fieldname].forEach((item, i) => {
            if ((defaults.value[item] != undefined) && dynamicFieldStatus.value[item] == "default") {
                result = true
            }
        })
    }
    return result
}

// first time run, load all the default values (can be dynamic)
function initiateDefaults(fieldname = undefined) {
    props.currentForm.fields.filter(x => !fieldname || fieldname == x.name).forEach((item, i) => {
        // During initialization, use initialData as the default (overrides everything)
        if (isInitializing.value && item.name in pendingInitialData.value) {
            defaults.value[item.name] = pendingInitialData.value[item.name];
            console.log(`[INIT] Set default from initialData: ${item.name}`);
        } else if (item.name in externalData.value) {
            defaults.value[item.name] = externalData.value[item.name]
        } else {
            defaults.value[item.name] = getDefaultValue(item.name, item.default)
        }
    })
}

// add warning for bad table values
// a table is expecting a data format
// we flag a warning if the data provided is missing columns
function addTableWarnings(name, data) {
    var c = (data.length > 1) ? "Columns" : "Column"
    var i = (data.length > 1) ? "are" : "is"
    warnings.value.push(`<span class="text-warning">Table '${name}' has missing data</span><br><span>${c} '${data}' ${i} missing.</span>`)
}

// add dynamic field dependency
function addDynamicFieldDependency(fields, field, foundfield) {
    var columnRegex = /([^.]+)\..+/g;                                    // detect a "." in the field
    var tmpArr = columnRegex.exec(foundfield)                             // found aaa.bbb
    if (tmpArr && tmpArr.length > 0) {
        foundfield = tmpArr[1]                                            // aaa
    }
    foundfield = foundfield?.replace(/\[[0-9]*\]/, '') // xxx[y] => xxx
    if (fields.includes(foundfield)) {                         // does field xxx exist in our form ?
        if (foundfield in dynamicFieldDependencies.value) {															 // did we declare it before ?
            if (dynamicFieldDependencies.value[foundfield].indexOf(field) === -1) {  // allready in there ?
                dynamicFieldDependencies.value[foundfield].push(field);												 // push it
                if (foundfield == field) {
                    // we capture self references
                    warnings.value.push(`<span class="text-warning">'${foundfield}' has a self reference</span><br><span>This will cause a racing condition</span>`)
                    toast.error("You defined a self reference on field '" + foundfield + "'")
                }
            }
        } else {
            dynamicFieldDependencies.value[foundfield] = [field]
            if (foundfield == field) {
                // we capture self references
                warnings.value.push(`<span class="text-warning">'${foundfield}' has a self reference</span><br><span>This will cause a racing condition</span>`)
                toast.error("You defined a self reference on field '" + foundfield + "'")
            }
        }
    } else {
        // we capture bad references
        if (!Object.keys(form.value).includes(foundfield))
            warnings.value.push(`<span class="text-warning">'${field}' has a reference to unknown field '${foundfield}'</span><br><span>Your form might not function as expected</span>`)
    }
}

// get placeholder matches
function getPlaceholderMatches(fields, field, s) {
    var matches = []
    // console.log(typeof s)
    if (s && typeof s == "string") {
        var testRegex = /\$\(([^)]+)\)/g;
        matches = s.matchAll(testRegex)
    }
    for (var match of matches) {
        // foundmatch = match[0];                                              // found $(xxx)
        var foundfield = match[1];                                             // found xxx
        addDynamicFieldDependency(fields, field, foundfield)
    }
}

// Find variable devDependencies
// we analyse which fields are dependent on others
// if they change, we then know which other fields to re-evaluate
function findVariableDependencies() {
    var temp = {}
    var finishedFlag = false
    var fields = []
    // create a list of the fields
    props.currentForm.fields.forEach((item, i) => {
        if (!item?.name) return
        fields.push(item.name)
    })
    // whilst checking, we also check if fields are unique
    var dups = Helpers.findDuplicates(fields)
    dups.forEach((item, i) => {
        warnings.value.push(`<span class="text-warning">'${item}' has duplicates</span><br><span>Each field must have a unique name</span>`)
        toast.error("You have duplicates for field '" + item + "'")
    })
    // do the analysis
    props.currentForm.fields.forEach((item, i) => {
        // while we are looping, we also check if there are issues
        if (!item?.name) return
        if (item.dependencies) {
            item.dependencies.forEach((dep) => {
                if (!(fields.includes(dep.name) || (dep.name?.startsWith("!") && fields.includes(dep.name.slice(1))))) {
                    warnings.value.push(`<span class="text-warning">'${item.name}' has bad dependencies</span><br><span>${dep.name} is not a valid field name</span>`)
                }
            })
        }
        if (item.notIn && !fields.includes(item.notIn.field)) {
            warnings.value.push(`<span class="text-warning">'${item.name}' has bad 'notIn' validation</span><br><span>${item.notIn.field} is not a valid field name</span>`)
        }
        if (item.in && !fields.includes(item.in.field)) {
            warnings.value.push(`<span class="text-warning">'${item.name}' has bad 'in' validation</span><br><span>${item.in.field} is not a valid field name</span>`)
        }
        if (item.sameAs && !fields.includes(item.sameAs)) {
            warnings.value.push(`<span class="text-warning">'${item.name}' has bad 'sameAs' validation</span><br><span>${item.sameAs} is not a valid field name</span>`)
        }

        // query type is now deprecated
        if (item.type == 'query') {
            warnings.value.push(`<span class="text-warning">'${item.name}' has the deprecated query type</span><br><span>Use enum type instead.</span>`)
        }

        getPlaceholderMatches(fields, item.name, item.expression ?? item.query)
        getPlaceholderMatches(fields, item.name, item.default)
    })

    // check self references
    while (!finishedFlag) {
        finishedFlag = true
        temp = Helpers.deepClone(dynamicFieldDependencies.value); // copy dependencies to temp
        for (const [key, value] of Object.entries(temp)) {
            // loop all found dependencies and dig deeper
            value.forEach((item, i) => {
                if (item in temp) { // can we go deeper?
                    temp[item].forEach((item2, j) => {
                        if (dynamicFieldDependencies.value[key].indexOf(item2) === -1) { // already in there?
                            dynamicFieldDependencies.value[key].push(item2); // push it
                            if (key == item2) {
                                // we capture self references
                                warnings.value.push(`<span class="text-warning">'${key}' has a self reference</span><br><span>This will cause a racing condition</span>`)
                                toast.error("You defined a self reference on field '" + key + "'")
                            }
                            finishedFlag = false
                        }
                    })
                }
            })
        }
    }
}

// search which fields are dependent of others
function findVariableDependentOf() {
    var foundmatch, foundfield
    var fields = []
    // create a list of the fields
    props.currentForm.fields.forEach((item, i) => {
        if (!item?.name) return
        fields.push(item.name)
    })
    props.currentForm.fields.forEach((item, i) => {
        if (["expression"].includes(item.type)) {
            var testRegex = /\$\(([^)]+)\)/g;
            var matches = (item.expression || item.query || '').matchAll(testRegex);
            for (var match of matches) {
                foundmatch = match[0];                                              // found $(xxx)
                foundfield = match[1];                                              // found xxx
                var columnRegex = /(.+)\.(.+)/g;                                        // detect a "." in the field
                var tmpArr = columnRegex.exec(foundfield)                             // found aaa.bbb
                if (tmpArr && tmpArr.length > 0) {
                    foundfield = tmpArr[1]                                            // aaa
                }
                if (fields.includes(foundfield)) {                         // does field xxx exist in our form ?
                    if (item.name in dynamicFieldDependentOf.value) {															 // did we declare it before ?
                        if (dynamicFieldDependentOf.value[item.name].indexOf(foundfield) === -1) {  // already in there ?
                            dynamicFieldDependentOf.value[item.name].push(foundfield);												 // push it
                        }
                    } else {
                        dynamicFieldDependentOf.value[item.name] = [foundfield]
                    }
                    // track the dependent default => = potentially bad
                    if ((defaults.value[item.name] != undefined) && fieldOptions.value[foundfield] && (fieldOptions.value[foundfield].type == "expression") && (defaults.value[foundfield] != undefined)) {
                        warnings.value.push(`<span class="text-warning">'${item.name}' has a default, referencing field '${foundfield}' which also has a default</span><br><span>Try to avoid dependent fields with both a default</span>`)
                    }
                }
            }
        }
    })
}

function replacePlaceholderInString(value, ignoreIncomplete = false) {
    //---------------------------------------
    // replace placeholders if possible
    //---------------------------------------
    var testRegex = /\$\(([^)]+)\)/g                                        // a regex to find field placeholders $(xxx)
    var retestRegex = /\$\(([^)]+)\)/g                                      // the same regex, to retest after, because a regex can only be used once
    var match = undefined
    var matches = undefined
    var foundmatch = false
    var column = ""
    var foundfield = false
    var fieldvalue = ""
    var keys = undefined
    var targetflag = undefined
    var hasPlaceholders = false
    if (typeof value !== "string") {
        return { "hasPlaceholders": false, "value": value }
    }
    value = value?.replace(/\n+/g, '') // put everything in 1 line.
    matches = [...value.matchAll(testRegex)] // force match array
    for (match of matches) {
        foundmatch = match[0];                                              // found $(xxx)
        foundfield = match[1];                                              // found xxx
        var columnRegex = /([^.]+)\.(.+)/g;                                        // detect a "." in the field
        var tmpArr = columnRegex.exec(foundfield)                             // found aaa.bbb
        if (tmpArr && tmpArr.length > 0) {
            foundfield = tmpArr[1]                                            // aaa
            column = tmpArr[2]                                                  // bbb
        } else {
            if (foundfield in fieldOptions.value) {
                column = fieldOptions.value[foundfield].placeholderColumn || ""        // get placeholder column
            }
        }
        foundfield = foundfield?.replace(/\[[0-9]*\]/, '') // make xxx[y] => xxx
        fieldvalue = undefined
        targetflag = undefined

        if (foundfield in form.value) {      // does field xxx exist in our form ?
            if (fieldOptions.value[foundfield] && (["expression", "table", "constant"].includes(fieldOptions.value[foundfield].type) || column.includes(".")) && ((typeof form.value[foundfield] == "object") || (Array.isArray(form.value[foundfield])))) {
                fieldvalue = JSON.stringify(Helpers.replacePlaceholders(match[1], form.value)) // allow full object reference
                if (typeof fieldvalue == "string") { // drop quotes if string
                    fieldvalue = fieldvalue?.replace(/^\"+/, '').replace(/\"+$/, ''); // eslint-disable-line
                }
            } else {
                fieldvalue = Helpers.getFieldValue(form.value[foundfield], column, true);// get value of aaa.bbb
            }
            if (foundfield in dynamicFieldStatus.value) {
                targetflag = dynamicFieldStatus.value[foundfield];                  // and what is the currect status of xxx, in case it's also dyanmic ?
            } else {
                targetflag = "fixed"
            }
        }
        if (((targetflag == "variable" || targetflag == "fixed" || targetflag == "default") && fieldvalue !== undefined) || ((ignoreIncomplete || false) && value !== undefined)) {                // valid value ?
            if (fieldvalue === undefined) {
                fieldvalue = "__undefined__"   // catch undefined values
            }
            if (fieldvalue === null) {
                fieldvalue = "__null__"   // catch null values
            }
            fieldvalue = stringifyValue(fieldvalue)
            value = value?.replace(foundmatch, fieldvalue);               // replace the placeholder with the value
        } else {
            value = undefined      // cannot evaluate yet
        }
        hasPlaceholders = true;
    }
    if (retestRegex.test(value)) {                     // still placeholders found ?
        value = undefined                           // cannot evaluate yet
    }
    if (value != undefined) {
        value = value.replaceAll("'__undefined__'", "undefined")  // replace undefined values
        value = value.replaceAll("__undefined__", "undefined")
        value = value.replaceAll("'__null__'", "null")  // replace undefined values
        value = value.replaceAll("__null__", "null")
    }
    return { "hasPlaceholders": hasPlaceholders, "value": value }          // return the result
}

// replace placeholders
function replacePlaceholders(item) {
    //---------------------------------------
    // replace placeholders if possible
    //---------------------------------------
    var newValue = item.expression || item.query   // make a copy of our item
    return replacePlaceholderInString(newValue, item.ignoreIncomplete)
}
// stringify value if needed
function stringifyValue(fieldvalue) {
    if (typeof fieldvalue === 'object' || Array.isArray(fieldvalue)) {
        return JSON.stringify(fieldvalue) // if object, we need to stringify it
    } else {
        return fieldvalue
    }
}
// make a string impression of a value
function stringifyObject(v) {
    if (v) {
        if (Array.isArray(v)) {
            return "[ Array ]"
        }
        if (typeof v == "object") {
            return "{ Object }"
        }
        return v.toString()
    } else {
        return v
    }
}

// in case of unexpected error in the etneral loop, we stop the loop
function stopLoop(error) {
    clearInterval(interval.value)
    toast.error("Expression interval stopped !\n" + error)
}

// trigger this when a field has changed and we need to see if it has an impact.
function evaluateDynamicFields(fieldname) {
    // console.log(`${fieldname} changed`)
    // if this field is dependency
    if (fieldname in dynamicFieldDependencies.value) {  // are any fields dependent from this field ?
        canSubmit.value = false; // after each dependency reset, we block submitting, untill all fields are resolved
        // set all variable ones to dirty
        dynamicFieldDependencies.value[fieldname].forEach((item, i) => { // loop all dynamic fields and reset them
            // set all variable fields blank and re-evaluate
            if (!fieldOptions.value[item].editable) {
                // all dependent fields we reset, so they can be re-evaluated
                resetField(item)
            }
        })
    }
    calcContainerSize();
}

// validate form before submit
function validateForm() {
    var isValid = true;
    // final touch to force validation
    v$.value.form.$touch();
    // loop all fields and check if it valid, skip hidden fields
    props.currentForm.fields.forEach((item) => {
        if (visibility.value[item.name] && v$.value.form[item.name]?.$invalid) {
            isValid = false;
        }
    });
    if (!isValid) {
        toast.warning("Form contains invalid data");
        return false; // do not start if form is invalid
    } else {
        return true;
    }
}

// initiate the defaults
function initForm() {
    pretasksFinished.value = false;
    interval.value = undefined;
    dynamicFieldDependencies.value = {};
    dynamicFieldDependentOf.value = {};
    defaults.value = {};
    dynamicFieldStatus.value = {};
    queryresults.value = {};
    queryerrors.value = {};
    fieldOptions.value = {};
    warnings.value = [];
    showWarnings.value = false;
    visibility.value = {};
    canSubmit.value = false;
    pretasksFinished.value = false;
    timeout.value = undefined;
    pendingInitialData.value = {};
    isInitializing.value = false;

    // Check if we have initialData to apply
    const hasInitialData = Object.keys(props.initialData).length > 0;
    if (hasInitialData) {
        console.log('[INIT] Pre-fill data provided:', Object.keys(props.initialData));
        // Copy all initialData to pending queue
        pendingInitialData.value = { ...props.initialData };
        // Set initializing flag to suppress defaults during load
        isInitializing.value = true;
        console.log('[INIT] Initialization mode enabled - defaults will be suppressed');
    }

    // inject user
    form.value["__user__"] = TokenStorage.getPayload().user;
    fieldOptions.value["__user__"] = {
        type: "expression"
    };

    // process aliases
    props.currentForm.fields.forEach((item) => {
        if (item.type == "local") {
            item.hide = item.hide ?? true;
            item.noOutput = item.noOutput ?? true;
            item.type = "expression";
            item.runLocal = true;
        }
        if (item.type == "local_out") {
            item.hide = item.hide ?? true;
            item.type = "expression";
            item.runLocal = true;
        }
        if (item.type == "credential") {
            item.hide = item.hide ?? true;
            item.asCredential = true;
            item.type = "expression";
            item.runLocal = true;
        }
        if (item.type == "html"){
            item.runLocal = true;
        }
    });

    // initiate the constants
    if (props.constants) {
        Object.keys(props.constants).forEach((item) => {
            fieldOptions.value[item] = {
                type: "constant",
            };
            form.value[item] = props.constants[item];
        });
    }

    // initialize defaults
    props.currentForm.fields.forEach((item) => {
        // extra query parameters and store in externalData
        if (route.query[item.name] != undefined) {
            var queryValue = route.query[item.name];
            if (item.type == "number") {
                try {
                    queryValue = parseInt(queryValue);
                } catch (err) {
                    queryValue = 0;
                }
            }
            if (item.type == "checkbox") {
                if (queryValue.toLowerCase() === "false") {
                    queryValue = false;
                } else {
                    queryValue = !!queryValue;
                }
            }
            externalData.value[item.name] = queryValue;
        }
        fieldOptions.value[item.name] = {};
        fieldOptions.value[item.name]["evalDefault"] = item.evalDefault ?? false;
        fieldOptions.value[item.name]["hasDependencies"] = ("dependencies" in item)
        fieldOptions.value[item.name]["dependencyOk"] = false
        if (["expression", "enum", "table", "html"].includes(item.type)) {
            fieldOptions.value[item.name]["isDynamic"] = !!(item.expression ?? item.query ?? item.value ?? false);
            fieldOptions.value[item.name]["valueColumn"] = item.valueColumn || "";
            fieldOptions.value[item.name]["placeholderColumn"] = item.placeholderColumn || "";
            fieldOptions.value[item.name]["type"] = item.type;
            if (item.refresh && typeof item.refresh == 'string' && /[0-9]+s/.test(item.refresh)) {
                fieldOptions.value[item.name]["refresh"] = item.refresh;
            }
            form.value[item.name] = externalData.value[item.name] ?? getDefaultValue(item.name, item.default);
            if (item.type == "table" && !defaults.value[item.name]) {
                form.value[item.name] = [];
            }
            if (item.type == "table" && defaults.value[item.name]) {
                form.value[item.name] = externalData.value[item.name];
            }
        } else {
            var fallbackvalue = undefined;
            if (item.type == "checkbox") {
                fallbackvalue = false;
            }
            form.value[item.name] = externalData.value[item.name] ?? getDefaultValue(item.name, item.default) ?? fallbackvalue;
        }
        visibility.value[item.name] = true;
    });

    // reset the form
    v$.value.form.$reset();

    // set all defaults
    initiateDefaults();

    // find all variable dependencies (in both ways)
    findVariableDependencies();
    findVariableDependentOf();

    // Apply top-level fields from initialData (fields with no dependencies)
    if (Object.keys(pendingInitialData.value).length > 0) {
        console.log('[INIT] Starting to apply initialData');
        props.currentForm.fields.forEach((item) => {
            const fieldname = item.name;
            if (fieldname in pendingInitialData.value) {
                const hasNoDeps = !dynamicFieldDependentOf.value[fieldname] || 
                                 dynamicFieldDependentOf.value[fieldname].length === 0;
                // Skip enum/query/table fields - they need their options to load first
                const needsOptionsFirst = ['enum', 'query', 'table'].includes(item.type) && (item.expression || item.query);
                console.log(`[INIT] Field ${fieldname}: hasNoDeps=${hasNoDeps}, needsOptions=${needsOptionsFirst}, type=${item.type}`);
                if (hasNoDeps && !needsOptionsFirst) {
                    console.log(`[INIT] Applying top-level field: ${fieldname} = ${pendingInitialData.value[fieldname]}`);
                    form.value[fieldname] = pendingInitialData.value[fieldname];
                    delete pendingInitialData.value[fieldname];
                }
            }
        });
        if (Object.keys(pendingInitialData.value).length > 0) {
            console.log('[INIT] Remaining fields will be applied by loop:', Object.keys(pendingInitialData.value));
        }
    }

    // for future use, run something before the form starts
    pretasksFinished.value = true;

    // start dynamic field loop (= infinite)
    startDynamicFieldsLoop().then(() => {
        console.log("Dynamic fields loop started");
    }).catch((err) => {
        console.log("Dynamic fields loop failed to start");
    });
}


//----------------------------------------------------------------
// starts the evaluation of dynamic fields (expression or query)
//----------------------------------------------------------------
async function startDynamicFieldsLoop() {
    var refreshCounter = 0;
    var hasUnevaluatedFields = false;
    changed();
    interval.value = setInterval(async () => {
        hasUnevaluatedFields = false;
        unevaluatedFields.value = [];

        props.currentForm.fields.forEach(async (item) => {
            checkDependencies(item);
            if (visibility.value[item.name]) {
                var flag = dynamicFieldStatus.value[item.name];
                var placeholderCheck = undefined;

                if (item.expression && (flag == undefined || hasDefaultDependencies(item.name))) {
                    hasUnevaluatedFields = true;
                    unevaluatedFields.value.push(item.name);
                    setFieldStatus(item.name, "running", false);
                    placeholderCheck = replacePlaceholders(item);
                    fieldOptions.value[item.name].expressionEval = placeholderCheck.value || "undefined";

                    if (placeholderCheck.value != undefined) {
                        if (item.runLocal) {
                            try {
                                var result;
                                if (placeholderCheck.value.at(0) == "{" && placeholderCheck.value.at(-1) == "}") {
                                    result = Helpers.evalSandbox(`Object.assign(${placeholderCheck.value})`);
                                } else {
                                    result = Helpers.evalSandbox(placeholderCheck.value);
                                }
                                if (item.type == "html") {
                                    // Check for pending initialData
                                    if (item.name in pendingInitialData.value) {
                                        console.log(`[LOOP] Applying html initialData (local): ${item.name}`);
                                        form.value[item.name] = pendingInitialData.value[item.name];
                                        delete pendingInitialData.value[item.name];
                                    } else {
                                        form.value[item.name] = result;
                                    }
                                }
                                if (item.type == "expression") {
                                    // Check for pending initialData
                                    if (item.name in pendingInitialData.value) {
                                        console.log(`[LOOP] Applying expression initialData (local): ${item.name}`);
                                        form.value[item.name] = pendingInitialData.value[item.name];
                                        delete pendingInitialData.value[item.name];
                                    } else {
                                        form.value[item.name] = result;
                                    }
                                }
                                if (item.type == "enum") {
                                    queryresults.value[item.name] = [].concat(result);
                                    // Check if we have pending initialData for this enum field
                                    if (item.name in pendingInitialData.value) {
                                        console.log(`[LOOP] Applying enum initialData after options loaded (local): ${item.name}`);
                                        form.value[item.name] = pendingInitialData.value[item.name];
                                        delete pendingInitialData.value[item.name];
                                    }
                                }
                                if (item.type == "table" && !defaults.value[item.name]) form.value[item.name] = [].concat(result);
                                if (item.type == "table" && defaults.value[item.name]) form.value[item.name] = [].concat(defaults.value[item.name]);

                                if (placeholderCheck.hasPlaceholders) {
                                    setFieldStatus(item.name, "variable");
                                } else {
                                    setFieldStatus(item.name, "fixed");
                                }
                                delete queryerrors.value[item.name];
                            } catch (err) {
                                queryerrors.value[item.name] = err.toString();
                                try {
                                    setFieldToDefault(item.name);
                                } catch (err) {
                                    stopLoop("Defaulting " + item.name);
                                }
                            }
                        } else {
                            try {
                                const result = await axios.post(`/api/v1/expression?noLog=${!!item.noLog}`, { expression: placeholderCheck.value }, TokenStorage.getAuthentication());
                                var restresult = result.data;
                                if (restresult.status == "error") {
                                    resetField(item.name);
                                }
                                if (restresult.data.error) {
                                    queryerrors.value[item.name] = restresult.data.error;
                                } else {
                                    delete queryerrors.value[item.name];
                                }
                                if (restresult.status == "success") {
                                    if (item.type == "html") {
                                        // Check for pending initialData
                                        if (item.name in pendingInitialData.value) {
                                            console.log(`[LOOP] Applying html initialData: ${item.name}`);
                                            form.value[item.name] = pendingInitialData.value[item.name];
                                            delete pendingInitialData.value[item.name];
                                        } else {
                                            form.value[item.name] = restresult.data.output;
                                        }
                                    }
                                    if (item.type == "expression") {
                                        // Check for pending initialData
                                        if (item.name in pendingInitialData.value) {
                                            console.log(`[LOOP] Applying expression initialData: ${item.name}`);
                                            form.value[item.name] = pendingInitialData.value[item.name];
                                            delete pendingInitialData.value[item.name];
                                        } else {
                                            form.value[item.name] = restresult.data.output;
                                        }
                                    }
                                    if (item.type == "enum") {
                                        queryresults.value[item.name] = [].concat(restresult.data.output ?? []);
                                        // Check if we have pending initialData for this enum field
                                        if (item.name in pendingInitialData.value) {
                                            console.log(`[LOOP] Applying enum initialData after options loaded: ${item.name}`);
                                            form.value[item.name] = pendingInitialData.value[item.name];
                                            delete pendingInitialData.value[item.name];
                                        }
                                    }
                                    if (item.type == "table" && !defaults.value[item.name]) form.value[item.name] = [].concat(restresult.data.output ?? []);
                                    if (item.type == "table" && defaults.value[item.name]) form.value[item.name] = [].concat(defaults.value[item.name] ?? []);

                                    if (restresult.data.output == undefined && (defaults.value[item.name] != undefined)) {
                                        if (item.type == "expression") {
                                            setFieldToDefault(item.name);
                                        } else {
                                            resetField(item.name);
                                        }
                                    } else {
                                        if (placeholderCheck.hasPlaceholders) {
                                            setFieldStatus(item.name, "variable");
                                        } else {
                                            setFieldStatus(item.name, "fixed");
                                        }
                                    }
                                }
                            } catch (error) {
                                try {
                                    setFieldToDefault(item.name);
                                } catch (err) {
                                    stopLoop("Defaulting " + item.name);
                                }
                            }
                        }
                    } else {
                        setFieldToDefault(item.name);
                    }
                } else if (item.query && flag == undefined) {
                    hasUnevaluatedFields = true;
                    unevaluatedFields.value.push(item.name);
                    setFieldStatus(item.name, "running", false);
                    placeholderCheck = replacePlaceholders(item);

                    if (placeholderCheck.value != undefined) {
                        try {
                            const result = await axios.post(`/api/v1/query?noLog=${!!item.noLog}`, { query: placeholderCheck.value, config: item.dbConfig }, TokenStorage.getAuthentication());
                            var restresult = result.data;
                            if (restresult.data.error) {
                                queryerrors.value[item.name] = restresult.data.error;
                            } else {
                                delete queryerrors.value[item.name];
                            }
                            if (restresult.status == "error") {
                                if (item.type == "expression") {
                                    setFieldToDefault(item.name);
                                } else {
                                    resetField(item.name);
                                }
                            }
                            if (restresult.status == "success") {
                                if (item.type == "query" || item.type == "enum") queryresults.value[item.name] = restresult.data.output;
                                else form.value[item.name] = restresult.data.output;

                                if (placeholderCheck.hasPlaceholders) {
                                    setFieldStatus(item.name, "variable");
                                } else {
                                    setFieldStatus(item.name, "fixed");
                                }
                            }
                        } catch (err) {
                            try {
                                if (item.type == "expression") {
                                    setFieldToDefault(item.name);
                                } else {
                                    resetField(item.name);
                                }
                            } catch (err) {
                                stopLoop("Defaulting " + item.name);
                            }
                        }
                    } else {
                        try {
                            if (item.type == "expression") {
                                setFieldToDefault(item.name);
                            } else {
                                resetField(item.name);
                            }
                        } catch (err) {
                            stopLoop("Defaulting " + item.name);
                        }
                    }
                } else if (item.value && flag == undefined) {
                    setFieldStatus(item.name, "running", false);
                    if (item.type == "expression") form.value[item.name] = item.value;
                    setFieldStatus(item.name, "fixed");
                }
            } else {
                // Check if this field has pending initialData before defaulting
                if (item.name in pendingInitialData.value) {
                    // Check if all dependencies are satisfied (not undefined)
                    const deps = dynamicFieldDependentOf.value[item.name] || [];
                    const allDepsSatisfied = deps.every(dep => form.value[dep] !== undefined);
                    
                    if (allDepsSatisfied) {
                        console.log(`[LOOP] Applying dependent field: ${item.name} (deps: ${deps.join(', ') || 'none'})`);
                        form.value[item.name] = pendingInitialData.value[item.name];
                        delete pendingInitialData.value[item.name];
                    } else {
                        // Dependencies not ready yet, will try again in next loop iteration
                        // console.log(`[LOOP] Waiting for deps of ${item.name}: ${deps.filter(d => form.value[d] === undefined).join(', ')}`);
                    }
                } else {
                    if (item.type == "expression") {
                        setFieldToDefault(item.name);
                    } else if (item.type == "query" || item.type == "enum" || item.type == "table") {
                        resetField(item.name);
                    }
                }
            }
            if (item.type == "number" && form.value[item.name] === "") {
                setFieldUndefined(item.name);
            }
            if (item.refresh && typeof item.refresh == "string") {
                var match = item.refresh.match(/([0-9]+)s/g);
                if (match) {
                    var secs = parseInt(match[0]);
                    if (refreshCounter % (10 * secs) == 0) {
                        setFieldStatus(item.name, undefined);
                    }
                }
            }
        });

        if (hasUnevaluatedFields) {
            canSubmit.value = false;
            watchdog.value++;
        }

        if (!hasUnevaluatedFields) {
            // Check if initialization is complete (all pendingInitialData applied)
            if (isInitializing.value && Object.keys(pendingInitialData.value).length == 0) {
                isInitializing.value = false;
                console.log('[INIT] All initialData applied - initialization complete, defaults now active');
            }
            canSubmit.value = true;
            if (watchdog.value > 0) {
                // All fields are found
            }
            watchdog.value = 0;
        }

        if (status.value == "initializing") {
            status.value = "";
            nextTick(() => {
                if (validateForm()) {
                    status.value = "stabilizing";
                    watchdog.value = 0;
                } else {
                    status.value = "";
                }
            });
        }

        if (status.value == "stabilizing") {
            if (canSubmit.value) {
                status.value = "submitting";
                emit("submit", { visibility: visibility.value })
            } else {
                if (watchdog.value > 50) {
                    status.value = "";
                    toast.warning("It took too long to evaluate all fields before run.\r\nLet the form stabilize and try again.");
                    toast.warning(unevaluatedFieldsWarning.value);
                }
            }
        }

        refreshCounter++;
        if (refreshCounter % loopDivider.value == 0) {
            if (!pauseJsonOutput.value && props.showExtraVars) {
                changed();
            }
        }
        if (watchdog.value > 50 || watchdog.value == 0) {
            loopDelay.value = 500;
        } else {
            loopDelay.value = 4;
        }
    }, loopDelay.value);
}

// HOOKS
//----------------------------------------------------------------

onMounted(async () => {
    // const rules = getRules()
    v$ = useVuelidate(rules, { form }); // use vuelidate, form is a ref that holds the form data
    validationsLoaded.value = true;
    pretasksFinished.value = true;
    initForm();
    calcContainerSize();
    window.addEventListener('resize', calcContainerSize);
})

onUnmounted(() => {
    window.removeEventListener('resize', calcContainerSize);
    clearInterval(interval.value);
})
</script>
<template>

    <!-- FORM -->

    <div v-if="formIsReady" ref="containerRef">

        <!-- WARNINGS -->
        <BsOffCanvas v-if="(warnings || Object.keys(queryerrors).length > 0) && showWarnings" :show="true"
            icon="triangle-exclamation" title="Form warnings" @close="showWarnings = false">
            <template #actions> </template>
            <template #default>
                <p v-for="w, i in warnings" :key="'warning' + i" class="mb-3" v-html="w"></p>
                <p v-for="q, i in Object.keys(queryerrors)" :key="'queryerror' + i" class="mb-3 has-text-danger">
                    '{{ q }}' has query errors<br>{{ queryerrors[q] }}
                </p>
            </template>
        </BsOffCanvas>

        <div class="d-flex justify-content-between">
            <div>
                <slot name="toolbarbuttons"></slot>
            </div>
            <div>

                <!-- warnings -->
                <span role="button" v-show="!canSubmit && !formLoopIsBusy" :data-tooltip="unevaluatedFieldsWarning">
                    <popper :content="unevaluatedFieldsWarning">
                        <font-awesome-icon icon="exclamation-triangle" size="lg" class="text-warning" />
                    </popper>
                </span>

                <!-- loop busy -->
                <span class="ms-2" v-show="formLoopIsBusy">
                    <font-awesome-icon icon="spinner" size="lg" class="text-warning" spin />
                </span>

                <!-- show hidden fields -->
                <span class="ms-2" v-show="!hideForm" v-if="showDebugButtons" title="Show hidden fields" role="button"
                    :class="{ 'text-success': !showHidden, 'text-danger': showHidden }"
                    @click="showHidden = !showHidden">
                    <font-awesome-icon :icon="(showHidden ? 'search-minus' : 'search-plus')" />
                </span>

            </div>
        </div>


        <!-- GROUPS -->
        <template :key="group" v-for="group in fieldGroups" v-show="!hideForm">
            <div v-if="checkGroupDependencies(group)" class="mt-4 p-3" :class="getGroupClass(group)">

                <!-- GROUP TITLE -->
                <h3>{{ group }}</h3>

                <!-- ROWS -->
                <div :key="line" v-for="line in fieldLines" class="row">
                    <!-- FIELDS -->
                    <template v-for="field in filterfieldsByGroupAndLine(group, line)">

                        <div class="col py-0" v-if="visibility[field.name]" :class="field.width">
                            
                            <!-- TYPE = HTML (separate rendering, optional label) -->
                            <div class="mt-3" v-if="field.type == 'html'">
                                <!-- FIELD LABEL (only if label is explicitly set and different from field name) -->
                                <label v-if="field.label && field.label !== field.name" class="flex-grow-1 fw-bold mb-2"
                                    :class="{ 'text-body': !field.hide, 'text-grey': field.hide }">{{ typeof fieldLabels[field.name] === 'object' ? fieldLabels[field.name].value : fieldLabels[field.name] }}
                                </label>
                                
                                <div v-show="!fieldOptions[field.name].viewable" v-html="v$.form[field.name].$model || ''"></div>
                                <!-- raw data -->
                                <div @dblclick="setExpressionFieldViewable(field.name, false)"
                                    v-if="fieldOptions[field.name].viewable"
                                    class="card p-2 limit-height">
                                    <VueJsonPretty :data="v$.form[field.name].$model || ''" />
                                </div>                                       
                            </div>

                            <!-- ALL OTHER FIELD TYPES -->
                            <div v-else class="mt-3">
                                <div class="d-flex">

                                    <!-- FIELD LABEL -->
                                    <label class="flex-grow-1 fw-bold mb-2"
                                        :class="{ 'text-body': !field.hide, 'text-grey': field.hide }">{{ typeof fieldLabels[field.name] === 'object' ? fieldLabels[field.name].value : fieldLabels[field.name] }} <span v-if="field.required" class="text-danger">*</span></label>

                                    <!-- FIELD DEBUG BUTTONS -->
                                    <div>
                                        <!-- refresh auto -->
                                        <BsButton @click="setFieldStatus(field.name, undefined)"
                                            v-if="fieldOptions[field.name] && fieldOptions[field.name].refresh"
                                            icon="arrow-rotate-right" :spin="true" cssClass="btn-sm">{{
                                            fieldOptions[field.name].refresh }}</BsButton>
                                        <!-- refresh manual -->
                                        <span
                                            v-if="(field.expression != undefined || field.query != undefined) && field.refresh & !fieldOptions[field.name].refresh"
                                            role="button" class="me-2" @click="setFieldStatus(field.name, undefined)">
                                            <font-awesome-icon icon="arrow-rotate-right" />
                                        </span>
                                        <!-- enable field debug -->
                                        <span class="ms-2" role="button"
                                            :class="{ 'text-success': !fieldOptions[field.name].debug, 'text-danger': fieldOptions[field.name].debug }"
                                            @click="setExpressionFieldDebug(field.name, !fieldOptions[field.name].debug)"
                                            v-if="field.expression && showDebugButtons">
                                            <font-awesome-icon
                                                :icon="(fieldOptions[field.name].debug ? 'search-minus' : 'search-plus')" />
                                        </span>
                                        <!-- expression edit buttons -->
                                        <span class="ms-2 text-warning" role="button"
                                            @click="setExpressionFieldEditable(field.name, true)"
                                            v-if="field.editable && field.type == 'expression' && !fieldOptions[field.name].editable && !fieldOptions[field.name].viewable">
                                            <font-awesome-icon icon="pencil-alt" />
                                        </span>
                                        <span class="ms-2 text-danger" role="button"
                                            @click="setExpressionFieldEditable(field.name, false)"
                                            v-if="field.editable && field.type == 'expression' && fieldOptions[field.name].editable && !fieldOptions[field.name].viewable">
                                            <font-awesome-icon icon="times" />
                                        </span>
                                        <!-- raw content buttons -->
                                        <!-- show -->
                                        <span class="ms-2 text-success" role="button"
                                            @click="setExpressionFieldViewable(field.name, true)"
                                            v-if="showDebugButtons && field.expression && !fieldOptions[field.name].viewable && !fieldOptions[field.name].editable">
                                            <font-awesome-icon icon="eye" />
                                        </span>
                                        <!-- copy -->
                                        <span class="ms-2 text-info" role="button"
                                            @click="clip((field.type == 'expression') ? v$.form[field.name].$model : queryresults[field.name])"
                                            v-if="field.expression && fieldOptions[field.name].viewable && !fieldOptions[field.name].editable">
                                            <font-awesome-icon icon="copy" />
                                        </span>
                                        <!-- close -->
                                        <span class="ms-2 text-danger" role="button"
                                            @click="setExpressionFieldViewable(field.name, false)"
                                            v-if="field.expression && fieldOptions[field.name].viewable && !fieldOptions[field.name].editable">
                                            <font-awesome-icon icon="times" />
                                        </span>
                                    </div>
                                </div>
                                <!-- DEBUG EXPRESSION -->
                                <div class="mb-3" @dblclick="clip(field.expression, true)"
                                    v-if="field.expression && fieldOptions[field.name].debug">
                                    <pre v-highlightjs><code language="javascript">{{ field.expression }}</code></pre>
                                </div>
                                <!-- DEBUG EVALUATION -->
                                <div class="mb-3" @dblclick="clip(fieldOptions[field.name].expressionEval, true)"
                                    v-if="field.expression && fieldOptions[field.name].debug && dynamicFieldStatus[field.name] != 'fixed'">
                                    <pre v-highlightjs><code language="javascript">{{ fieldOptions[field.name].expressionEval }}</code></pre>
                                </div>

                                <div v-if="field.type == 'table' && field.tableFields">
                                    <AppTableField v-show="!fieldOptions[field.name].viewable"
                                        v-model="v$.form[field.name].$model" 
                                        :tableFields="field.tableFields"
                                        :allowInsert="field.allowInsert && true"
                                        :allowDelete="field.allowDelete && true"
                                        :deleteMarker="field.deleteMarker || ''"
                                        :insertMarker="field.insertMarker || ''"
                                        :updateMarker="field.updateMarker || ''"
                                        :readonlyColumns="field.readonlyColumns || []"
                                        :insertColumns="field.insertColumns || []"
                                        :dynamicFieldStatus="dynamicFieldStatus" :form="form"
                                        :hasError="v$.form[field.name].$invalid" :click="false"
                                        tableClass="table" headClass="bg-primay-subtle"
                                        :isLoading="!['fixed', 'variable'].includes(dynamicFieldStatus[field.name]) && (field.expression != undefined || field.query != undefined)"
                                        :values="form[field.name] || []" @update:modelValue="evaluateDynamicFields(field.name)"
                                        @warning="addTableWarnings(field.name, ...arguments)" 
                                        :errors="v$.form[field.name].$errors"
                                        :help="typeof fieldHelp[field.name] === 'object' ? fieldHelp[field.name].value : fieldHelp[field.name]"
                                    />
                                    <!-- expression raw data -->
                                    <div @dblclick="setExpressionFieldViewable(field.name, false)" v-if="fieldOptions[field.name].viewable"
                                        class="card p-2 limit-height">
                                        <VueJsonPretty :data="v$.form[field.name].$model" />
                                    </div>                                    
                                </div>

                                <!-- TYPE = ENUM -->
                                <div v-if="field.type == 'enum'">
                                    <BsInputForForm type="select" :containerSize="containerSize"
                                        v-show="!fieldOptions[field.name].viewable" :defaultValue="defaults[field.name]"
                                        :required="field.required || false" :multiple="field.multiple || false"
                                        :name="field.name" :placeholder="(typeof fieldPlaceholders[field.name] === 'object' ? fieldPlaceholders[field.name].value : fieldPlaceholders[field.name]) || 'Select...'"
                                        :values="field.values || queryresults[field.name] || []"
                                        :hasError="v$.form[field.name].$invalid"
                                        :isLoading="!field.values && !['fixed', 'variable'].includes(dynamicFieldStatus[field.name])"
                                        v-model="v$.form[field.name].$model" :icon="field.icon"
                                        :columns="field.columns || []" :pctColumns="field.pctColumns || []"
                                        :filterColumns="field.filterColumns || []"
                                        :previewColumn="field.previewColumn || ''"
                                        :valueColumn="field.valueColumn || ''"
                                        @update:modelValue="evaluateDynamicFields(field.name)" 
                                        :sticky="field.sticky || false"
                                        :horizontal="field.horizontal || false"
                                        :errors="v$.form[field.name].$errors"
                                        :help="typeof fieldHelp[field.name] === 'object' ? fieldHelp[field.name].value : fieldHelp[field.name]" 
                                    />
                                    <!-- raw query data -->
                                    <div @dblclick="setExpressionFieldViewable(field.name, false)"
                                        v-if="fieldOptions[field.name].viewable"
                                        class="card p-2 limit-height">
                                        <VueJsonPretty :data="queryresults[field.name] || []" />
                                    </div>
                                </div>

                                <!-- TYPE = DATEPICKER -->
                                <div v-if="field.type == 'datetime'">
                                    <BsInputForForm type="datetime" 
                                        :icon="field.icon"
                                        v-model="v$.form[field.name].$model" 
                                        :name="field.name"
                                        :hasError="v$.form[field.name].$invalid" 
                                        :dateType="field.dateType"
                                        @update:modelValue="evaluateDynamicFields(field.name)" 
                                        :placeholder="typeof fieldPlaceholders[field.name] === 'object' ? fieldPlaceholders[field.name].value : fieldPlaceholders[field.name]"
                                        :errors="v$.form[field.name].$errors" 
                                        :values="field.values"
                                        :help="typeof fieldHelp[field.name] === 'object' ? fieldHelp[field.name].value : fieldHelp[field.name]"
                                    />
                                </div>

                                <!-- TYPE = EXPRESSION -->
                                <div v-if="field.type == 'expression'"
                                    :class="{ 'is-loading': (dynamicFieldStatus[field.name] == undefined || dynamicFieldStatus[field.name] == 'running') & !fieldOptions[field.name].editable }">
                                    <div v-if="!fieldOptions[field.name].viewable">
                                        <BsInputForForm v-if="fieldOptions[field.name].editable" :icon="field.icon"
                                            type="text" @focus="preventFocus" :hasError="v$.form[field.name].$invalid"
                                            v-model="v$.form[field.name].$model" :name="field.name"
                                            :required="field.required" @change="evaluateDynamicFields(field.name)"
                                            :errors="v$.form[field.name].$errors"
                                            :help="typeof fieldHelp[field.name] === 'object' ? fieldHelp[field.name].value : fieldHelp[field.name]"
                                            />
                                        <BsInputForForm v-else @dblclick="setExpressionFieldViewable(field.name, true)"
                                            type="expression" :icon="field.icon"
                                            :hasError="v$.form[field.name].$invalid" cssClass="text-info"
                                            v-model="v$.form[field.name].$model" :name="field.name"
                                            :isHtml="field.isHtml" :errors="v$.form[field.name].$errors"
                                            :help="typeof fieldHelp[field.name] === 'object' ? fieldHelp[field.name].value : fieldHelp[field.name]"
                                             />
                                    </div>
                                    <!-- expression raw data -->
                                    <div @dblclick="setExpressionFieldViewable(field.name, false)" v-else
                                        class="card p-2 limit-height">
                                        <!-- <pre v-highlightjs><code lang="json">{{ v$.form[field.name].$model }}</code></pre> -->
                                        <VueJsonPretty :data="v$.form[field.name].$model" />
                                    </div>
                                </div>

                                <!-- TYPE = TEXT, PASSWORD, TEXTAREA, NUMBER, CHECKBOX -->
                                <BsInputForForm
                                    v-if="['text', 'password', 'textarea', 'number', 'checkbox', 'radio'].includes(field.type)"
                                    @focus="preventFocus"
                                    @keydown="(field.keydown) ? evaluateDynamicFields(field.name) : null"
                                    @change="evaluateDynamicFields(field.name)" :hasError="v$.form[field.name].$invalid"
                                    v-model="v$.form[field.name].$model" :name="field.name" v-bind="field.attrs"
                                    :required="field.required" :type="field.type" :icon="field.icon"
                                    :readonly="field.hide" :placeholder="typeof fieldPlaceholders[field.name] === 'object' ? fieldPlaceholders[field.name].value : fieldPlaceholders[field.name]" :isSwitch="field.switch"
                                    :errors="v$.form[field.name].$errors" :values="field.values"
                                    :help="typeof fieldHelp[field.name] === 'object' ? fieldHelp[field.name].value : fieldHelp[field.name]" />

                                <!-- TYPE = FILE -->
                                <BsInputForForm v-if="field.type == 'file'" :accept="(field.accept || []).join(',')"
                                    :type="field.type" @change="handleFiles" :hasError="v$.form[field.name].$invalid"
                                    :name="field.name" :required="field.required" :icon="field.icon"
                                    :errors="v$.form[field.name].$errors" :progress="fileProgress[field.name]" 
                                    :help="typeof fieldHelp[field.name] === 'object' ? fieldHelp[field.name].value : fieldHelp[field.name]" 
                                />
                            </div>
                        </div>

                    </template>
                </div>
            </div>
        </template>
        <div class="d-grid my-3" v-if="status == ''">
            <button type="button" class="btn text-white btn-primary" @click="status = 'initializing'">
                <FaIcon :icon="submitIcon"></FaIcon><span class="ms-3">{{ submitLabel }}</span>
            </button>
        </div>
    </div>

    <!-- LOADER & FORM NOT FOUND -->

    <div v-else>
        <h2>Loading...</h2>
        <div class="alert alert-info">The form is not ready...</div>
    </div>
</template>
<style scoped lang="scss">
.limit-height {
    max-height: 300px;
    overflow-y: scroll;
    overflow-x: clip;
}
pre {
    margin: 0
}
</style>
