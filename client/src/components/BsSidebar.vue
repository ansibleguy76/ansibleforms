<script setup>

  /******************************************************************/
  /*                                                                */
  /*  Bootstrap Sidebar component                                   */
  /*                                                                */
  /*  @props:                                                       */
  /*      title: String                                             */
  /*      icon: String                                              */
  /*      items: Array                                              */
  /*                                                                */
  /******************************************************************/

  import { useRoute } from "vue-router";

  // INIT

  const route = useRoute();

  // PROPS

  const props = defineProps({
    title: String,
    icon: String,
    items: Array
  });

  // COMPUTED
  
  const splitItems = computed(() => {
    let result = [];
    let current = [];
    for (let i = 0; i < props.items.length; i++) {
      if (props.items[i].title === "divider") {
        result.push(current);
        current = [];
      } else {
        current.push(props.items[i]);
      }
    }
    result.push(current);
    return result;
  });

  // METHODS

  const isActive = (link) => {
    return route.path.includes(link);
  };


</script>
<template>
    <div class="d-flex flex-column p-3 bg-body-tertiary" style="width: 280px;">
    <h3 v-if="title" class="d-flex align-items-center mb-3 mb-md-0 me-md-auto">
      <span v-if="icon" class="icon"><font-awesome-icon :icon="icon" /></span>
      <span class="ms-2">{{ title }}</span>
    </h3>
    <div class="mb-auto">
      <template v-for="itms in splitItems">

      <ul class="nav nav-pills flex-column">
        <li v-for="i in itms"  class="nav-item">
          <router-link :to="i.link" class="nav-link" :class="{'active':isActive(i.link),'link-body-emphasis':!isActive(i.link)}" aria-current="page">
            <FaIcon :icon="i.icon" :fixedwidth="true" />
            {{ i.title }}
          </router-link>
        </li>
      </ul>
      <hr>
    </template>      
    </div>
  </div>
</template>
<style scoped>
</style>