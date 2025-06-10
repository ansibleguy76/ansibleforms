<template>
  <span>
      <input :type="checktype" :id="_uid" class="is-checkradio" :disabled="disabled" :class="type" :value="val" v-model="checked" focus="prevent">
      <label :for="_uid"> {{ label }}</label>
  </span>
</template>
<script>
  import "@/assets/sass/bulma-checkradio/index.sass"
  export default{
    name:"BulmaRadio",
    props: ['type','value', 'val','label','checktype','disabled'],
    data () {
      return {
      }
    },
    computed: {
      checked: {
        get() {
          return this.value
        },
        set(value) {
          this.$emit('input', value)
          this.$emit('change')
        }
      }
    },
    methods:{
      prevent(e){
        e.preventDefault()
      }
    }
  }
</script>
