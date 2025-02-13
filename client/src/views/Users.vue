<template>
  <section v-if="profile?.options?.showSettings ?? isAdmin" class="section">
    <BulmaModal v-if="showDelete && user.username" title="Delete" action="Delete" @click="deleteUser();showDelete=false" @close="showDelete=false" @cancel="showDelete=false">Are you sure you want to delete User '{{ user.username}}'</BulmaModal>
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="user" /> Users</h1>
      <div class="columns">
        <div class="column is-narrow">
          <BulmaSettingsMenu />
        </div>
        <div class="column">          
          <nav class="level">
            <!-- Left side -->
            <div class="level-left">
              <p class="level-item"><BulmaButton icon="plus" label="New User" @click="userItem=-1;changePassword=false;loadUser()"></BulmaButton></p>
            </div>
          </nav>
          <div class="columns">
            <div class="column" v-if="userList && userList.length>0 && groupList && groupList.length>0">
              <BulmaAdminTable
                :dataList="userList.map(x => ({...x,group:groupName(x.group_id)}))"
                :labels="['Name','Group']"
                :columns="['username','group']"
                :filters="['username','group']"
                identifier="id"
                :actions="[
                            {name:'select',title:'edit user',icon:'pencil-alt',color:'has-text-warning'},
                            {name:'delete',title:'delete user',icon:'times',color:'has-text-danger'},
                            {name:'changepassword',title:'change password',icon:'lock',color:'has-text-link'}
                        ]"
                :currentItem="userItem"
                @select="selectItem"
                @reset="resetItem"
                @delete="deleteItem"
                @changepassword="changepassword"
              />
            </div>
            <transition name="add-column" appear>
              <div class="column" v-if="userItem!==undefined && !showDelete">
                <template v-if="!changePassword">
                  <BulmaInput icon="user" v-model="user.username" label="Username" :readonly="userItem!==-1" placeholder="Username" :required="true" :hasError="v$.user.username.$invalid" :errors="[]" />
                  <BulmaInput icon="envelope" v-model="user.email" label="Email" :readonly="userItem!==-1" placeholder="Email" :hasError="v$.user.email.$invalid" :errors="[]" />
                  <BulmaInput v-if="userItem==-1" icon="lock" type="password" v-model="user.password" label="Password" placeholder="Password" :required="true" :hasError="v$.user.password.$invalid" :errors="[{if:v$.user.password.passwordComplexity.$invalid,label:v$.user.password.passwordComplexity.$params.description}]" />
                  <BulmaInput v-if="userItem==-1" icon="lock" type="password" v-model="user.password2" label="Password Again" placeholder="Password" :required="true" :hasError="v$.user.password2.$invalid" :errors="[{if:v$.user.password2.sameAsPassword.$invalid,label:'Passwords are not the same'}]" />
                  <BulmaSelect icon="users" label="Select a group" :list="groupList" valuecol="id" :required="true" :hasError="v$.user.group_id.$invalid" labelcol="name" v-model="user.group_id" :errors="[]" />
                  <BulmaButton v-if="userItem==-1" icon="save" label="Create User" @click="newUser()"></BulmaButton>
                  <BulmaButton v-if="userItem!=-1" icon="save" label="Update User" @click="updateUser(false)"></BulmaButton>
                </template>
                <template v-if="changePassword">
                  <h2 class="subtitle"><font-awesome-icon icon="user" /> {{ user.username }}</h2>
                  <div v-if="!passwordChanged">
                    <BulmaInput icon="lock" type="password" v-model="user.password" label="Password" placeholder="Password" :required="true" :hasError="v$.user.password.$invalid" :errors="[{if:v$.user.password.passwordComplexity.$invalid,label:v$.user.password.passwordComplexity.$params.description}]" />
                    <BulmaInput icon="lock" type="password" v-model="user.password2" label="Password Again" placeholder="Password" :required="true" :hasError="v$.user.password2.$invalid" :errors="[{if:v$.user.password2.sameAsPassword.$invalid,label:'Passwords are not the same'}]" />
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
      </div>
    </div>
  </section>
</template>
<script>
  import Vue from 'vue'
  import axios from 'axios'
  import BulmaButton from './../components/BulmaButton.vue'
  import BulmaSelect from './../components/BulmaSelect.vue'
  import BulmaInput from './../components/BulmaInput.vue'
  import BulmaAdminTable from './../components/BulmaAdminTable.vue'
  import BulmaModal from './../components/BulmaModal.vue'
  import BulmaSettingsMenu from '../components/BulmaSettingsMenu.vue'
  import TokenStorage from './../lib/TokenStorage'
  import { useVuelidate } from '@vuelidate/core'
  import { required, email, helpers,sameAs } from '@vuelidate/validators'

  export default{
    name: "AfUsers",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean},
      profile:{type:Object}
    },
    components:{BulmaButton,BulmaSelect,BulmaInput,BulmaModal,BulmaAdminTable,BulmaSettingsMenu},
    setup(){
      return { v$: useVuelidate() }
    },
    data(){
      return  {
          user:{
            username:"",
            password:"",
            password2:"",
            email:"",
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
        axios.get(`${process.env.BASE_URL}api/v1/user/`,TokenStorage.getAuthentication())
          .then((result)=>{
            ref.userList=result.data.data.output;
          }),function(err){
            ref.$toast.error(err.toString());
          };
      },
      selectItem(value){
        this.userItem=value
        this.changePassword=false;
        this.loadUser()
      },
      resetItem(){
        this.userItem=undefined
      },
      deleteItem(value){
        this.selectItem(value)
        this.showDelete=true
      },
      changepassword(value){
        this.userItem=value
        this.changePassword=true
        this.loadUser()
      },
      loadGroupList(){
        var ref= this;
        axios.get(`${process.env.BASE_URL}api/v1/group/`,TokenStorage.getAuthentication())
          .then((result)=>{
            ref.groupList=result.data.data.output;
          }),function(err){
            ref.$toast.error(err.toString());
          };
      }
      ,groupName(id){
        var groups=this.groupList.filter(x => x.id==id)
        if(groups.length>0)
          return groups[0].name
        else {
          return "..."
        }
      }
      ,resetUser(){
        this.user = {
          username:"",
          password:"",
          password2:"",
          email:"",
          group_id:undefined
        }
      }
      ,loadUser(){
        var ref= this;
        this.resetUser();
        if(this.userItem!=undefined && this.userItem!=-1){
          axios.get(`${process.env.BASE_URL}api/v1/user/${this.userItem}`,TokenStorage.getAuthentication())
            .then((result)=>{
              console.log("loaded user item");
              ref.user=result.data.data.output
              ref.user.password=""
            }),function(err){
              ref.$toast.error(err.toString());
            };
        }else{
          this.resetUser()
        }
      },deleteUser(){
        var ref= this;
        axios.delete(`${process.env.BASE_URL}api/v1/user/${this.userItem}`,TokenStorage.getAuthentication())
          .then((result)=>{
            if(result.data.status=="error"){
              ref.$toast.error(result.data.message + ", " + result.data.data.error);
            }else{
              ref.$toast.success("User is removed");
              ref.userItem=undefined;
              ref.loadAll();
            }
          }),function(err){
            ref.$toast.error(err.toString());
          };
      },updateUser(changePassword=false){
        var ref= this;
        if ((!this.v$.user.group_id.$invalid && !changePassword)||(!this.v$.user.password.$invalid && !this.v$.user.password2.$invalid && changePassword)) {
          axios.put(`${process.env.BASE_URL}api/v1/user/${this.userItem}`,this.user,TokenStorage.getAuthentication())
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
            }),function(err){
              ref.$toast.error(err.toString());
            };
        }else{
          this.$toast.warning("Invalid form data")
        }
      },newUser(){
        var ref= this;
        if (!this.v$.user.$invalid) {
          axios.post(`${process.env.BASE_URL}api/v1/user/`,this.user,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                Vue.set(ref,"userItem",result.data.data.output)
                ref.$toast.success("Created user with new id " + result.data.data.output);
                ref.loadAll();
              }
            }),function(err){
              ref.$toast.error(err.toString());
            };
        }
      }
    },
    validations() {
      return {
        user:{
          username: {
            required
          },
          password: {
            required,
            minLength:8,
            passwordComplexity : helpers.withParams(
                {description: "Must contain at least 1 numeric, 1 special, 1 upper and 1 lower character",type:"regex"},
                (value) => !helpers.req(value) || (new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])").test(value))
            )
          },
          email:{
            email
          },
          group_id: {
            required
          },
          password2:{
            sameAsPassword: sameAs(this.user.password)
          }
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
