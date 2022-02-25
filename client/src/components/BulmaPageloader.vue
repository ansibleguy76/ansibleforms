<template>
  <div class="pageloader is-active">
    <span class="title">
      <slot></slot>
    </span>
  </div>
</template>
<script>
  import Vue from 'vue'
  import "../../public/assets/bulma_pageloader.scss"
  export default{
    name:"BulmaPageloader",
    props:{
    },
    data(){
      return  {

      }
    },methods:{
    }
  }
</script>
<style scoped>

</style>
