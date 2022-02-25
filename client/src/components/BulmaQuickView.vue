<template>
  <transition name="slide-fade" appear>
    <div class="quickview is-active">
      <header class="quickview-header is-vcentered">
        <p class="has-text-weight-bold is-size-4">{{ title }}</p>
        <span class="delete" @click="$emit('close')"></span>
      </header>

      <div class="quickview-body">
        <div class="quickview-block p-4">
          <slot></slot>
        </div>
      </div>

      <footer v-if="footer" class="quickview-footer">
        <p>{{ footer }}</p>
      </footer>
    </div>
  </transition>
</template>
<script>
  import Vue from 'vue'
  import "../../public/assets/bulma_quickview.scss"
  export default{
    name:"BulmaQuickView",
    props:{
      title:{type:String},
      footer:{type:String}
    },
    data(){
      return  {

      }
    },methods:{
    }
  }
</script>
<style scoped>
.slide-fade-enter-active, .slide-fade-leave-active {
  transform: translateX(0%);
  transition: all 0.4s ease-in-out;
}
.slide-fade-enter, .slide-fade-leave-to {
  transform: translateX(100%);
}
</style>
