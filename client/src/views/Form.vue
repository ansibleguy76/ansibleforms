<template>
    <Form v-if="currentForm" :token="token" :currentForm="currentForm" />
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
    },
    mounted() {
    }
  }
</script>
<style scoped>
</style>
