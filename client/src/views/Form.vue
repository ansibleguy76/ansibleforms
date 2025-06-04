<template>
    <Form :isAdmin="isAdmin" :profile="profile" :constants="formConfig.constants||{}" :token="token" :key="componentKey" @rerender="load" @refreshApprovals="$emit('refreshApprovals')" :currentForm="currentForm" />
</template>
<script>

  import Form from './../components/Form.vue'
  import FormLib from './../lib/Form'
  export default{
    name:"FormContainer",
    components:{Form},
    props:{
      token:{type:String},
      isAdmin:{type:Boolean},
      profile:{type:Object}
    },
    data(){
      return  {
        componentKey:0,
        currentForm:undefined,
        formConfig:undefined
      }
    },
    watch: {
    },
    methods:{
      load(){
        var ref=this
        FormLib.getForm(ref.$route.query.form,function(formConfig){
          ref.formConfig=formConfig
          ref.currentForm=formConfig.forms[0]
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
