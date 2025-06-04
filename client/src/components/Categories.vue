<template>
  <aside class="menu" v-if="formConfig && formConfig.categories">
    <p class="menu-label is-clickable" @click="goto('')">
      Categories
    </p>
    <ul class="menu-list">
      <BulmaMenuItem @click="goto" v-for="item in formConfig.categories" :key="item.name"
          :currentPath="currentCategory"
          parent=""
          :menu="item"
          :forms="forms"
      />
    </ul>
  </aside>
</template>
<script>
  import Vue from 'vue'
  import TokenStorage from './../lib/TokenStorage'
  import BulmaMenuItem from './BulmaMenuItem.vue'
  export default{
    name:"Categories",
    props:{
      formConfig:{type:Object}
    },
    components:{BulmaMenuItem},
    data(){
      return  {
      }
    },
    computed:{
      currentCategory(){
        return decodeURIComponent(this.$route.query?.category || "")
      },
      forms(){
        return (this.formConfig?.forms.map(x=>{return {categories:x.categories}}) ||[])
      }
    },
    methods:{
      goto(path){
        if(path)
          this.$router.replace({ path:"/", query:{category:encodeURIComponent(path)}}).catch((e)=>{})
        else
          this.$router.replace({ path:"/" }).catch((e)=>{})
      }
    }
  }
</script>
<style scoped>
</style>
