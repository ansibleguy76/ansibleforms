<template>
  <section v-if="isAdmin" class="section">
    <BulmaModal v-if="showDelete && user.username" title="Delete" action="Delete" @click="deleteUser();showDelete=false" @close="showDelete=false" @cancel="showDelete=false">Are you sure you want to delete User '{{ user.username}}'</BulmaModal>
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="user" /> Users</h1>
      <nav class="level">
        <!-- Left side -->
        <div class="level-left">
          <p class="level-item"><BulmaButton icon="plus" label="New User" @click="userItem=-1;changePassword=false;loadUser()"></BulmaButton></p>
        </div>
      </nav>
      <div class="columns">
        <div class="column">
          <table class="table is-bordered is-striped is-fullwidth">
            <thead class="has-background-primary">
              <tr>
                <th class="has-text-white is-first">Actions</th>
                <th class="has-text-white">Name</th>
                <th class="has-text-white">Group</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in userList" :key="user.username + '_' + user.group_id" :class="{'has-background-link-light':user.id==userItem}">
                <td class="is-first">
                  <span class="icon is-clickable has-text-warning" v-if="user.id!=1" title="edit user" @click="userItem=user.id;changePassword=false;loadUser()"><font-awesome-icon icon="pencil-alt" /></span>
                  <span class="icon has-text-grey-lighter" v-else><font-awesome-icon icon="pencil-alt" /></span>
                  <span class="icon is-clickable has-text-link" title="change password" @click="userItem=user.id;changePassword=true;loadUser()"><font-awesome-icon icon="lock" /></span>
                  <span class="icon is-clickable has-text-danger" v-if="user.id!=1" title="delete user" @click="userItem=user.id;loadUser();showDelete=true"><font-awesome-icon icon="times" /></span>
                  <span class="icon has-text-grey-lighter" v-else><font-awesome-icon icon="times" /></span>
                </td>
                <td class="is-clickable" @click="userItem=user.id;loadUser()">{{ user.username }}</td>
                <td class="is-clickable" @click="userItem=user.id;loadUser()">{{ groupName(user.group_id)}}</td>
              </tr>
            </tbody>
          </table>
            <!-- <BulmaSelect icon="user" label="Select a user" :list="userList" valuecol="id" labelcol="username" @change="loadUser()" v-model="userItem" /> -->
        </div>
        <transition name="add-column" appear>
          <div class="column" v-if="userItem!==undefined && !showDelete">
            <template v-if="!changePassword">
              <BulmaInput icon="user" v-model="user.username" label="Username" :readonly="userItem!==-1" placeholder="Username" :required="true" :hasError="$v.user.username.$invalid" :errors="[]" />
              <BulmaInput v-if="userItem==-1" icon="lock" type="password" v-model="user.password" label="Password" placeholder="Password" :required="true" :hasError="$v.user.password.$invalid" :errors="[{if:!$v.user.password.regex,label:$v.user.password.$params.regex.description}]" />
              <BulmaInput v-if="userItem==-1" icon="lock" type="password" v-model="user.password2" label="Password Again" placeholder="Password" :required="true" :hasError="$v.user.password2.$invalid" :errors="[{if:!$v.user.password2.sameAsPassword,label:'Passwords are not the same'}]" />
              <BulmaSelect icon="users" label="Select a group" :list="groupList" valuecol="id" :required="true" :hasError="$v.user.group_id.$invalid" labelcol="name" v-model="user.group_id" :errors="[]" />
              <BulmaButton v-if="userItem==-1" icon="save" label="Create User" @click="newUser()"></BulmaButton>
              <BulmaButton v-if="userItem!=-1" icon="save" label="Update User" @click="updateUser(false)"></BulmaButton>
            </template>
            <template v-if="changePassword">
              <h2 class="subtitle"><font-awesome-icon icon="user" /> {{ user.username }}</h2>
              <div v-if="!passwordChanged">
                <BulmaInput icon="lock" type="password" v-model="user.password" label="Password" placeholder="Password" :required="true" :hasError="$v.user.password.$invalid" :errors="[{if:!$v.user.password.regex,label:$v.user.password.$params.regex.description}]" />
                <BulmaInput icon="lock" type="password" v-model="user.password2" label="Password Again" placeholder="Password" :required="true" :hasError="$v.user.password2.$invalid" :errors="[{if:!$v.user.password2.sameAsPassword,label:'Passwords are not the same'}]" />
                <BulmaButton icon="save" label="Change password" @click="updateUser(true)"></BulmaButton>
              </div>
              <div v-else class="notification is-primary is-light">
                Password is changed.
              </div>
            </template>
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
  import BulmaSelect from './../components/BulmaSelect.vue'
  import BulmaInput from './../components/BulmaInput.vue'
  import BulmaModal from './../components/BulmaModal.vue'
  import TokenStorage from './../lib/TokenStorage'
  import { required, email, minValue,maxValue,minLength,maxLength,helpers,requiredIf,sameAs } from 'vuelidate/lib/validators'

  Vue.use(Vuelidate)

  export default{
    name: "Users",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
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
          changePassword:false,
          passwordChanged:false,
          userItem:undefined,
          userList:[],
          groupList:[],
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
            ref.$toast.error(error.message);
          };
      },loadGroupList(){
        var ref= this;
        axios.get('/api/v1/group/',TokenStorage.getAuthentication())
          .then((result)=>{
            ref.groupList=result.data.data.output;
          }),function(error){
            ref.$toast.error(error.message);
          };
      }
      ,groupName(id){
        return (this.groupList.filter(x => x.id==id))[0].name
      }
      ,resetUser(){
        this.user = {
          username:"",
          password:"",
          password2:"",
          group_id:undefined
        }
      }
      ,loadUser(){
        var ref= this;
        this.resetUser();
        if(this.userItem!=undefined && this.userItem!=-1){
          axios.get('/api/v1/user/' + this.userItem,TokenStorage.getAuthentication())
            .then((result)=>{
              console.log("loaded user item");
              ref.user=result.data.data.output
              ref.user.password=""
            }),function(error){
              ref.$toast.error(error.message);
            };
        }else{
          this.resetUser()
        }
      },deleteUser(){
        var ref= this;
        axios.delete('/api/v1/user/'+this.userItem,TokenStorage.getAuthentication())
          .then((result)=>{
            if(result.data.status=="error"){
              ref.$toast.error(result.data.message + ", " + result.data.data.error);
            }else{
              ref.$toast.success("User is removed");
              ref.userItem=undefined;
              ref.loadAll();
            }
          }),function(error){
            ref.$toast.error(error.message);
          };
      },updateUser(changePassword=false){
        var ref= this;
        if ((!this.$v.user.group_id.$invalid && !changePassword)||(!this.$v.user.password.$invalid && !this.$v.user.password2.$invalid && changePassword)) {
          axios.put('/api/v1/user/'+this.userItem,this.user,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{

                if(changePassword){
                  ref.$toast.success("Password is changed");
                  ref.passwordChanged=true
                  setTimeout(() => ref.passwordChanged=false, 4000);
                }else{
                  ref.$toast.success("User is updated");
                }
                ref.loadAll();
              }
            }),function(error){
              ref.$toast.error(error.message);
            };
        }else{
          this.$toast.warning("Invalid form data")
        }
      },newUser(){
        var ref= this;
        if (!this.$v.user.$invalid) {
          axios.post('/api/v1/user/',this.user,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                Vue.set(ref,"userItem",result.data.data.output)
                ref.$toast.success("Created user with new id " + result.data.data.output);
                ref.loadAll();
              }
            }),function(error){
              ref.$toast.error(error.message);
            };
        }
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
