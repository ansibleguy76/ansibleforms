<template>
  <article class="tile is-child box">
    <div class="columns is-flex-wrap-wrap">
      <div class="column is-4" v-for="form in getForms" :key="form.name">
        <router-link :to="'/form/?form='+encodeURI(form.name)" class="box" :class="getFormClass(form)" >
          <p class="subtitle">{{ form.name }}</p>
          <p class="content">{{ form.description }}</p>
        </router-link>
      </div>
    </div>
  </article>
</template>
<script>
  import Vue from 'vue'
  import TokenStorage from './../lib/TokenStorage'
  export default{
    name:"FormTiles",
    props:{
      formConfig:{type:Object}
    },
    data(){
      return  {
      }
    },
    computed:{
      getForms(){
        return this.filterAllowedForms(this.$route.query.category)
      },
    },
    methods:{

      filterAllowedForms(category){
        // get the token payload
        var payload=TokenStorage.getPayload()
        var intersect=[]
        return this.filterForms(category).filter((item)=>{ // loop all forms
          if(item.roles){
            // if roles are defined, find a match with the payload roles
            intersect = item.roles.filter(role => payload.user.roles.includes(role));
          }else{
            intersect=[]
          }
          // allow form if user is admin, or has a matching role
          if(this.isAdmin(payload) || (intersect && intersect.length>0)){
            return true
          }else{
            return false
          }
        })
      },
      // filter all the forms per category
      filterForms(category){
        if(this.formConfig!=undefined){
          if(!category){
            // if no category is given, pass all forms (=all)
            return this.formConfig.forms
          }else{
            return this.formConfig.forms.filter((item)=>{
              if(item.category!=undefined){
                return (item.category.includes(category))  // selected category
              }else{
                // if no category was give, add to Default
                return (category=="Default")
              }
            })
          }
        }else{
          // forms not loaded or empty
          return []
        }
      },
      isAdmin(payload){
        return payload.user.roles.includes("admin")
      },
      getFormClass(form){
        return (form.tileClass==undefined)?'has-background-primary-light':form.tileClass
      }
    }
  }
</script>
<style scoped>
  .box{
    height:100%
  }
</style>
