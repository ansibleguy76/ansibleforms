<template>
  <section v-if="isAdmin" class="section">
    <BulmaModal v-if="showDelete && group.name" title="Delete" action="Delete" @click="deleteGroup();showDelete=false" @close="showDelete=false" @cancel="showDelete=false">Are you sure you want to delete Group '{{ group.name}}'</BulmaModal>
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="users" /> Groups</h1>
      <nav class="level">
        <!-- Left side -->
        <div class="level-left">
          <p class="level-item"><BulmaButton icon="plus" label="New Group" @click="groupItem=-1;loadGroup()"></BulmaButton></p>
        </div>
      </nav>
      <div class="columns">
        <div class="column">
          <BulmaAdminTable
            v-if="groupList && groupList.length>0"
            :dataList="groupList.map(x => ({...x,allowdelete:(x.id!=1 && !hasUsers(x.id))}))"
            :labels="['Name']"
            :columns="['name']"
            identifier="id"
            :actions="[
                        {name:'select',title:'show group',icon:'info-circle',color:'has-text-info'},
                        {name:'delete',title:'delete group',icon:'times',color:'has-text-danger'}
                    ]"
            :currentItem="groupItem"
            @select="selectItem"
            @delete="deleteItem"
          />
        </div>
        <transition name="add-column" appear>
          <div class="column" v-if="groupItem==-1 && !showDelete">
              <BulmaInput icon="users" v-model="group.name" label="Name" placeholder="Name" :required="true" :hasError="$v.group.name.$invalid" :errors="[]" />
              <BulmaButton icon="save" label="Create Group" @click="newGroup()"></BulmaButton>
          </div>
          <div class="column" v-if="groupItem>0 && !showDelete">
            <table class="table is-bordered is-fullwidth" v-if="groupUsers.length>0">
              <thead class="has-background-grey">
                <tr>
                  <th class="has-text-white">Users in group '{{group.name}}'</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in groupUsers" :key="'user'+user.username">
                  <td>{{ user.username }}</td>
                </tr>
              </tbody>
            </table>
            <p class="notification" v-else>No users in group '{{group.name}}'</p>
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
  import BulmaInput from './../components/BulmaInput.vue'
  import BulmaAdminTable from './../components/BulmaAdminTable.vue'
  import BulmaModal from './../components/BulmaModal.vue'
  import TokenStorage from './../lib/TokenStorage'
  import { required, email, minValue,maxValue,minLength,maxLength,helpers,requiredIf,sameAs } from 'vuelidate/lib/validators'

  Vue.use(Vuelidate)
  export default{
    name:"Groups",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{BulmaButton,BulmaInput,BulmaModal,BulmaAdminTable},
    data(){
      return  {
          group:{
            name:""
          },
          showDelete:false,
          groupItem:undefined,
          groupList:[],
          userList:[],
          alert:{
            timeout:undefined,
            message:"",
            type:""
          }
        }
    },
    computed:{
      groupUsers(){
        return this.userList.filter(x => x.group_id == this.groupItem)
      }
    },
    methods:{
      loadAll(){
        this.loadGroupList();
        this.loadUserList();
        this.loadGroup();
      },
      hasUsers(groupId){
        return (this.userList.filter(x => x.group_id == groupId).length>0)
      },
      selectItem(value){
        this.groupItem=value
        this.loadGroup()
      },
      deleteItem(value){
        this.selectItem(value)
        this.showDelete=true
      },
      loadGroupList(){
        var ref= this;
        this.groupList=[];
        axios.get('/api/v1/group/',TokenStorage.getAuthentication())
          .then((result)=>{
            ref.groupList=result.data.data.output;
          }),function(error){
            ref.$toast.error(error.message);
          };
      },
      loadUserList(){
        var ref= this;
        this.userList=[];
        axios.get('/api/v1/user/',TokenStorage.getAuthentication())
          .then((result)=>{
            ref.userList=result.data.data.output;
          }),function(error){
            ref.$toast.error(error.message);
          };
      },
      loadGroup(){
        var ref= this;
        if(this.groupItem!=undefined && this.groupItem!=-1){

          axios.get('/api/v1/group/' + this.groupItem,TokenStorage.getAuthentication())
            .then((result)=>{
              console.log("loaded group item");
              ref.group=result.data.data.output
            }),function(error){
              ref.$toast.error(error.message);
            };
        }else{
          console.log("No item selected")
          this.group = {
            name:""
          }
        }
      },
      deleteGroup(){
        var ref= this;
        axios.delete('/api/v1/group/'+this.groupItem,TokenStorage.getAuthentication())
          .then((result)=>{
            if(result.data.status=="error"){
              ref.$toast.error(result.data.message + ", " + result.data.data.error);
            }else{
              ref.$toast.success("Group is removed");
              ref.groupItem=undefined;
              ref.loadAll();
            }
          }),function(error){
            ref.$toast.error(error.message);
          };
      },
      newGroup(){
        var ref= this;
        if (!this.$v.group.$invalid) {
          axios.post('/api/v1/group/',this.group,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                Vue.set(ref,"groupItem",result.data.data.output)
                ref.$toast.success("Created group with new id " + result.data.data.output);
                ref.loadAll();
              }
            }),function(error){
              ref.$toast.error(error.message);
            };
        }
      },
      showAlert(type,message){
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
      group:{
        name: {
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
    width:6em!important;
    max-width:6em!important;
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
