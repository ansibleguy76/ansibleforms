<template>
  <div></div>
</template>
<script>
  import Vue from 'vue'
  export default{
    name:"FormReloader",
    data(){
      return  {
      }
    },
    methods:{
    },
    mounted() { // when the Vue app is booted up, this is run automatically.
      this.$router.push({name:'Form',query:this.$router.currentRoute.query})
    }
  }
</script>
<style scoped>
</style>
