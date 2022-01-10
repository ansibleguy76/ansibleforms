<template>
  <div id="app">
    <BulmaNav :isAdmin="isAdmin" :authenticated="authenticated" :profile="profile" @logout="logout()" :version="version" />
    <router-view :formConfig="formConfig" :isAdmin="isAdmin" :authenticated="authenticated" :errorMessage="errorMessage" :errorData="errorData" @authenticated="loadFormConfig" @logout="logout()" />
  </div>
</template>
<script>
  import BulmaNav from './components/BulmaNav.vue'
  import axios from 'axios'
  import TokenStorage from './lib/TokenStorage'
  export default{
    components:{BulmaNav},
    name:"AnsibleForms",
    data(){
      return{
        formConfig:undefined,
        errorMessage:"",
        errorData:{success:[],failed:[]},
        profile:"",
        authenticated:false,
        isAdmin:false,
        version:"unknown"
      }
    },
    computed: {
    },
    beforeMount() {
      this.loadVersion()
      this.checkDatabase()
    },
    methods: {
        refreshAuthenticated(){
          this.authenticated = TokenStorage.isAuthenticated()
          // console.log("checking if is admin")
          var payload = TokenStorage.getPayload()
          if(payload.user && payload.user.roles){
            this.isAdmin=payload.user.roles.includes("admin")
          }
        },
        loadVersion(){
          var ref=this;

          axios.get('/api/v1/version')                               // check database
            .then((result)=>{
              if(result.data.status=="success"){
                ref.version=result.data.message
              }
            })
            .catch(function(err){
              // silent fail
            });
        },
        checkDatabase(){
          var ref=this;

          axios.get('/api/v1/schema')                               // check database
            .then((result)=>{
              if(result.data.status=="error"){
                ref.errorMessage=result.data.message;
                ref.errorData=result.data.data;
                if(!ref.errorMessage)ref.errorMessage="Unknown error"
                if(typeof ref.errorMessage=="object"){ref.errorMessage=ref.errorMessage.message}
                if(ref.errorMessage.startsWith("ERROR")){ // actual error, send to error page
                  ref.errorMessage="Failed to check AnsibleForms database schema\n\n" + ref.errorMessage;
                  ref.$router.replace({name:"Error"}).catch(err => {});
                }else{ // not a real error, send to schema page
                  ref.$router.replace({name:"Schema"}).catch(err => {});
                }
              }else{
                this.loadFormConfig()
              }

            })
            .catch(function(err){
              ref.$toast.error("Failed to check AnsibleForms database schema");
              ref.errorMessage="Failed to check AnsibleForms database schema\n\n" + err
              ref.$router.replace({name:"Error"}).catch(err => {});
            });

        },
        loadProfile(){
          var ref=this;
          var payload = TokenStorage.getPayload()
          ref.profile = payload.user.username
        },
        resetProfile(){
          this.profile=""
        },
        loadFormConfig(){
          var ref= this;


          if(!TokenStorage.isAuthenticated()){
              //this.$toast.error("You need to authenticate")
              this.$router.replace({ name: "Login" }).catch(err => {});         // no token found, logout
          }else{

            axios.get(`/api/v1/config?timestamp=${new Date().getTime()}`,TokenStorage.getAuthentication())                               // load forms
              .then((result)=>{
                ref.formConfig=result.data;
                if(!ref.formConfig.error){
                  // ref.$toast.success("Valid forms.yaml loaded")
                  ref.$router.push({name:"Home"}).catch(err => {});
                  ref.refreshAuthenticated()
                  this.loadProfile()
                }else{
                    ref.$toast.error("Invalid forms.yaml")
                    ref.errorMessage="Error in forms.yaml file\n\n" + ref.formConfig.error
                    ref.$router.replace({name:"Error"}).catch(err => {});
                }
              })
              .catch(function(err){
                if(err.response && err.response.status!=401){
                  ref.errorMessage="Could not get forms.yaml file\n\n" + err
                  ref.$router.replace({name:"Error"}).catch(err => {});
                }else{
                  ref.$toast.error("Failed to load forms.yaml file")
                }
              })
          }
        },
        logout() {
            TokenStorage.clear()
            this.formConfig=undefined
            this.$router.replace({ name: "Login" }).catch(err => {});
            this.refreshAuthenticated()
            this.resetProfile()
        }
    }
  }
</script>
