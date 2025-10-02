<script setup>

    /******************************************/
    /*                                        */
    /*  Bootstrap modal component             */
    /*                                        */
    /*  @slots:                               */
    /*      title: String                     */
    /*      default: String                   */
    /*      footer: String                    */
    /*                                        */
    /*  @emit:                                */
    /*      close: Event                      */
    /*                                        */
    /******************************************/

    import {getCurrentInstance} from "vue"

    // INIT

    const {uid} = getCurrentInstance()
    const emit = defineEmits(['close'])

    // METHODS

    function backdropClick(e) {
        if (e.target.id == uid) {
            emit('close');
        }
    }

</script>

<template>

    <div @click="backdropClick" :id="uid"  class="modal fade show d-block" tabindex="-1" role="dialog" aria-modal="true"
        data-bs-keyboard="true" aria-hidden="true" data-bs-backdrop="static">
        <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title"><slot name="title"></slot>
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" @click="emit('close')"></button>
                </div>
                <div class="modal-body">
                    <slot></slot>
                </div>
                <div class="modal-footer">
                    <slot name="footer"></slot>
                    <BsButton @click="emit('close')">Close</BsButton>
                </div>
            </div>
        </div>
    </div>
    <div class="modal-backdrop fade show"></div>    
</template>