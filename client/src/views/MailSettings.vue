<template>
  <section v-if="isAdmin" class="section">
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="cogs" /> Settings</h1>
      <div class="columns">
        <div class="column is-narrow">
          <BulmaSettingsMenu />
        </div>
        <div class="column">
          <nav class="level">
            <!-- Left side -->
            <div class="level-left">
              <p class="level-item"><BulmaButton icon="save" label="Update Settings" @click="updateSettings()"></BulmaButton></p>
            </div>
          </nav>
          
          <div class="box">
            <h3 class="subtitle"><font-awesome-icon icon="envelope" /> <span class="mr-3">Mail Settings</span><BulmaCheckbox checktype="checkbox" v-model="settings.mail_secure" label="Enable Tls" /><BulmaCheckbox checktype="checkbox" v-model="test.enabled" label="Test Mail" /></h3>
            <div class="columns">
              <div class="column">
                <BulmaInput icon="server" v-model="settings.mail_server" label="Server" placeholder="mail_domain.local" :required="true" :hasError="$v.settings.mail_server.$invalid" :errors="[]" />
                <BulmaInput icon="arrows-alt-v" type="number" v-model="settings.mail_port" label="Port" placeholder="25" :required="true" :hasError="$v.settings.mail_port.$invalid" :errors="[]" />
              </div>
              <div class="column">
                <BulmaInput icon="user" v-model="settings.mail_username" label="Username" placeholder="username" :required="false" :hasError="false" :errors="[]" />
                <BulmaInput icon="lock" v-model="settings.mail_password" type="Password" label="password" placeholder="" :required="false" :hasError="false" :errors="[]" />

              </div>
              <div class="column">
                <BulmaInput icon="envelope" v-model="settings.mail_from" type="email" label="Mail from" placeholder="" :required="true" :hasError="$v.settings.mail_from.$invalid" :errors="[]" />
                <BulmaInput v-if="test.enabled" icon="envelope" v-model="test.to" type="email" label="Mail to" placeholder="" :required="true" :hasError="$v.test.to.$invalid" :errors="[]" />
                <BulmaButton v-if="test.enabled" icon="check" label="Test Mail Settings" @click="testMail()"></BulmaButton>
              </div>
            </div>

          </div>
     
        </div>
      </div>
    </div>
  </section>
</template>
<script>
  import Vue from 'vue'
  import axios from 'axios'
  import Vuelidate from 'vuelidate'
  import BulmaButton from '../components/BulmaButton.vue'
  import BulmaInput from '../components/BulmaInput.vue'
  import BulmaCheckbox from '../components/BulmaCheckRadio.vue'
  import BulmaSettingsMenu from '../components/BulmaSettingsMenu.vue'
  import TokenStorage from '../lib/TokenStorage'
  import { required, email, minValue,maxValue,minLength,maxLength,helpers,requiredIf,sameAs } from 'vuelidate/lib/validators'

  Vue.use(Vuelidate)

  export default{
    name: "MailSettings",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{BulmaButton,BulmaInput,BulmaCheckbox,BulmaSettingsMenu},
    data(){
      return  {
          settings:{
            mail_server:"",
            mail_port:"",
            mail_username:"",
            mail_password:"",
            mail_secure:true,
            mail_from:"",
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
          }),function(err){
            ref.$toast.error(err.toString());
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
            }),function(err){
              ref.$toast.error(err.toString());
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
            }),function(err){
              ref.$toast.error(err.toString());
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
