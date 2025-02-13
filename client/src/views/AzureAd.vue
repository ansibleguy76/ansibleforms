<template>
  <section v-if="profile?.options?.showSettings ?? isAdmin" class="section">
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="address-card" /> MS Entra ID</h1>
      <div class="columns">
        <div class="column is-narrow">
          <BulmaSettingsMenu />
        </div>
        <div class="column">          
          <nav class="level">
            <!-- Left side -->
            <div class="level-left">
              <p class="level-item"><BulmaButton icon="save" label="Update" @click="updateAzureAd()"></BulmaButton></p>
            </div>
          </nav>      
          <div class="columns">
            <div class="column">
              <BulmaCheckbox checktype="checkbox" v-model="azuread.enable" label="Enable MS Entra ID" />
              <div class="mt-2">
                <BulmaInput :disabled="!azuread.enable" icon="user-tag" v-model="azuread.client_id" label="Client Id" placeholder="" :required="true" :hasError="v$.azuread.client_id.$invalid" :errors="[]" />
                <BulmaInput :disabled="!azuread.enable" icon="user-secret" v-model="azuread.secret_id" type="password" label="Secret Id" placeholder="" :required="true" :hasError="v$.azuread.secret_id.$invalid" :errors="[]" />
                <BulmaInput :disabled="!azuread.enable" icon="filter" v-model="azuread.groupfilter" label="Groupname Regex" placeholder="A regular expression to match groups" :required="false" :errors="[]" />
                <div class="notification is-info-light content">
                  <strong>Required API Permissions</strong><br>
                  <ul>
                    <li>Delegated User.Read</li>
                    <li>Delegated GroupMember.Read.All</li>
                  </ul>
                  <strong>Required Group Claims</strong>
                  <ul>
                    <li>Security Groups</li>
                    <li>Access > samAccountName</li>
                  </ul>
                  <p><strong>Callback Url </strong>: {{ callbackUrl }} <span v-if="!settings.url" class="tag is-danger"><font-awesome-icon icon="circle-exclamation" class="mr-1" /> You have not set the Ansible Form Url (see: 'General > Ansible Forms' settings page)</span></p>
                </div>
                <!-- <BulmaButton :disabled="!azuread.enable" icon="check" label="Test AzureAd" @click="testAzureAd()"></BulmaButton> -->
                
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
<script>

  import axios from 'axios'
  import BulmaButton from '../components/BulmaButton.vue'
  import BulmaInput from '../components/BulmaInput.vue'
  import BulmaCheckbox from '../components/BulmaCheckRadio.vue'
  import TokenStorage from '../lib/TokenStorage'
  import BulmaSettingsMenu from '../components/BulmaSettingsMenu.vue'
  import { useVuelidate } from '@vuelidate/core'
  import { requiredIf } from '@vuelidate/validators'

  export default{
    name: "AfAzureAd",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean},
      profile:{type:Object}
    },
    components:{BulmaButton,BulmaInput,BulmaCheckbox,BulmaSettingsMenu},
    setup(){
      return { v$: useVuelidate() }
    },
    data(){
      return  {
          azuread:{
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
        return `${this.settings.url || "https://**************"}${process.env.BASE_URL}api/v1/auth/azureadoauth2/callback`
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
      loadAzureAd(){
        var ref= this;
        axios.get(`${process.env.BASE_URL}api/v1/azuread/`,TokenStorage.getAuthentication())
          .then((result)=>{
            ref.azuread=result.data.data.output;
          }),function(err){
            ref.$toast.error(err.toString());
          };
      },updateAzureAd(){
        var ref= this;
        if (!this.v$.azuread.$invalid) {
          axios.put(`${process.env.BASE_URL}api/v1/azuread/`,this.azuread,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                ref.$toast.success("AzureAd is updated");
                ref.loadAzureAd();
              }
            }),function(err){
              ref.$toast.error(err.toString());
            };
        }else{
          this.$toast.warning("Invalid form data")
        }
      },
      testAzureAd(){
        var ref= this;
        axios.post(`${process.env.BASE_URL}api/v1/azuread/check/`,this.azuread,TokenStorage.getAuthentication())
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
      azuread:{
        client_id: {
          required:requiredIf(function(){
            return !!this.azuread.enable
          })
        },
        secret_id:{
          required:requiredIf(function(){
            return !!this.azuread.enable
          })
        }

      }

    },
    mounted() { // when the Vue app is booted up, this is run automatically.
        this.loadAzureAd();
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
