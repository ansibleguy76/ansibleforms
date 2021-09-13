<template>
  <div class="field">
    <label class="checkbox">
      <input type="checkbox" :value="val" v-model="checked" @change="$emit('ischanged')">
      <span v-if="label!=''" class="has-text-weight-bold"> {{ label }}</span>
    </label>
  </div>
</template>
<script>
  import Vue from 'vue'
  export default{
    name:"BulmaCheckbox",
    props: ['value', 'val','label'],
    data () {
      return {
        checkedProxy: false
      }
    },
    computed: {
      checked: {
        get() {
          return this.value
        },
        set(value) {
          this.$emit('input', value)
        }
      }
    }
  }
</script>
