<template>
  <section v-if="isAdmin" class="section">
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="address-card" /> Open ID Connect</h1>
      <div class="columns">
        <div class="column is-narrow">
          <BulmaSettingsMenu />
        </div>
        <div class="column">          
          <nav class="level">
            <!-- Left side -->
            <div class="level-left">
              <p class="level-item"><BulmaButton icon="save" label="Update" @click="updateOidc()"></BulmaButton></p>
            </div>
          </nav>      
          <div class="columns">
            <div class="column">
              <BulmaCheckbox checktype="checkbox" v-model="oidc.enable" label="Enable OIDC" />
              <div class="mt-2">
                <BulmaInput :disabled="!oidc.enable" icon="id-card" v-model="oidc.issuer" label="Issuer URL" placeholder="" :required="true" :hasError="$v.oidc.issuer.$invalid" :errors="[]" />
                <BulmaInput :disabled="!oidc.enable" icon="user-tag" v-model="oidc.client_id" label="Client Id" placeholder="" :required="true" :hasError="$v.oidc.client_id.$invalid" :errors="[]" />
                <BulmaInput :disabled="!oidc.enable" icon="user-secret" v-model="oidc.secret_id" type="password" label="Secret Id" placeholder="" :required="true" :hasError="$v.oidc.secret_id.$invalid" :errors="[]" />
                <BulmaInput :disabled="!oidc.enable" icon="filter" v-model="oidc.groupfilter" label="Groupname Regex" placeholder="A regular expression to match groups" :required="false" :errors="[]" />
                <div class="notification is-info-light content">
                  <p><strong>Callback Url </strong>: {{ callbackUrl }} <span v-if="!settings.url" class="tag is-danger"><font-awesome-icon icon="circle-exclamation" class="mr-1" /> You have not set the Ansible Form Url (see: 'General > Ansible Forms' settings page)</span></p>
                </div>
                <!-- <BulmaButton :disabled="!oidc.enable" icon="check" label="Test OIDC" @click="testOidc()"></BulmaButton> -->
                
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
  import TokenStorage from '../lib/TokenStorage'
  import BulmaSettingsMenu from '../components/BulmaSettingsMenu.vue'
  import { requiredIf } from 'vuelidate/lib/validators'

  Vue.use(Vuelidate)

  export default{
    name: "AfOidc",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{BulmaButton,BulmaInput,BulmaCheckbox,BulmaSettingsMenu},
    data(){
      return  {
          oidc:{
            issuer: "",
            client_id:"",
            secret_id:"",
            enable:true,
            groupfilter:""
          },
          settings:{
            url:""
          }
        }
    },
    computed:{
      callbackUrl(){
        return `${this.settings.url || "https://**************"}${process.env.BASE_URL}api/v1/auth/oidc/callback`
      }
    },
    methods:{
      loadSettings(){
        var ref=this
        axios.get(`${process.env.BASE_URL}api/v1/settings/`,TokenStorage.getAuthentication())
          .then((result)=>{
            ref.settings=result.data.data.output;
          }),function(err){
            ref.$toast.error(err.toString());
          };        
      },
      loadOidc(){
        var ref= this;
        axios.get(`${process.env.BASE_URL}api/v1/oidc/`,TokenStorage.getAuthentication())
          .then((result)=>{
            ref.oidc=result.data.data.output;
          }),function(err){
            ref.$toast.error(err.toString());
          };
      },updateOidc(){
        var ref= this;
        if (!this.$v.oidc.$invalid) {
          axios.put(`${process.env.BASE_URL}api/v1/oidc/`,this.oidc,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                ref.$toast.success("OIDC is updated");
                ref.loadOidc();
              }
            }),function(err){
              ref.$toast.error(err.toString());
            };
        }else{
          this.$toast.warning("Invalid form data")
        }
      },
      testOidc(){
        var ref= this;
        axios.post(`${process.env.BASE_URL}api/v1/oidc/check/`,this.oidc,TokenStorage.getAuthentication())
          .then((result)=>{
            if(result.data.status=="error"){
              ref.$toast.error(result.data.message + ", " + result.data.data.error);
            }else{
              ref.$toast.success(result.data.message);
            }
          }),function(err){
            ref.$toast.error(err.toString());
          };
      }
    },
    validations: {
      oidc:{
        issuer: {
          required:requiredIf(function(oidc){
            return oidc.enable
          })
        },
        client_id: {
          required:requiredIf(function(oidc){
            return oidc.enable
          })
        },
        secret_id:{
          required:requiredIf(function(oidc){
            return oidc.enable
          })
        }

      }

    },
    mounted() { // when the Vue app is booted up, this is run automatically.
        this.loadOidc();
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
