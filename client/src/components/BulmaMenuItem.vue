<template>
  <li v-if="countFormsByCategory(path)>0">
    <a :class="{'is-active':isHighLighted}" class="is-size-6" @click="$emit('click',path)">
      <font-awesome-icon :icon="(menu.icon.includes(','))?(menu.icon.split(',')):(menu.icon)" class="mr-2" fixed-width />{{ menu.name }}
      <span class="tag is-primary is-pulled-right">{{ countFormsByCategory(path) }}</span>
    </a>
    <ul class="menu-list ml-5 mr-0 my-1" v-if="isActive && menu && menu.items && menu.items.length>0">
      <BulmaMenuItem @click="goto(path+'/'+item.name)" v-for="item in menu.items" :key="path+'/'+item.name"
        :currentPath="currentPath"
        :parent="path"
        :menu="item"
        :forms="forms"
        :roles="roles"
      />
    </ul>
  </li>
</template>
<script>
  import Vue from 'vue'
  import BulmaMenuItem from './BulmaMenuItem'
  export default{
    name:"BulmaMenuItem",
    props:{
      currentPath:{type:String,default:""},
      parent:{type:String,default:""},
      menu:{type:Object},
      forms:{type:Array},
      roles:{type:Array}
    },
    components:{BulmaMenuItem},
    computed:{
      path(){
        return (this.parent)?this.parent+'/'+this.menu.name:this.menu.name
      },
      isActive(){
        var x = this.currentPath.split("/")
        var y = this.path.split("/")
        for(let i=0;i<x.length;i++){
          if(i<y.length){
            if(x[i]!=y[i])return false
          }else{
            return true
          }
        }
        return true
      },
      isHighLighted(){
        return this.currentPath==this.path
      }
    },
    data(){
      return  {
      }
    },
    methods:{
      goto(path){
        if(path)
          this.$router.replace({ path:"/", query:{category:encodeURIComponent(path)}}).catch((e)=>{})
        else
          this.$router.replace({ path:"/" }).catch((e)=>{})
      },
      filterAllowedForms(category){
        var intersect=[]
        return this.filterForms(category).filter((item)=>{ // loop all forms
          if(item.roles){
            // if roles are defined, find a match with the payload roles
            intersect = item.roles.filter(role => this.roles.includes(role));
          }else{
            intersect=[]
          }
          // allow form if user is admin, or has a matching role
          if(this.isAdmin() || (intersect && intersect.length>0)){
            return true
          }else{
            return false
          }
        })
      },
      // filter all the forms per category
      filterForms(category){
        if(!category){
          // if no category is given, pass all forms (=all)
          return this.forms
        }else{
          return this.forms.filter((item)=>{
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
      countFormsByCategory(category){
        // count the forms in a category
        return this.filterAllowedForms(category).length
      },
      isAdmin(){
        return this.roles.includes("admin")
      },
    }
  }
</script>
<style scoped>
</style>
