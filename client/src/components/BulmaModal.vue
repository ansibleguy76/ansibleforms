<template>
  <div class="modal is-active">
    <div class="modal-background"></div>
    <div class="modal-card" :class="type">
      <header class="modal-card-head">
        <p class="modal-card-title">{{ title }}</p>
        <button class="delete" aria-label="close" @click="$emit('close')"></button>
      </header>
      <section class="modal-card-body">
        <slot></slot>
      </section>
      <footer class="modal-card-foot">
        <a v-if="href" target="_blank" class="button is-white" :href="href"><span  v-if="icon" class="icon is-text-info"><font-awesome-icon :icon="icon" /></span><span>{{ action }}</span></a>
        <button v-if="action && !href" class="button is-white" @click="$emit('click')"><span  v-if="icon" class="icon is-text-info"><font-awesome-icon :icon="icon" /></span><span>{{ action }}</span></button>
        <button v-if="actionSuccess" class="button is-white" @click="$emit('clickSuccess')">{{ actionSuccess }}</button>
        <button v-if="actionDanger" class="button is-white" @click="$emit('clickDanger')">{{ actionDanger }}</button>
        <button class="button is-white" @click="$emit('cancel')">Cancel</button>
      </footer>
    </div>
  </div>
</template>
<script>
  import Vue from 'vue'
  export default{
    name:"BulmaModal",
    props:['title','href','icon','action','actionSuccess','actionDanger','type'],
    data(){
      return{
      }
    }
  }
</script>
<style scoped>
.large {
  height:95vh!important;
  width:70vw!important;
}
.modal{
  z-index:91000;
}

</style>
