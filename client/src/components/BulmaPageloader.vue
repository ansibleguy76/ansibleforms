<template>
  <div class="pageloader is-active">
    <span class="title">
      <slot></slot>
    </span>
  </div>
</template>
<script>
  import "@/assets/scss/bulma-pageloader/index.scss"
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
