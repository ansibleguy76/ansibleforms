<template>
  <section v-if="isAdmin" class="section">
    <BulmaModal v-if="showDelete && credential.name" title="Delete" action="Delete" @click="deleteCredential();showDelete=false" @close="showDelete=false" @cancel="showDelete=false">Are you sure you want to delete Credential '{{ credential.name}}'</BulmaModal>
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="lock" /> Credentials</h1>
      <div class="columns">
        <div class="column is-narrow">
          <BulmaSettingsMenu />
        </div>
        <div class="column">         
          <nav class="level">
            <!-- Left side -->
            <div class="level-left">
              <p class="level-item"><BulmaButton icon="plus" label="New Credential" @click="credentialItem=-1;loadCredential()"></BulmaButton></p>
            </div>
          </nav>
          <div class="columns">
            <div class="column" v-if="credentialList && credentialList.length>0">
              <BulmaAdminTable
                :dataList="credentialList.map(x => ({...x,allowtest:(x.is_database )}))"
                :labels="['Name','User','Host']"
                :columns="['name','user','host']"
                :filters="['name','user','host']"
                identifier="id"
                :actions="[{name:'select',title:'edit credential',icon:'pencil-alt',color:'has-text-warning'},{name:'delete',title:'delete credential',icon:'times',color:'has-text-danger'},{name:'test',title:'test credential',icon:'database',color:'has-text-info'}]"
                :currentItem="credentialItem"
                @select="selectItem"
                @reset="resetItem"
                @delete="deleteItem"
                @test="testItem"
              />
            </div>
            <transition name="add-column" appear>
              <div class="column" v-if="credentialItem!==undefined && !showDelete">
                <BulmaCheckbox checktype="checkbox" v-model="credential.is_database" label="For database ?" /><br><br>
                <BulmaInput icon="heading" v-model="credential.name" label="Name" placeholder="Name" :readonly="credentialItem!==-1" :required="true" :hasError="$v.credential.name.$invalid" :errors="[]" />
                <BulmaInput icon="user" v-model="credential.user" label="Username" placeholder="Username" :required="true" :hasError="$v.credential.user.$invalid" :errors="[]" />
                <BulmaInput icon="lock" v-model="credential.password" type="password" label="Password" placeholder="Password" :required="true" :hasError="$v.credential.password.$invalid" :errors="[]" />
                <BulmaInput icon="server" v-model="credential.host" label="Host" placeholder="Host" :required="!!credential.is_database" :hasError="$v.credential.host.$invalid" :errors="[]" />
                <BulmaInput icon="door-closed" v-model="credential.port" label="Port" placeholder="3306" :required="!!credential.is_database" :hasError="$v.credential.port.$invalid" :errors="[]" />
                <BulmaInput icon="info-circle" v-model="credential.description" label="Description" placeholder="Description" />
                <BulmaInput v-if="!!credential.is_database" icon="database" v-model="credential.db_name" label="Database" placeholder="Database" />
                <BulmaSelect v-if="!!credential.is_database" icon="database" v-model="credential.db_type" label="Database type" :list="['mysql','mssql','postgres','mongodb']"  />
                <BulmaCheckbox v-if="!!credential.is_database" checktype="checkbox" v-model="credential.secure" label="Secure connection" /><br><br>
                <BulmaButton v-if="credentialItem==-1" icon="save" label="Create Credential" @click="newCredential()"></BulmaButton>
                <BulmaButton v-if="credentialItem!=-1" icon="save" label="Update Credential" @click="updateCredential()"></BulmaButton>
              </div>
            </transition>
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
  import BulmaButton from './../components/BulmaButton.vue'
  import BulmaAdminTable from './../components/BulmaAdminTable.vue'
  import BulmaInput from './../components/BulmaInput.vue'
  import BulmaModal from './../components/BulmaModal.vue'
  import BulmaCheckbox from './../components/BulmaCheckRadio.vue'
  import BulmaSettingsMenu from '../components/BulmaSettingsMenu.vue'
  import BulmaSelect from './../components/BulmaSelect.vue'
  import TokenStorage from './../lib/TokenStorage'
  import { required, email, minValue,maxValue,minLength,maxLength,helpers,requiredIf,sameAs,numeric } from 'vuelidate/lib/validators'

  Vue.use(Vuelidate)
  export default{
    name:"AfCredentials",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{BulmaButton,BulmaInput,BulmaModal,BulmaAdminTable,BulmaCheckbox,BulmaSelect,BulmaSettingsMenu},
    data(){
      return  {
          credential:{
            is_database:false,
            name:"",
            user:"",
            password:"",
            host:"NA",
            port:3306,
            db_name:"",
            description:"",
            secure:false,
            db_type:""
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
        axios.get(`${process.env.BASE_URL}api/v1/credential/`,TokenStorage.getAuthentication())
          .then((result)=>{
            ref.credentialList=result.data.data.output;
          }),function(err){
            ref.$toast.error(err.toString());
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
      testItem(value){
        var ref= this;
        if(value){
          axios.get(`${process.env.BASE_URL}api/v1/credential/testdb/` + value,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=='success'){
                ref.$toast.success(result.data.message)
              }else{
                ref.$toast.error(result.data.message + "\r\n" + result.data.data.error)
              }
            }),function(err){
              ref.$toast.error(err.toString());
            };
        }
      },
      loadCredential(){
        var ref= this;
        if(this.credentialItem!=undefined && this.credentialItem!=-1){

          axios.get(`${process.env.BASE_URL}api/v1/credential/${this.credentialItem}`,TokenStorage.getAuthentication())
            .then((result)=>{
              console.log("loaded credential item");
              ref.credential=result.data.data.output
            }),function(err){
              ref.$toast.error(err.toString());
            };
        }else{
          console.log("No item selected")
          this.credential = {
            name:""
          }
        }
      },
      deleteCredential(){
        var ref= this;
        axios.delete(`${process.env.BASE_URL}api/v1/credential/${this.credentialItem}`,TokenStorage.getAuthentication())
          .then((result)=>{
            if(result.data.status=="error"){
              ref.$toast.error(result.data.message + ", " + result.data.data.error);
            }else{
              ref.$toast.success("Credential is removed");
              ref.credentialItem=undefined;
              ref.loadAll();
            }
          }),function(err){
            ref.$toast.error(err.toString());
          };
      },updateCredential(){
        var ref= this;
        if (!this.$v.credential.$invalid) {
          axios.put(`${process.env.BASE_URL}api/v1/credential/${this.credentialItem}`,this.credential,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                ref.$toast.success("Credential is updated");
                ref.loadAll();
              }
            }),function(err){
              ref.$toast.error(err.toString());
            };
        }else{
          this.$toast.warning("Invalid form data")
        }
      },newCredential(){
        var ref= this;
        if (!this.$v.credential.$invalid) {
          axios.post(`${process.env.BASE_URL}api/v1/credential/`,this.credential,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                Vue.set(ref,"credentialItem",result.data.data.output)
                ref.$toast.success("Created credential with new id " + result.data.data.output);
                ref.loadAll();
              }
            }),function(err){
              ref.$toast.error(err.toString());
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
          database_required: function(value){return (helpers.req(value) && !!this.credential?.is_database) || !(this.credential?.is_database)}
        },
        port: {
          database_required: function(value){return (helpers.req(value) && !!this.credential?.is_database) || !(this.credential?.is_database)},
          numeric
        }
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
