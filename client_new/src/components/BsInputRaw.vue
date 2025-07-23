<script setup>

    /******************************************/
    /*                                        */
    /*  Classic raw input field               */
    /*                                        */
    /*  @props:                               */
    /*      type: String                      */
    /*      placeholder: String               */
    /*      readonly: Boolean                 */
    /*      style: String                     */
    /*      uid: String                       */
    /*      hasError: Boolean                 */
    /*      autofocus: Boolean                */
    /*                                        */
    /*  @emit:                                */
    /*      keyup_enter: Event                */
    /*      focus: Event                      */
    /*      change: Event                     */
    /*      keydown: Event                    */
    /*                                        */
    /******************************************/

    import { computed } from "vue";

    // MODEL

    const model = defineModel();

    // INIT

    const emit = defineEmits(['keyup_enter','focus','change','keydown']);

    // PROPS

    const props = defineProps({

        type: {
            type: String,
            default: "text",
        },
        placeholder: {
            type: String,
            default: "",
        },
        readonly: {
            type: Boolean,
            default: false,
        },
        style: {
            type: [String, Object],
            default: "",
        },
        uid: {
            type: [String, Number],
            default: "",
        },
        hasError: {
            type: Boolean,
            default: false,
        },
        autofocus: {
            type: Boolean,
            default: false,
        },
    });

    // METHODS

    function change(event){
        emit('change',event);
    }
    function keydown(event){
        emit('keydown',event);
    }
    function focus(event){
        emit('focus',event);
    }
    function keyup_enter(event){
        emit('keyup_enter',event);
    }

    // COMPUTED

    const classes = computed(() => {
        let classList = ['form-control'];
        if(props.cssClass){
            classList.push(props.cssClass);
        }
        if(props.hasError){
            classList.push('is-invalid');
        }
        return classList.join(' ');
    });

</script>
<template>
    <input :readonly="readonly" :autofocus="autofocus" :class="classes" :id="uid" :type="type" :style="style" :placeholder="placeholder" v-model="model" @keyup.enter="keyup_enter" @focus="focus" @change="change" @keydown="keydown" />
</template>