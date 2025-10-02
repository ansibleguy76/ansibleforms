<script setup>

    /******************************************************************/
    /*                                                                */
    /*  Ansible Output component                                      */
    /*  Pretty print Ansible output                                   */
    /*  Classes are old bulma classes                                 */
    /*  But restyled to match the new bootstrap 5 design              */
    /*                                                                */
    /*  @props:                                                       */
    /*      output: String                                            */
    /*                                                                */
    /******************************************************************/

    const props = defineProps({
        output: {
            type: String,
            required: true
        }
    });

</script>
<template>
    <slot name="title"></slot>
    <div class="ansible" v-html="output"></div>   
</template>
<style lang="scss">

    .has-text-weight-bold {
        font-weight: bold;
    }

    .ansible{
        font-family: monospace;
        white-space: pre-wrap;
        word-wrap: break-word;
        font-size:.8rem;
        padding: 1rem;
        margin-bottom: 1rem;
        border: 1px solid var(--bs-light-border-subtle);
        border-radius: 5px;
        background-color: var(--af-bg-light-subtle-color);

        span{
            &.tag {
                display:inline-block!important;
                padding:0 0.2rem;
                border-radius: 3px;
                &.is-info {
                    background-color: var(--af-ansible-output-bg-timestamp)!important;
                    color: var(--af-ansible-output-timestamp)!important;
                }
                &.is-warning {
                    background-color: var(--bs-light)!important;
                    color: var(--bs-light)!important;
                }
                &.is-danger {
                    background-color: var(--af-ansible-output-danger)!important;
                    color: var(--bs-light)!important;
                }
                &.is-success {
                    background-color: var(--af-ansible-output-success)!important;
                    color: var(--bs-light)!important;
                }

            }
        }

        .has-text-danger {
            color: var(--af-ansible-output-danger)!important;
        }

        .has-text-success {
            color: var(--af-ansible-output-success)!important;
        }

        .has-text-warning {
            color: var(--af-ansible-output-warning)!important;
        }        
    } 
</style>