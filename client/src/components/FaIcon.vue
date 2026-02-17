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
    /*      overlayIcon: String (optional)                            */
    /*      overlayIconTransform: String (optional)                   */
    /*      overlayIconColor: String (optional)                       */
    /*      overlayIconText: String (optional)                        */
    /*      overlayIconTextPosition: String (optional)                */
    /*      overlayIconTextColor: String (optional)                   */
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
        },
        overlayIcon: {
            type: String,
            default: null
        },
        overlayIconTransform: {
            type: String,
            default: 'shrink-6 up-7 right-7'
        },
        overlayIconColor: {
            type: String,
            default: 'success'
        },
        overlayIconText: {
            type: String,
            default: null
        },
        overlayIconTextPosition: {
            type: String,
            default: 'bottom-left'
        },
        overlayIconTextColor: {
            type: String,
            default: 'success'
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

    const overlayI = computed(() => {
        if (props.overlayIcon?.includes(',')) {
            return props.overlayIcon.split(',');
        }else{
            return props.overlayIcon;
        }
    });

</script>
<template>
    <!-- Layered icons when overlayIcon or overlayIconText is provided -->
    <font-awesome-layers v-if="overlayIcon || overlayIconText" :class="[size ? `fa-${size}` : '']">
        <font-awesome-icon :class="`text-${color}`" :role="role" :icon="i" :fixed-width="fixedwidth" :spin="icon=='spinner'" />
        <font-awesome-icon v-if="overlayIcon" :icon="overlayI" inverse :transform="overlayIconTransform" :class="`text-${overlayIconColor}`" />
        <font-awesome-layers-text v-if="overlayIconText" counter :position="overlayIconTextPosition" :class="`bg-${overlayIconTextColor}`" :value="overlayIconText" />
    </font-awesome-layers>
    
    <!-- Single icon when no overlay -->
    <font-awesome-icon v-else :class="`text-${color}`" :role="role" :icon="i" :size="size" :fixed-width="fixedwidth" :spin="icon=='spinner'" />
</template>