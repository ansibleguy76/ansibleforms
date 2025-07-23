<script setup>

    /******************************************************************/
    /*                                                                */
    /*  Bootstrap Theme Switcher component                            */
    /*                                                                */
    /*  @props:                                                       */
    /*      buttonClass: String                                       */
    /*                                                                */
    /*  @emit:                                                        */
    /*      themeChanged: Event                                       */
    /*                                                                */
    /******************************************************************/

    import Theme from "@/lib/Theme";

    // MODEL

    const currentTheme = defineModel()

    // INIT

    const themes = Theme.themes();
    const emit = defineEmits(['themeChanged']);

    // PROPS

    const props = defineProps({
        buttonClass: {
            type: String
        }
    });

    // METHODS

    function setTheme(theme) {
        Theme.set(theme);
        currentTheme.value = theme;
    }

    // COMPUTED
    
    const themeIcon = computed(() => {
        // return icon based on current theme (grab it from themes, based on value currentTheme.value)
        return themes.find(t => t.value == currentTheme.value).icon;
    })
</script>
<template>
    <BsNavMenu :icon="themeIcon" title="Toggle switcher" :buttonClass="buttonClass">
        <li v-for="t in themes">
            <button type="button" class="dropdown-item d-flex align-items-center" @click="setTheme(t.value)"
                :class="{ 'active': currentTheme == t.value }">
                <span class="icon"><FaIcon :icon="t.icon" :fixedwidth="true" /></span>
                <span class="ms-2">{{ t.title }}</span>
                <span v-if="currentTheme == t.value" class="icon ms-auto"><font-awesome-icon icon="check" /></span>
            </button>
        </li>
    </BsNavMenu>
</template>