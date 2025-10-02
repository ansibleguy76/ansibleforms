<script setup>

    /******************************************************************/
    /*                                                                */
    /*  App AnsibleForms Settings component                           */
    /*  Template wrapper for a page section                           */
    /*                                                                */
    /*  @props:                                                       */
    /*      icon: String                                              */
    /*      title: String                                             */
    /*                                                                */
    /******************************************************************/

    const props = defineProps({
        icon: {
            type: String,
            required: true
        },
        title: {
            type: String,
            required: true
        },
    });
</script>
<template>
    <section class="section w-100 mt-3">
        <div class="container-fluid">
            <div class="d-flex align-items-center border-bottom mb-3 pb-2">
                <h3>
                    <span class="me-2">
                        <FaIcon :icon="icon" />
                    </span>
                    {{ title }}
                </h3>
                <slot name="feedback"></slot>
                <div class="flex-fill"></div>
                <slot name="actions"></slot>
            </div>
            <slot></slot>
            <slot name="footer"></slot>
        </div>
    </section>

</template>