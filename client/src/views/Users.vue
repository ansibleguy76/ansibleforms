<template>
  <section class="section">
    <BulmaModal v-if="showDelete" title="Comfirm" action="Delete" @click="deleteUser();showDelete=false" @close="showDelete=false" @cancel="showDelete=false">Are you sure you want to delete User '{{ user.username}}'</BulmaModal>
    <div class="container">
      <h1 class="title has-text-info"><i class="fad fa-users"></i> Users</h1>
      <div class="columns" v-if="alert.message!=''">
        <div class="column is-full">
          <div class="notification" :class="alert.type">
            <button class="delete" @click="alert.message=''"></button>
            {{ alert.message }}
          </div>
        </div>
      </div>
      <div class="columns">
        <div class="column">
            <BulmaSelect icon="fa-building" label="Select a user" :list="userList" valuecol="id" labelcol="username" @change="loadUser()" v-model="userItem" />
            <BulmaButton v-if="userItem!=undefined" icon="fa-plus" label="New User" @click="userItem=undefined;loadUser()"></BulmaButton>
            <BulmaButton v-if="userItem!=undefined && userItem!=1" type="is-danger" icon="fa-trash-alt" label="Delete User" @click="showDelete=true"></BulmaButton>
        </div>
        <div class="column is-three-quarters">
          <BulmaInput icon="fa-user" v-model="user.username" label="Username" :readonly="userItem!==undefined" placeholder="Username" :required="true" :hasError="$v.user.username.$invalid" :errors="[]" />
          <BulmaInput icon="fa-lock" type="password" v-model="user.password" label="Password" placeholder="Password" :required="true" :hasError="$v.user.password.$invalid" :errors="[{if:!$v.user.password.regex,label:$v.user.password.$params.regex.description}]" />
          <BulmaInput icon="fa-lock" type="password" v-model="user.password2" label="Password Again" placeholder="Password" :required="true" :hasError="$v.user.password2.$invalid" :errors="[{if:!$v.user.password2.sameAsPassword,label:'Password are not the same'}]" />
          <BulmaSelect icon="fa-users" label="Select a group" :list="groupList" valuecol="id" :required="true" :hasError="$v.user.group_id.$invalid" labelcol="name" v-model="user.group_id" :errors="[]" />
          <BulmaButton v-if="userItem==undefined" icon="fa-save" label="Create User" @click="newUser()"></BulmaButton>
          <BulmaButton v-if="userItem!=undefined" icon="fa-save" label="Update User" @click="updateUser()"></BulmaButton>
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
  import { required, email, minValue,maxValue,minLength,maxLength,helpers,requiredIf,sameAs } from 'vuelidate/lib/validators'

  Vue.use(Vuelidate)
  export default{
    name: "Users",
    components:{BulmaButton,BulmaSelect,BulmaInput,BulmaModal},
    data(){
      return  {
          user:{
            username:"",
            password:"",
            password2:"",
            group_id:undefined
          },
          showDelete:false,
          userItem:undefined,
          userList:[],
          groupList:[],
          alert:{
            timeout:undefined,
            message:"",
            type:""
          }
        }
    },
    methods:{
      loadAll(){
        this.loadUserList();
        this.loadGroupList();
        this.loadUser();
      },loadUserList(){
        var ref= this;
        axios.get('/api/v1/user/',TokenStorage.getAuthentication())
          .then((result)=>{
            ref.userList=result.data.data.output;
          }),function(error){
            ref.showAlert("is-danger",error.message);
          };
      },loadGroupList(){
        var ref= this;
        axios.get('/api/v1/group/',TokenStorage.getAuthentication())
          .then((result)=>{
            ref.groupList=result.data.data.output;
          }),function(error){
            ref.showAlert("is-danger",error.message);
          };
      },loadUser(){
        var ref= this;
        if(this.userItem!=undefined){

          axios.get('/api/v1/user/' + this.userItem,TokenStorage.getAuthentication())
            .then((result)=>{
              console.log("loaded user item");
              ref.user=result.data.data.output
              ref.user.password=""
            }),function(error){
              ref.showAlert("is-danger",error.message);
            };
        }else{
          console.log("No item selected")
          this.user = {
            username:"",
            password:"",
            password2:"",
            group_id:undefined
          }
        }
      },deleteUser(){
        var ref= this;
        axios.delete('/api/v1/user/'+this.userItem,TokenStorage.getAuthentication())
          .then((result)=>{
            if(result.data.status=="error"){
              ref.showAlert("is-danger",result.data.message + ", " + result.data.data.error);
            }else{
              ref.showAlert("is-info","User is removed");
              ref.userItem=undefined;
              ref.loadAll();
            }
          }),function(error){
            ref.showAlert("is-danger",error.message);
          };
      },updateUser(){
        var ref= this;
        if (!this.$v.user.$invalid) {
          axios.put('/api/v1/user/'+this.userItem,this.user,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.showAlert("is-danger",result.data.message + ", " + result.data.data.error);
              }else{
                ref.showAlert("is-info","User is updated");
                ref.loadAll();
              }
            }),function(error){
              ref.showAlert("is-danger",error.message);
            };
        }
      },newUser(){
        var ref= this;
        if (!this.$v.user.$invalid) {
          axios.post('/api/v1/user/',this.user,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.showAlert("is-danger",result.data.message + ", " + result.data.data.error);
              }else{
                Vue.set(ref,"userItem",result.data.data.output)
                ref.showAlert("is-info","Created user with new id " + result.data.data.output);
                ref.loadAll();
              }
            }),function(error){
              ref.showAlert("is-danger",error.message);
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
      user:{
        username: {
          required
        },
        password: {
          required,
          minLength:8,
          regex : helpers.withParams(
              {description: "Must contain at least 1 numeric, 1 special, 1 upper and 1 lower character",type:"regex"},
              (value) => !helpers.req(value) || (new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])").test(value))
          )
        },
        group_id: {
          required
        },
        password2:{
          sameAsPassword: sameAs('password')
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
  .select, .select select{
    width:100%;
  }
</style>
