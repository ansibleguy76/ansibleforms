<template>
  <article class="tile is-child box" v-if="formConfig && formConfig.forms">
    <div class="field">
      <p class="control has-icons-left">
        <input class="input" type="text" v-model="search" placeholder="Search">
        <span class="icon is-small is-left">
          <font-awesome-icon icon="search" />
        </span>
      </p>
    </div>
    <div class="columns is-flex-wrap-wrap">
      <div class="column is-one-quarter-fullhd is-one-third-widescreen is-half-tablet" v-for="form in getForms" :key="form.name">
        <router-link :to="'/form/?form='+encodeURI(form.name)" class="box" :class="getFormClass(form)" >
          <article class="media">
            <div v-if="form.image || form.icon" class="media-left">
              <figure v-if="form.image" class="image is-64x64">
                <img :src="form.image" alt="Image">
              </figure>
              <span v-if="form.icon" class="icon is-large">
                <font-awesome-icon class="fa-3x has-text-grey" :icon="(form.icon.includes(','))?(form.icon.split(',')):(form.icon)" />
              </span>
            </div>
            <div class="media-content">
              <div class="content">
                <p class="subtitle" :class="getFormClass(form)">{{ form.name }}</p>
                <p class="content">{{ form.description }}</p>
              </div>
            </div>
          </article>
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
        search:""
      }
    },
    computed:{
      filterFormsBySearch(){
        var f=this.formConfig?.forms || []
        if(this.search){
          return f.filter(x=>x.name.toLowerCase().includes(this.search.toLowerCase()))
        }else{
          return f
        }
      },
      currentCategory(){
        return decodeURIComponent(this.$route.query?.category || "")
      },
      getForms(){
        return this.filterAllowedForms(this.currentCategory)
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
        }).sort((a, b) => (a.name||"").toLowerCase() > (b.name||"").toLowerCase() && 1 || -1)
      },

      // filter all the forms per category
      filterForms(category){
        var f=this.filterFormsBySearch || []
        if(!category){
          // if no category is given, pass all forms (=all)
          return f
        }else{
          return f.filter((item)=>{
            if(item.categories!=undefined){
              for(let j=0;j<item.categories.length;j++){
                // if in any, we show
                if(this.inCategory(item.categories[j],category))return true
              }
              return false
            }else{
              // if no category was give, add to Default
              return (category=="Default")
            }
          })
        }
      },
      inCategory(c,category){
        var x = category.split("/")
        var y = c.split("/")
        for(let i=0;i<x.length;i++){
          if(i<y.length){
            if(x[i]!=y[i]){
              return false
            }
          }else{
            return false
          }
        }
        return true
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
