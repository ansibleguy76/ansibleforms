<script setup>

    /******************************************************************/
    /*                                                                */
    /*  Ace Editor component                                          */
    /*                                                                */
    /*  @props:                                                       */
    /*      modelValue: String                                        */
    /*      lang: String                                              */
    /*      theme: String                                             */
    /*      style: String                                             */
    /*                                                                */
    /******************************************************************/

    import { ref, nextTick } from 'vue';
    import { VAceEditor } from 'vue3-ace-editor';
    import ace from 'ace-builds';
    import 'ace-builds/src-noconflict/mode-yaml'; // Load the language definition file used below
    import 'ace-builds/src-noconflict/theme-monokai'; // Load the theme definition file used below
    import extSearchboxUrl from 'ace-builds/src-noconflict/ext-searchbox?url';
    import workerYamlUrl from 'ace-builds/src-noconflict/worker-yaml?url';

    // INIT

    ace.config.setModuleUrl('ace/mode/yaml_worker', workerYamlUrl);
    ace.config.setModuleUrl('ace/ext/searchbox', extSearchboxUrl);    
    const emit = defineEmits(['update:modelValue','dirty','save']);

    // MODEL

    const code = ref('');
    const keyListener = ref(null);

    // PROPS

    const props = defineProps(
        {
            modelValue: {
                type: String,
            },
            lang: {
                type: String,
                default: 'yaml',
            },
            theme: {
                type: String,
                default: 'monokai',
            },
            style: {
                type: [String, Object],
                default: 'width: 100%;height: 75vh;font-size:1rem',
            },
        }
    );

    // DATA

    const mounted = ref(false);

    // METHODS

    const change = (value) => {
        if (mounted.value){
            emit('dirty')
        }
    }
    const blur = () => {
        emit('update:modelValue', code.value);
    }
    const save = () => {
        emit('save')
    }

    watch(
    () => props.modelValue,
    (newVal) => {
        code.value = newVal;
    }
    );    
    // HOOKS

    onMounted(async () => {
        code.value = props.modelValue || '';
        // set mounted at next tick
        await nextTick()
        mounted.value = true;

        keyListener.value = async function(e) {
            if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault(); // present "Save Page" from getting triggered.
                blur();
                // allow time for the model to update
                await nextTick()
                // emit save event
                save();
            }
        };

        document.addEventListener('keydown', keyListener.value);
    }),
    onBeforeUnmount(()=> {
        document.removeEventListener('keydown', keyListener.value);
    })

</script>
<template>
    <div>
        <v-ace-editor @change="change" @blur="blur" v-model:value="code" :lang="lang" :theme="theme" :style="style" :printMargin="false" :options="{ useWorker: true}" />
    </div>
</template>