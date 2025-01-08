<template>
  <section v-if="profile?.options?.showSettings ?? isAdmin" class="section">
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="id-card" /> Awx</h1>
      <div class="columns">
        <div class="column is-narrow">
          <BulmaSettingsMenu />
        </div>
        <div class="column">      
          <nav class="level">
            <!-- Left side -->
            <div class="level-left">
              <p class="level-item"><BulmaButton icon="save" label="Update Awx" @click="updateAwx()"></BulmaButton></p>
              <p class="level-item"><BulmaButton icon="check" label="Test Awx" @click="testAwx()"></BulmaButton></p>
            </div>
          </nav>         
          <div class="columns">
            <div class="column">
              <BulmaCheckbox checktype="checkbox" v-model="awx.use_credentials" label="Use Credentials" />
              <BulmaInput icon="globe" v-model="awx.uri" label="Uri" placeholder="https://awx.domain.local" :required="true" :hasError="v$.awx.uri.$invalid" :errors="[]" />
              <BulmaInput icon="user" v-if="awx.use_credentials" v-model="awx.username" label="Username" placeholder="Username" :required="true" :hasError="v$.awx.username.$invalid" :errors="[]" />
              <BulmaInput icon="lock" v-if="!awx.use_credentials" type="password" v-model="awx.token" label="Token" :required="true" :hasError="v$.awx.token.$invalid" :errors="[]" />
              <BulmaInput icon="lock" v-if="awx.use_credentials" type="password" v-model="awx.password" label="Password" :required="true" :hasError="v$.awx.password.$invalid" :errors="[]" />
            </div>
            <div class="column">
              <BulmaCheckbox checktype="checkbox" v-model="awx.ignore_certs" label="Ignore Certificate Errors" />
              <BulmaTextArea v-if="!awx.ignore_certs" v-model="awx.ca_bundle" label="Ca Bundle" placeholder="-----BEGIN CERTIFICATE-----" :hasError="v$.awx.ca_bundle.$invalid" :errors="[]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
<script>

  import axios from 'axios'
  import { useVuelidate } from '@vuelidate/core'
  import BulmaButton from './../components/BulmaButton.vue'
  import BulmaInput from './../components/BulmaInput.vue'
  import BulmaCheckbox from './../components/BulmaCheckRadio.vue'
  import BulmaTextArea from './../components/BulmaTextArea.vue'
  import BulmaSettingsMenu from '../components/BulmaSettingsMenu.vue'
  import TokenStorage from './../lib/TokenStorage'
  import { required, requiredIf } from '@vuelidate/validators'

  export default{
    name: "AfAwx",
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
          awx:{
            uri:"",
            token:"",
            password:"",
            username:"",
            ignore_certs:true,
            use_credentials:false,
            ca_bundle:""
          }
        }
    },
    methods:{
      loadAwx(){
        var ref= this;
        axios.get(`${process.env.BASE_URL}api/v1/awx/`,TokenStorage.getAuthentication())
          .then((result)=>{
            ref.awx=result.data.data.output;
          }),function(err){
            ref.$toast.error(err.toString());
          };
      },updateAwx(){
        var ref= this;
        if (!this.v$.awx.$invalid) {
          axios.put(`${process.env.BASE_URL}api/v1/awx/`,this.awx,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                ref.$toast.success("Awx is updated");
                ref.loadAwx();
              }
            }),function(err){
              ref.$toast.error(err.toString());
            };
        }else{
          this.$toast.warning("Invalid form data")
        }
      },
      testAwx(){
        var ref= this;
        axios.post(`${process.env.BASE_URL}api/v1/awx/check/`,this.awx,TokenStorage.getAuthentication())
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
      awx:{
        uri: {
          required
        },
        token:{
          required:requiredIf(function(){
            return !this.awx.use_credentials
          })
        },  
        ca_bundle:{
          required:requiredIf(function(){
            return !this.awx.ignore_certs
          })
        },
        username:{
          required:requiredIf(function(){
            return !!this.awx.use_credentials
          })
        },
        password:{
          required:requiredIf(function(){
            return this.awx.use_credentials
          })
        }                     
      }
    },
    mounted() { // when the Vue app is booted up, this is run automatically.
        this.loadAwx();
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
