<template>
  <section v-if="isAdmin" class="section">
    <BulmaModal v-if="showDelete && credential.name" title="Delete" action="Delete" @click="deleteCredential();showDelete=false" @close="showDelete=false" @cancel="showDelete=false">Are you sure you want to delete Credential '{{ credential.name}}'</BulmaModal>
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="lock" /> Credentials</h1>
      <nav class="level">
        <!-- Left side -->
        <div class="level-left">
          <p class="level-item"><BulmaButton icon="plus" label="New Credential" @click="credentialItem=-1;loadCredential()"></BulmaButton></p>
        </div>
      </nav>
      <div class="columns">
        <div class="column" v-if="credentialList && credentialList.length>0">
          <BulmaAdminTable
            :dataList="credentialList"
            :labels="['Name','User','Host']"
            :columns="['name','user','host']"
            :filters="['name','user','host']"
            identifier="id"
            :actions="[{name:'select',title:'edit credential',icon:'pencil-alt',color:'has-text-warning'},{name:'delete',title:'delete credential',icon:'times',color:'has-text-danger'}]"
            :currentItem="credentialItem"
            @select="selectItem"
            @reset="resetItem"
            @delete="deleteItem"
          />
        </div>
        <transition name="add-column" appear>
          <div class="column" v-if="credentialItem!==undefined && !showDelete">
            <BulmaInput icon="heading" v-model="credential.name" label="Name" placeholder="Name" :readonly="credentialItem!==-1" :required="true" :hasError="$v.credential.name.$invalid" :errors="[]" />
            <BulmaInput icon="user" v-model="credential.user" label="Username" placeholder="Username" :required="true" :hasError="$v.credential.user.$invalid" :errors="[]" />
            <BulmaInput icon="lock" v-model="credential.password" type="password" label="Password" placeholder="Password" :required="true" :hasError="$v.credential.password.$invalid" :errors="[]" />
            <BulmaInput icon="server" v-model="credential.host" label="Host" placeholder="Host" :required="true" :hasError="$v.credential.host.$invalid" :errors="[]" />
            <BulmaInput icon="door-closed" v-model="credential.port" label="Port" placeholder="3306" :required="true" :hasError="$v.credential.port.$invalid" :errors="[]" />
            <BulmaInput icon="info-circle" v-model="credential.description" label="Description" placeholder="Description" :required="true" :hasError="$v.credential.description.$invalid" :errors="[]" />
            <BulmaCheckbox checktype="checkbox" v-model="credential.secure" label="Secure connection" /><br><br>
            <BulmaButton v-if="credentialItem==-1" icon="save" label="Create Credential" @click="newCredential()"></BulmaButton>
            <BulmaButton v-if="credentialItem!=-1" icon="save" label="Update Credential" @click="updateCredential()"></BulmaButton>
          </div>
        </transition>
      </div>

    </div>
  </section>
</template>
<script>
  import Vue from 'vue'
  import axios from 'axios'
  import Vuelidate from 'vuelidate'
  import BulmaButton from './../components/BulmaButton.vue'
  import BulmaAdminTable from './../components/BulmaAdminTable.vue'
  import BulmaInput from './../components/BulmaInput.vue'
  import BulmaModal from './../components/BulmaModal.vue'
  import BulmaCheckbox from './../components/BulmaCheckRadio.vue'
  import TokenStorage from './../lib/TokenStorage'
  import { required, email, minValue,maxValue,minLength,maxLength,helpers,requiredIf,sameAs,numeric } from 'vuelidate/lib/validators'

  Vue.use(Vuelidate)
  export default{
    name:"Credentials",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{BulmaButton,BulmaInput,BulmaModal,BulmaAdminTable,BulmaCheckbox},
    data(){
      return  {
          credential:{
            name:"",
            user:"",
            password:"",
            host:"",
            port:3306,
            description:"",
            secure:false
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
      },
      selectItem(value){
        this.credentialItem=value
        this.loadCredential()
      },
      resetItem(){
        this.credentialItem=undefined
      },
      deleteItem(value){
        this.selectItem(value)
        this.showDelete=true
      },
      loadCredential(){
        var ref= this;
        if(this.credentialItem!=undefined && this.credentialItem!=-1){

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
  .table td,.table th{
    max-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  table thead th.is-first,table tbody td.is-first{
    width:8em!important;
    max-width:8em!important;
  }
  .add-column-enter-to, .add-column-leave {
    opacity: 1;
  }
  .add-column-enter, .add-column-leave-to {
    overflow: hidden;
    opacity: 0;
  }
  .add-column-enter-active > div {
    transition: all 0.5s;
  }
  .add-column-enter-active {
    overflow: hidden;
    transition: all 0.5s;
  }
  .add-column-leave-active {
    overflow: hidden;
    transition: all 0.5s;
  }
  .add-column-leave-active > div {
    transition: all 0.5s;
  }
  .add-column-leave-to > div {
    width: 0;
  }
</style>
