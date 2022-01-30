<template>
    <Form v-if="currentForm" :token="token" :key="componentKey" @rerender="rerender" :currentForm="currentForm" />
</template>
<script>
  import Vue from 'vue'
  import axios from 'axios'
  import Form from './../components/Form.vue'
  export default{
    name:"FormContainer",
    components:{Form},
    props:{
      formConfig:{type:Object},
      token:{type:String}
    },
    data(){
      return  {
        componentKey:0
      }
    },
    computed: {
      currentForm(){
        if(this.formConfig){
          return this.formConfig.forms.find((item)=>item.name==this.$route.query.form)
        }else{
          return undefined
        }
      }
    },
    watch: {
    },
    methods:{
      rerender(){
        this.componentKey++;
      }
    },
    mounted() {
    }
  }
</script>
<style scoped>
</style>
