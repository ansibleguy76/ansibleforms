<script setup>


    /*********************************************************************/
    /*                                                                   */
    /*  Bootstrap SSH Key component                                      */
    /*                                                                   */
    /*  @props:                                                          */
    /*      type: String (sshPrivateKey, sshPublicKey, sshPrivateKeyArt) */
    /*      icon: String                                                 */
    /*      required: Boolean                                            */
    /*                                                                   */
    /*********************************************************************/

    import copy from 'copy-to-clipboard';
    import { toast } from 'vue-sonner';

    // INIT

    

    // MODEL

    const model = defineModel();

    // PROPS

    const props = defineProps({
        type: {
            type: String,
            required: true
        },
        icon: {
            type: String,
            default: undefined
        },
        required: {
            type: Boolean,
            default: false
        }
    })

    // METHODS

    function copyToClipboard() {
        copy(model.value);
        toast.success('Copied to clipboard');
    }

</script>
<template>
    <pre class="p-3 border" v-if="type === 'sshPrivateKeyArt'">{{ model }}</pre>
    <BsInputRaw type="text" v-if="type === 'sshPrivateKey'" v-model="model" :icon="icon" :required="required" />
    <p class="p-3 border text-break user-select-none" v-else-if="type === 'sshPublicKey'" @click="copyToClipboard()">{{ model }}</p>
</template>