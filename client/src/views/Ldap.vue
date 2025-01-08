<template>
  <section v-if="profile?.options?.showSettings ?? isAdmin" class="section">
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="id-card" /> Ldap</h1>
      <div class="columns">
        <div class="column is-narrow">
          <BulmaSettingsMenu />
        </div>
        <div class="column">          
          <nav class="level">
            <!-- Left side -->
            <div class="level-left">
              <p class="level-item"><BulmaButton :disabled="!ldap.enable" icon="check" label="Test Ldap" @click="testLdap()"></BulmaButton></p>
              <p class="level-item"><BulmaButton icon="save" label="Update Ldap" @click="updateLdap()"></BulmaButton></p>
            </div>
          </nav>      
          <div class="columns">
            <div class="column">
              <BulmaCheckbox checktype="checkbox" v-model="ldap.enable" label="Enable Ldap" /> <BulmaCheckbox v-if="ldap.enable" checktype="checkbox" v-model="ldap.enable_tls" label="Enable Tls" /> <BulmaCheckbox v-if="ldap.enable" checktype="checkbox" v-model="ldap.is_advanced" label="Advanced settings" />
              <div>
                <BulmaInput :disabled="!ldap.enable" icon="server" v-model="ldap.server" label="Server" placeholder="ldap.domain.local" :required="true" :hasError="v$.ldap.server.$invalid" :errors="[]" />
                <BulmaInput :disabled="!ldap.enable" icon="arrows-alt-v" type="number" v-model="ldap.port" label="Port" placeholder="389" :required="true" :hasError="v$.ldap.port.$invalid" :errors="[]" />
                <BulmaInput :disabled="!ldap.enable" icon="search" v-model="ldap.search_base" label="Search Base" placeholder="dc=domain,dc=local" :required="true" :hasError="v$.ldap.search_base.$invalid" :errors="[]" />
                <BulmaInput :disabled="!ldap.enable" icon="user" v-model="ldap.bind_user_dn" label="Bind User distinguished name" placeholder="Bind User distinguished name" :required="true" :hasError="v$.ldap.bind_user_dn.$invalid" :errors="[]" />
                <BulmaInput :disabled="!ldap.enable" icon="lock" v-model="ldap.bind_user_pw" type="password" label="Bind User Password" placeholder="" :required="true" :hasError="v$.ldap.bind_user_pw.$invalid" :errors="[]" />
                <BulmaInput :disabled="!ldap.enable" icon="portrait" v-model="ldap.username_attribute" label="Username Attribute" placeholder="sAMAccountName" :required="true" :hasError="v$.ldap.username_attribute.$invalid" :errors="[]" />
                <BulmaInput :disabled="!ldap.enable" icon="users" v-model="ldap.groups_attribute" label="Groups Attribute" placeholder="memberOf" :required="true" :hasError="v$.ldap.groups_attribute.$invalid" :errors="[]" />
                <BulmaInput :disabled="!ldap.enable" icon="envelope" v-model="ldap.mail_attribute" label="Mail Attribute" placeholder="mail" :required="true" :hasError="v$.ldap.mail_attribute.$invalid" :errors="[]" />
                <BulmaInput v-show="ldap.is_advanced && ldap.enable" :disabled="!ldap.enable" icon="users-viewfinder" v-model="ldap.groups_search_base" label="Groups Search Base" placeholder="dc=domain,dc=local" />
                <BulmaInput v-show="ldap.is_advanced && ldap.enable" :disabled="!ldap.enable" icon="users-rectangle" v-model="ldap.group_class" label="Group Class" placeholder="groupOfNames" />
                <BulmaInput v-show="ldap.is_advanced && ldap.enable" :disabled="!ldap.enable" icon="users-line" v-model="ldap.group_member_attribute" label="Group Member Attribute" placeholder="memberUid" />
                <BulmaInput v-show="ldap.is_advanced && ldap.enable" :disabled="!ldap.enable" icon="user-group" v-model="ldap.group_member_user_attribute" label="Group Member User Attribute" placeholder="uid" />
              </div>
            </div>
            <div v-if="ldap.enable_tls && ldap.enable" class="column">
              <BulmaCheckbox checktype="checkbox" v-model="ldap.ignore_certs" label="Ignore Certificate Errors" />
              <BulmaTextArea v-if="!ldap.ignore_certs" v-model="ldap.cert" label="Ldap Certificate" placeholder="-----BEGIN CERTIFICATE-----" :hasError="v$.ldap.cert.$invalid" :errors="[]" />
              <BulmaTextArea v-if="!ldap.ignore_certs" v-model="ldap.ca_bundle" label="Ca Bundle" placeholder="-----BEGIN CERTIFICATE-----" :hasError="v$.ldap.ca_bundle.$invalid" :errors="[]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
<script>
  import axios from 'axios'
  import BulmaButton from './../components/BulmaButton.vue'
  import BulmaInput from './../components/BulmaInput.vue'
  import BulmaCheckbox from './../components/BulmaCheckRadio.vue'
  import BulmaTextArea from './../components/BulmaTextArea.vue'
  import BulmaSettingsMenu from '../components/BulmaSettingsMenu.vue'
  import TokenStorage from './../lib/TokenStorage'
  import { useVuelidate } from '@vuelidate/core'
  import { required, requiredIf } from '@vuelidate/validators'

  export default{
    name: "AfLdap",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean},
      profile:{type:Object}
    },
    components:{BulmaButton,BulmaInput,BulmaCheckbox,BulmaTextArea,BulmaSettingsMenu},
    setup(){
      return { v$: useVuelidate() }
    },
    data(){
      return  {
          ldap:{
            server:"",
            port:"",
            bind_user_pw:"",
            bind_user_dn:"",
            search_base:"",
            username_attribute:"",
            groups_attribute:"",
            enable:true,
            enable_tls:true,
            ignore_certs:true,
            groups_search_base: "",
            group_class: "",
            group_member_attribute: "",
            mail_attribute: "",
            group_member_user_attribute: "",         
            cert:"",
            ca_bundle:"",
            is_advanced:false
          }
        }
    },
    methods:{
      loadLdap(){
        var ref= this;
        axios.get(`${process.env.BASE_URL}api/v1/ldap/`,TokenStorage.getAuthentication())
          .then((result)=>{
            ref.ldap=result.data.data.output;
          }),function(err){
            ref.$toast.error(err.toString());
          };
      },updateLdap(){
        var ref= this;
        if (!this.v$.ldap.$invalid) {
          axios.put(`${process.env.BASE_URL}api/v1/ldap/`,this.ldap,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                ref.$toast.success("Ldap is updated");
                ref.loadLdap();
              }
            }),function(err){
              ref.$toast.error(err.toString());
            };
        }else{
          this.$toast.warning("Invalid form data")
        }
      },
      testLdap(){
        var ref= this;
        axios.post(`${process.env.BASE_URL}api/v1/ldap/check/`,this.ldap,TokenStorage.getAuthentication())
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
      ldap:{
        server: {
          required
        },
        port: {
          required
        },
        search_base:{
          required
        },
        bind_user_dn:{
          required
        },
        bind_user_pw:{
          required
        },
        username_attribute:{
          required
        },
        groups_attribute:{
          required
        },
        mail_attribute:{
          required
        },
        cert:{
          requiredIf:requiredIf(function(){
            return !!this.ldap.enable_tls && !this.ldap.ignore_certs
          })
        },
        ca_bundle:{
          requiredIf:requiredIf(function(){
            return !!this.ldap.enable_tls && !this.ldap.ignore_certs
          })
        }

      }

    },
    mounted() { // when the Vue app is booted up, this is run automatically.
        this.loadLdap();
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
