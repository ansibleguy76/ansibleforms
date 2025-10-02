<script setup>

    /******************************************************************/
    /*                                                                */
    /*  Bootstrap Navbar component                                    */
    /*                                                                */
    /*  @props:                                                       */
    /*      currentTheme: String                                      */
    /*                                                                */
    /*  @slots:                                                       */
    /*      default: Navbar content                                   */
    /*                                                                */
    /******************************************************************/

    const props = defineProps({
        currentTheme: {
            type: String,
            required: true
        },
    });
</script>

<template>
  <nav class="navbar navbar-expand-md border border-secondary-subtle border-top-0 border-start-0 border-end-0 border-bottom-1 py-3">
    <div class="container-xxl">
      <router-link class="navbar-brand ms-3" to="/">
        <img class="logo my-auto" v-if="currentTheme === 'dark'" src="@/assets/img/logo_dark.svg?url" />
        <img class="logo my-auto" v-else-if="currentTheme === 'light'" src="@/assets/img/logo_light.svg?url" />
        <img class="logo my-auto" v-else src="@/assets/img/logo_color.svg?url" />
      </router-link>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarCollapse"
        aria-controls="navbarCollapse" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarCollapse">
        <slot></slot>
      </div>
    </div>
  </nav>
</template>
<style scoped lang="scss">
.logo {
  max-width: 200px;
  max-height: 30px;
}

</style>