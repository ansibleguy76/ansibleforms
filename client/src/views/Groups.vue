<template>
  <section v-if="isAdmin" class="section">
    <BulmaModal v-if="showDelete" title="Comfirm" action="Delete" @click="deleteGroup();showDelete=false" @close="showDelete=false" @cancel="showDelete=false">Are you sure you want to delete Group '{{ group.name}}'</BulmaModal>
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="users" /> Groups</h1>
      <div class="columns">
        <div class="column">
            <BulmaSelect icon="users" label="Select a group" :list="groupList" valuecol="id" labelcol="name" @change="loadGroup()" v-model="groupItem" />
            <BulmaButton v-if="groupItem!=undefined" icon="plus" label="New Group" @click="groupItem=undefined;loadGroup()"></BulmaButton>
            <BulmaButton v-if="groupItem!=undefined && groupItem!=1" type="is-danger" icon="trash-alt" label="Delete Group" @click="showDelete=true"></BulmaButton>
        </div>
        <div class="column is-three-quarters">
          <BulmaInput icon="group" v-model="group.name" label="Groupname" :readonly="groupItem!==undefined" placeholder="Groupname" :required="true" :hasError="$v.group.name.$invalid" :errors="[]" />
          <BulmaButton v-if="groupItem==undefined" icon="save" label="Create Group" @click="newGroup()"></BulmaButton>
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
  import { library } from '@fortawesome/fontawesome-svg-core'
  import { fas } from '@fortawesome/pro-solid-svg-icons'
  import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
  library.add(fas) // add all solid icons
  Vue.component('font-awesome-icon', FontAwesomeIcon)
  import TokenStorage from './../lib/TokenStorage'
  import { required, email, minValue,maxValue,minLength,maxLength,helpers,requiredIf,sameAs } from 'vuelidate/lib/validators'

  Vue.use(Vuelidate)
  export default{
    name:"Groups",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{BulmaButton,BulmaSelect,BulmaInput,BulmaModal},
    data(){
      return  {
          group:{
            name:""
          },
          showDelete:false,
          groupItem:undefined,
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
        this.loadGroupList();
        this.loadGroup();
      },loadGroupList(){
        var ref= this;
        axios.get('/api/v1/group/',TokenStorage.getAuthentication())
          .then((result)=>{
            ref.groupList=result.data.data.output;
          }),function(error){
            ref.$toast.error(error.message);
          };
      },loadGroup(){
        var ref= this;
        if(this.groupItem!=undefined){

          axios.get('/api/v1/group/' + this.groupItem,TokenStorage.getAuthentication())
            .then((result)=>{
              console.log("loaded group item");
              ref.group=result.data.data.output
              ref.group.password=""
            }),function(error){
              ref.$toast.error(error.message);
            };
        }else{
          console.log("No item selected")
          this.group = {
            name:""
          }
        }
      },deleteGroup(){
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
      },newGroup(){
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
      group:{
        name: {
          required
        },
      }

    },
    mounted() { // when the Vue app is booted up, this is run automatically.
      if(!this.isAdmin){
        this.$toast.error("You are not an admin user")
      }else{
        this.loadAll();
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
