<template>
  <section v-if="isAdmin" class="section">
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="id-card" /> Ldap</h1>
      <div class="columns">
        <div class="column">
          <BulmaCheckbox checktype="checkbox" v-model="ldap.enable" label="Enable Ldap" /> <BulmaCheckbox v-if="ldap.enable" checktype="checkbox" v-model="ldap.enable_tls" label="Enable Tls" />
          <div v-if="ldap.enable">
            <BulmaInput icon="server" v-model="ldap.server" label="Server" placeholder="ldap.domain.local" :required="true" :hasError="$v.ldap.server.$invalid" :errors="[]" />
            <BulmaInput icon="arrows-alt-v" type="number" v-model="ldap.port" label="Port" placeholder="389" :required="true" :hasError="$v.ldap.port.$invalid" :errors="[]" />
            <BulmaInput icon="search" v-model="ldap.search_base" label="Search Base" placeholder="dc=domain,dc=local" :required="true" :hasError="$v.ldap.search_base.$invalid" :errors="[]" />
            <BulmaInput icon="user" v-model="ldap.bind_user_dn" label="Bind User distinguished name" placeholder="Bind User distinguished name" :required="true" :hasError="$v.ldap.bind_user_dn.$invalid" :errors="[]" />
            <BulmaInput icon="lock" v-model="ldap.bind_user_pw" type="password" label="Bind User Password" placeholder="" :required="true" :hasError="$v.ldap.bind_user_pw.$invalid" :errors="[]" />
            <BulmaInput icon="portrait" v-model="ldap.username_attribute" label="Username Attribute" placeholder="sAMAccountName" :required="true" :hasError="$v.ldap.username_attribute.$invalid" :errors="[]" />
            <BulmaButton icon="save" label="Update Ldap" @click="updateLdap()"></BulmaButton>
            <BulmaButton icon="check" label="Test Ldap" @click="testLdap()"></BulmaButton>
          </div>
        </div>
        <div v-if="ldap.enable_tls && ldap.enable" class="column">
          <BulmaCheckbox checktype="checkbox" v-model="ldap.ignore_certs" label="Ignore Certificate Errors" />
          <BulmaTextArea v-if="!ldap.ignore_certs" v-model="ldap.cert" label="Ldap Certificate" placeholder="-----BEGIN CERTIFICATE-----" :hasError="$v.ldap.cert.$invalid" :errors="[]" />
          <BulmaTextArea v-if="!ldap.ignore_certs" v-model="ldap.ca_bundle" label="Ca Bundle" placeholder="-----BEGIN CERTIFICATE-----" :hasError="$v.ldap.ca_bundle.$invalid" :errors="[]" />
        </div>
      </div>
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
  import BulmaTextArea from './../components/BulmaTextArea.vue'
  import TokenStorage from './../lib/TokenStorage'
  import { required, email, minValue,maxValue,minLength,maxLength,helpers,requiredIf,sameAs } from 'vuelidate/lib/validators'

  Vue.use(Vuelidate)

  export default{
    name: "Ldap",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{BulmaButton,BulmaInput,BulmaCheckbox,BulmaTextArea},
    data(){
      return  {
          ldap:{
            server:"",
            port:"",
            bind_user_pw:"",
            bind_user_dn:"",
            search_base:"",
            username_attribute:"",
            enable:true,
            enable_tls:true,
            ignore_certs:true,
            cert:"",
            ca_bundle:""
          }
        }
    },
    methods:{
      loadLdap(){
        var ref= this;
        axios.get('/api/v1/ldap/',TokenStorage.getAuthentication())
          .then((result)=>{
            ref.ldap=result.data.data.output;
          }),function(error){
            ref.$toast.error(error.message);
          };
      },updateLdap(){
        var ref= this;
        if (!this.$v.ldap.$invalid) {
          axios.put('/api/v1/ldap/',this.ldap,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                ref.$toast.success("Ldap is updated");
                ref.loadLdap();
              }
            }),function(error){
              ref.$toast.error(error.message);
            };
        }else{
          this.$toast.warning("Invalid form data")
        }
      },
      testLdap(){
        var ref= this;
        axios.post('/api/v1/ldap/check/',this.ldap,TokenStorage.getAuthentication())
          .then((result)=>{
            if(result.data.status=="error"){
              ref.$toast.error(result.data.message + ", " + result.data.data.error);
            }else{
              ref.$toast.success(result.data.message);
            }
          }),function(error){
            ref.$toast.error(error.message);
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
        cert:{
          requiredIf:requiredIf(function(ldap){
            return ldap.enable_tls && !ldap.ignore_certs
          })
        },
        ca_bundle:{
          requiredIf:requiredIf(function(ldap){
            return ldap.enable_tls && !ldap.ignore_certs
          })
        }

      }

    },
    mounted() { // when the Vue app is booted up, this is run automatically.
      if(!this.isAdmin){
        this.$toast.error("You are not an admin user")
      }else{
        this.loadLdap();
      }
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
