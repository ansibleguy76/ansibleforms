<template>
  <section v-if="isAdmin" class="section">
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="cogs" /> Settings</h1>
      <div class="box">
        <h3 class="subtitle"><font-awesome-icon icon="envelope" /> <span class="mr-3">Mail Settings</span><BulmaCheckbox checktype="checkbox" v-model="settings.mail_secure" label="Enable Tls" /><BulmaCheckbox checktype="checkbox" v-model="test.enabled" label="Test Mail" /></h3>
        <div class="columns">
          <div class="column">
            <BulmaInput icon="server" v-model="settings.mail_server" label="Server" placeholder="mail_domain.local" :required="true" :hasError="$v.settings.mail_server.$invalid" :errors="[]" />
            <BulmaInput icon="arrows-alt-v" type="number" v-model="settings.mail_port" label="Port" placeholder="25" :required="true" :hasError="$v.settings.mail_port.$invalid" :errors="[]" />
          </div>
          <div class="column">
            <BulmaInput icon="user" v-model="settings.mail_username" label="username" placeholder="username" :required="false" :hasError="false" :errors="[]" />
            <BulmaInput icon="lock" v-model="settings.mail_password" type="password" label="password" placeholder="" :required="false" :hasError="false" :errors="[]" />

          </div>
          <div class="column">
            <BulmaInput icon="envelope" v-model="settings.mail_from" type="email" label="mail from" placeholder="" :required="true" :hasError="$v.settings.mail_from.$invalid" :errors="[]" />
            <BulmaInput v-if="test.enabled" icon="envelope" v-model="test.to" type="email" label="mail to" placeholder="" :required="true" :hasError="$v.test.to.$invalid" :errors="[]" />
            <BulmaButton v-if="test.enabled" icon="check" label="Test Mail Settings" @click="testMail()"></BulmaButton>
          </div>
        </div>

      </div>
      <div class="box">
        <BulmaInput icon="globe" v-model="settings.url" type="url" label="AnsibleForms Url" placeholder="https://ansibleforms:8443" :required="true" :hasError="$v.settings.url.$invalid" :errors="[]" />
      </div>
      <BulmaButton icon="save" label="Update Settings" @click="updateSettings()"></BulmaButton>
    </div>
  </section>
</template>
<script>
  import Vue from 'vue'
  import axios from 'axios'
  import Vuelidate from 'vuelidate'
  import BulmaButton from './../components/BulmaButton.vue'
  import BulmaInput from './../components/BulmaInput.vue'
  import BulmaCheckbox from './../components/BulmaCheckRadio.vue'
  import TokenStorage from './../lib/TokenStorage'
  import { required, email, minValue,maxValue,minLength,maxLength,helpers,requiredIf,sameAs } from 'vuelidate/lib/validators'

  Vue.use(Vuelidate)

  export default{
    name: "Settings",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{BulmaButton,BulmaInput,BulmaCheckbox},
    data(){
      return  {
          settings:{
            mail_server:"",
            mail_port:"",
            mail_username:"",
            mail_password:"",
            mail_secure:true,
            mail_from:""
          },
          test:{
            enabled:false,
            to:""
          }
        }
    },
    methods:{
      loadSettings(){
        var ref= this;
        axios.get('/api/v1/settings/',TokenStorage.getAuthentication())
          .then((result)=>{
            ref.settings=result.data.data.output;
          }),function(error){
            ref.$toast.error(error.message);
          };
      },updateSettings(){
        var ref= this;
        if (!this.$v.settings.$invalid) {
          axios.put('/api/v1/settings/',this.settings,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                ref.$toast.success("Settings are updated");
                ref.loadSettings();
              }
            }),function(error){
              ref.$toast.error(error.message);
            };
        }else{
          this.$toast.warning("Invalid form data")
        }
      },
      testMail(){
        var ref= this;
        if (!this.$v.settings.$invalid && !this.$v.test.$invalid) {
          axios.post('/api/v1/settings/mailcheck/',{...this.settings,...this.test},TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                ref.$toast.success(result.data.message);
              }
            }),function(error){
              ref.$toast.error(error.message);
            };
          }else{
            this.$toast.warning("Invalid form data")
          }
      }
    },
    validations: {
      settings:{
        mail_server: {
          required
        },
        mail_port: {
          required
        },
        mail_from:{
          required,
          email
        },
        url:{
          required
        }
      },
      test:{
        to:{
          required,
          email
        }
      }

    },
    mounted() { // when the Vue app is booted up, this is run automatically.
        this.loadSettings();
    }
  }
</script>
<style scoped>
  .cursor-progress{
    cursor:progress;
  }
  .select, .select select{
    width:100%;
  }
</style>
