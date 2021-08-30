<template>
    <div class="field">
      <button class="button is-outlined is-fullwidth is-info" @click="click">
        <span class="icon" v-if="message==''"><i class="fas" :class="icon"></i></span>
        <span class="icon" v-if="message!=''"><i class="fas fa-spinner fa-pulse"></i></span>
        <span v-if="message==''">{{ label }}</span>
        <span v-if="message!=''">{{ message }}</span>
      </button>
    </div>
</template>
<script>
  import Vue from 'vue'
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
