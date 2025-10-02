<script setup>

    /******************************************/
    /*                                        */
    /*  Log viewer component                  */
    /*                                        */
    /*  @props:                               */
    /*      log: String                       */
    /*      loading: Boolean                  */
    /*                                        */
    /******************************************/

    import logviewer from '@femessage/log-viewer';

    const props = defineProps({
        log: {
            type: String,
            default: '...'
        },
        isLoading: {
            type: Boolean,
            default: true
        }
    })
</script>
<template>
    <logviewer :log="log" :loading="isLoading" />
</template>