<template>
  <section v-if="isAdmin" class="section">
    <BulmaModal v-if="showDelete" title="Comfirm" action="Delete" @click="deleteCredential();showDelete=false" @close="showDelete=false" @cancel="showDelete=false">Are you sure you want to delete Credential '{{ credential.name}}'</BulmaModal>
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="users" /> Credentials</h1>
      <div class="columns">
        <div class="column">
            <BulmaSelect icon="lock" label="Select a credential" size="10" :list="credentialList" valuecol="id" labelcol="name" @change="loadCredential()" v-model="credentialItem" />
            <BulmaButton v-if="credentialItem!=undefined" icon="plus" label="New Credential" @click="credentialItem=undefined;loadCredential()"></BulmaButton>
            <BulmaButton v-if="credentialItem!=undefined" type="is-danger" icon="trash-alt" label="Delete Credential" @click="showDelete=true"></BulmaButton>
        </div>
        <div class="column is-three-quarters">
          <BulmaInput icon="heading" v-model="credential.name" label="Name" placeholder="Name" :readonly="credentialItem!==undefined" :required="true" :hasError="$v.credential.name.$invalid" :errors="[]" />
          <BulmaInput icon="user" v-model="credential.user" label="Username" placeholder="Username" :required="true" :hasError="$v.credential.user.$invalid" :errors="[]" />
          <BulmaInput icon="lock" v-model="credential.password" type="password" label="Password" placeholder="Password" :required="true" :hasError="$v.credential.password.$invalid" :errors="[]" />
          <BulmaInput icon="server" v-model="credential.host" label="Host" placeholder="Host" :required="true" :hasError="$v.credential.host.$invalid" :errors="[]" />
          <BulmaInput icon="door-closed" v-model="credential.port" label="Port" placeholder="3306" :required="true" :hasError="$v.credential.port.$invalid" :errors="[]" />
          <BulmaInput icon="info-circle" v-model="credential.description" label="Description" placeholder="Description" :required="true" :hasError="$v.credential.description.$invalid" :errors="[]" />
          <BulmaButton v-if="credentialItem==undefined" icon="save" label="Create Credential" @click="newCredential()"></BulmaButton>
          <BulmaButton v-if="credentialItem!=undefined" icon="save" label="Update Credential" @click="updateCredential()"></BulmaButton>
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
  import BulmaSelect from './../components/BulmaSelect.vue'
  import BulmaInput from './../components/BulmaInput.vue'
  import BulmaModal from './../components/BulmaModal.vue'
  import TokenStorage from './../lib/TokenStorage'
  import { required, email, minValue,maxValue,minLength,maxLength,helpers,requiredIf,sameAs,numeric } from 'vuelidate/lib/validators'

  Vue.use(Vuelidate)
  export default{
    name:"Credentials",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{BulmaButton,BulmaSelect,BulmaInput,BulmaModal},
    data(){
      return  {
          credential:{
            name:"",
            user:"",
            password:"",
            host:"",
            port:3306,
            description:""
          },
          showDelete:false,
          credentialItem:undefined,
          credentialList:[],
          alert:{
            timeout:undefined,
            message:"",
            type:""
          }
        }
    },
    methods:{
      loadAll(){
        this.loadCredentialList();
        this.loadCredential();
      },loadCredentialList(){
        var ref= this;
        axios.get('/api/v1/credential/',TokenStorage.getAuthentication())
          .then((result)=>{
            ref.credentialList=result.data.data.output;
          }),function(error){
            ref.$toast.error(error.message);
          };
      },loadCredential(){
        var ref= this;
        if(this.credentialItem!=undefined){

          axios.get('/api/v1/credential/' + this.credentialItem,TokenStorage.getAuthentication())
            .then((result)=>{
              console.log("loaded credential item");
              ref.credential=result.data.data.output
            }),function(error){
              ref.$toast.error(error.message);
            };
        }else{
          console.log("No item selected")
          this.credential = {
            name:""
          }
        }
      },deleteCredential(){
        var ref= this;
        axios.delete('/api/v1/credential/'+this.credentialItem,TokenStorage.getAuthentication())
          .then((result)=>{
            if(result.data.status=="error"){
              ref.$toast.error(result.data.message + ", " + result.data.data.error);
            }else{
              ref.$toast.success("Credential is removed");
              ref.credentialItem=undefined;
              ref.loadAll();
            }
          }),function(error){
            ref.$toast.error(error.message);
          };
      },updateCredential(){
        var ref= this;
        if (!this.$v.credential.$invalid) {
          axios.put('/api/v1/credential/'+this.credentialItem,this.credential,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                ref.$toast.success("Credential is updated");
                ref.loadAll();
              }
            }),function(error){
              ref.$toast.error(error.message);
            };
        }else{
          this.$toast.warning("Invalid form data")
        }
      },newCredential(){
        var ref= this;
        if (!this.$v.credential.$invalid) {
          axios.post('/api/v1/credential/',this.credential,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                Vue.set(ref,"credentialItem",result.data.data.output)
                ref.$toast.success("Created credential with new id " + result.data.data.output);
                ref.loadAll();
              }
            }),function(error){
              ref.$toast.error(error.message);
            };
        }
      },showAlert(type,message){
          var ref=this;
          this.alert.message=message;
          if(type){
            this.alert.type=type
          }else{
            this.alert.type="is-info"
          }
          clearTimeout(this.alert.timeout)
          this.alert.timeout = setTimeout(function(){ref.alert.message=""}, 5000);
      }
    },
    validations: {
      credential:{
        name: {
          required
        },
        user: {
          required
        },
        password: {
          required
        },
        host: {
          required
        },
        port: {
          required,
          numeric
        },
        description: {
          required
        },
      }

    },
    mounted() { // when the Vue app is booted up, this is run automatically.
        this.loadAll();
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
