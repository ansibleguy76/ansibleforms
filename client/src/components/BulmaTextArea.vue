<template>
  <div class="field">
    <label v-if="label!=''" class="label">{{label}} <span v-if="required" class="has-text-danger">*</span></label>
    <textarea class="textarea is-family-monospace" rows="10" @keyup.enter="$emit('enterClicked')"  :readonly="readonly" v-focus="focus" :type="type" :value="value" :class="{'is-danger':hasError}" @input="$emit('input', $event.target.value)" :placeholder="placeholder"></textarea>
    <p class="has-text-danger" v-for="e in errors" :key="e.label" :class="{'is-hidden':!e.if}">{{ e.label }}</p>
  </div>
</template>
<script>

  import Vue from 'vue'
  Vue.directive('focus', {
    // When the bound element is inserted into the DOM...
    inserted: function (el,binding) {
      // Focus the element
      if(binding.value=="true"){
        el.focus()
      }
    }
  })
  export default{
    name:"BulmaTextArea",
    props:{
      focus:{type:String,default:""},
      value:{type:[String,Number],default:""},
      required:{type:Boolean,default:false},
      type:{type:String,default:"text"},
      readonly:{type:Boolean,default:false},
      rows:{type:String,default:"10"},
      placeholder:{type:String,default:""},
      icon:{type:String,default:''},
      label:{type:String,default:""},
      hasError:{type:Boolean,default:false},
      errors:{type:Array},
    },data(){
      return{
      }
    }
  }
</script>
<style scoped>
  .select, .select select{
    width:100%;
  }
</style>
