<script setup>

    /******************************************************************/
    /*                                                                */
    /*  Font Awesome Icon component                                   */
    /*                                                                */
    /*  @props:                                                       */
    /*      icon: String                                              */
    /*      size: String                                              */
    /*      fixedwidth: Boolean                                       */
    /*      role: String                                              */
    /*      color: String                                             */
    /*                                                                */
    /******************************************************************/

    import { computed } from 'vue';

    // PROPS

    const props = defineProps({
        icon: {
            type: String,
            required: true
        },
        size: {
            type: String,
            default: null
        },
        fixedwidth: {
            type: Boolean,
            default: false
        },
        role: {
            type: String,
            default: null
        },
        color: {
            type: String,
            default: null
        }
    });

    // COMPUTED

    const i = computed(() => {
        if (props.icon?.includes(',')) {
            return props.icon.split(',');
        }else{
            return props.icon;
        }
    });

</script>
<template>
    <font-awesome-icon :class="`text-${color}`" :role="role" :icon="i" :size="size" :fixed-width="fixedwidth" :spin="icon=='spinner'" />
</template>