<template>
  <nav class="panel is-primary" v-if="formConfig && formConfig.categories">
    <p class="panel-heading">
      Categories
    </p>
    <router-link class="panel-block" to="/">
      <div class="control">
        <div class="level">
          <div class="level-left">
            <span class="icon mr-3"><font-awesome-icon icon="layer-group" /></span>
            <span>All</span>
          </div>
          <div class="level-right">
            <span class="tag is-primary is-medium">{{countFormsByCategory('')}}</span>
          </div>
        </div>
      </div>
    </router-link>
    <router-link v-for="category in formConfig.categories.filter(category => countFormsByCategory(category.name)>0)" :key="category.name" class="panel-block" :class="category.class" :to="'/?category='+encodeURI(category.name)">
      <div class="control">
        <div class="level">
          <div class="level-left">
            <span class="icon mr-3"><font-awesome-icon :icon="category.icon" /></span>
            <span>{{ category.name }}</span>
          </div>
          <div class="level-right">
            <span class="tag is-primary is-medium">{{countFormsByCategory(category.name)}}</span>
          </div>
        </div>
      </div>
    </router-link>
  </nav>
</template>
<script>
  import Vue from 'vue'
  import TokenStorage from './../lib/TokenStorage'
  export default{
    name:"Categories",
    props:{
      formConfig:{type:Object}
    },
    data(){
      return  {

      }
    },methods:{
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
              if(item.categories!=undefined){
                return (item.categories.includes(category))  // selected category
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
      countFormsByCategory(category){
        // count the forms in a category
        return this.filterAllowedForms(category).length
      },
      isAdmin(payload){
        return payload.user.roles.includes("admin")
      },
    }
  }
</script>
<style scoped>
  .panel-block.is-active .level-left{
    color:#00b1b2;
    font-weight:bold;
  }
</style>
