<template>
    <Form v-if="currentForm" :isAdmin="isAdmin" :constants="formConfig.constants||{}" :token="token" :key="componentKey" @rerender="load" @refreshApprovals="$emit('refreshApprovals')" :currentForm="currentForm" />
</template>
<script>
  import Vue from 'vue'
  import axios from 'axios'
  import Form from './../components/Form.vue'
  import FormLib from './../lib/Form'
  export default{
    name:"FormContainer",
    components:{Form},
    props:{
      token:{type:String},
      isAdmin:{type:Boolean}
    },
    data(){
      return  {
        componentKey:0,
        formConfig:undefined
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
      load(){
        var ref=this
        FormLib.load(function(formConfig){
          ref.formConfig=formConfig
          ref.componentKey++;
        },function(err){
          ref.$toast.error(err.toString())
          if(ref.$route.name!="Login"){
            ref.$router.replace({name:"Error"}).catch(err => {});
          }
        })
      }
    },
    mounted() { // when the Vue app is booted up, this is run automatically.
      this.load()
    }
  }
</script>
<style scoped>
</style>
