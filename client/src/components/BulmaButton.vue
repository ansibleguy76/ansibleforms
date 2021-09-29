<template>
    <div class="field">
      <button class="button is-outlined is-fullwidth is-info" @click="click">
        <span class="icon" v-if="message==''"><font-awesome-icon :icon="icon" /></span>
        <span class="icon" v-if="message!=''"><font-awesome-icon icon="spinner" spin /></span>
        <span v-if="message==''">{{ label }}</span>
        <span v-if="message!=''">{{ message }}</span>
      </button>
    </div>
</template>
<script>
  import Vue from 'vue'
  import { library } from '@fortawesome/fontawesome-svg-core'
  import { fas } from '@fortawesome/pro-solid-svg-icons'
  import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
  library.add(fas) // add all solid icons
  Vue.component('font-awesome-icon', FontAwesomeIcon)
  export default{
    name:"BulmaButton",
    props:{
      type:{type:String,default:'is-info'},
      icon:{type:String,default:'fa-user'},
      label:{type:String,required:true},
      message:{type:String,default:''}
    },
    data(){
      return  {

      }
    },methods:{
      click(event){
        this.$emit('click','bye')
      }
    }
  }
</script>
