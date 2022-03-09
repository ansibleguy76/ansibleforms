<template>
  <div class="field">
      <label class="label">{{label}} <span v-if="required" class="has-text-danger">*</span></label>
      <div class="control has-icons-left">
          <div class="select" :class="{'is-danger':hasError}">
            <select v-model="selected" :value="val">
              <option value="-1" disabled>{{ label}}</option>
              <option v-for="col in list" :key="(valuecol)?col[valuecol]:col" :value="(valuecol)?col[valuecol]:col">{{ (labelcol)?col[labelcol]:col }}</option>
            </select>
          </div>
          <span class="icon is-left">
            <font-awesome-icon :icon="icon" />
          </span>
      </div>
      <p class="has-text-danger" v-for="e in errors" :key="e.label" :class="{'is-hidden':!e.if}">{{ e.label }}</p>
  </div>
</template>
<script>
  import Vue from 'vue'
  export default{
    name:"BulmaSelect",
    props:{
      value:{type:[String,Number,Array],default:"-1"},
      val:{type:[String,Number],default:"-1"},
      required:{type:Boolean,default:false},
      icon:{type:[String,Array],default:''},
      label:{type:String,required:true},
      list:{type:Array,required:true},
      valuecol:{type:String,required:true},
      labelcol:{type:String,required:true},
      hasError:{type:Boolean,default:false},
      errors:{type:Array},
    },data(){
      return{
      }
    },
    computed: {
      selected: {
        get() {
          return this.value
        },
        set(value) {
          this.$emit('input', value)
          this.$emit('change', value)
        }
      }
    }
  }
</script>
<style scoped>
  .select, .select select{
    width:100%;
  }
</style>
