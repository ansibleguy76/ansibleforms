<template>
  <section v-if="isAdmin" class="section">
    <BulmaModal v-if="showDelete" title="Delete" action="Delete" @click="deleteRepo();showDelete=false" @close="showDelete=false" @cancel="showDelete=false">Are you sure you want to delete repository '{{ repoItem}}'</BulmaModal>
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon :icon="['fab','git-square']" /> Repositories</h1>

      <nav class="level">
        <!-- Left side -->
        <div class="level-left">
          <p class="level-item"><BulmaButton icon="plus" label="New Repo" @click="reset();loadRepo()"></BulmaButton></p>
          <p class="level-item"><BulmaButton icon="server" label="Add known hosts" @click="reset();known_hosts=1"></BulmaButton></p>
        </div>
      </nav>
      <div class="columns">
        <div class="column" v-if="repoList && repoList.length>0">
          <BulmaAdminTable
            :dataList="repoList"
            :labels="['Name']"
            :columns="['']"
            identifier=""
            :actions="[{name:'select',title:'show repository',icon:'info-circle',color:'has-text-link'},{name:'delete',title:'delete repository',icon:'times',color:'has-text-danger'}]"
            :currentItem="repoItem"
            @select="selectItem"
            @delete="deleteItem"
          />
        </div>
        <transition name="add-column" appear>
          <div class="column is-two-thirds" v-if="repoItem!==undefined && known_hosts!==1 && !showDelete">
            <div v-if="repoStatus || loading" class="box  is-family-monospace enable-line-break is-size-7">
              <span v-if="loading" class="icon"><font-awesome-icon icon="spinner" spin /></span>
              <div v-html="repoStatus"></div>
            </div>
            <BulmaCheckbox v-if="!repoStatus && !loading" checktype="checkbox" v-model="repo.isAdvanced" label="Advanced" />
            <BulmaInput v-if="!repoStatus && !loading && !repo.isAdvanced" :icon="['fab','git-square']" v-model="repo.uri" label="Repository Uri" placeholder="git@github.com:myrepo" :required="true" :hasError="$v.repo.uri.$invalid" :errors="[]" />
            <BulmaInput v-if="!repoStatus && !loading && repo.isAdvanced" :icon="['fab','git-square']" v-model="repo.command" label="Repository Clone Command" placeholder="git clone --quite --verbose git@github.com:myrepo" :required="true" :hasError="$v.repo.command.$invalid" :errors="[]" />
            <BulmaInput v-if="!repoStatus && !loading" icon="user" v-model="repo.username" label="Repository Username" placeholder="Ansibleforms" :required="true" :hasError="$v.repo.username.$invalid" :errors="[]" />
            <BulmaInput v-if="!repoStatus && !loading" icon="envelope" v-model="repo.email" label="Repository Email" placeholder="info@ansibleforms.com" :required="true" :hasError="$v.repo.email.$invalid" :errors="[]" />
            <BulmaButton v-if="repoItem==-1 && !loading" icon="save" label="Create Repository" @click="newRepo()"></BulmaButton>
          </div>
        </transition>
        <transition name="add-column" appear>
          <div class="column is-two-thirds" v-if="known_hosts==1 && !showDelete">
            <BulmaInput icon="server" v-model="hosts" label="Known hosts" placeholder="github.com,bitbucket.com" :required="true" :hasError="$v.hosts.$invalid" :errors="[]" />
            <BulmaButton v-if="known_hosts==1 && !loading" icon="server" label="Add to known hosts" @click="addKnownHosts()"></BulmaButton>
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
  import BulmaCheckbox from './../components/BulmaCheckRadio.vue'
  import BulmaInput from './../components/BulmaInput.vue'
  import BulmaAdminTable from './../components/BulmaAdminTable.vue'
  import BulmaModal from './../components/BulmaModal.vue'
  import TokenStorage from './../lib/TokenStorage'
  import { required, email, minValue,maxValue,minLength,maxLength,helpers,requiredIf,sameAs } from 'vuelidate/lib/validators'
  const gitclone = helpers.regex("gitclone",/^git clone --quiet .+$/g)
  Vue.use(Vuelidate)

  export default{
    name: "Repos",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{BulmaButton,BulmaInput,BulmaModal,BulmaCheckbox,BulmaAdminTable},
    data(){
      return  {
          loading:false,
          repo:{
            uri:"",
            isAdvanced:false,
            command:"",
            username:"Ansibleforms",
            email:"info@ansibleforms.com"
          },
          showDelete:false,
          repoItem:undefined,
          known_hosts:undefined,
          hosts:"",
          repoList:[],
          alert:{
            timeout:undefined,
            message:"",
            type:""
          },
          repoStatus:""
        }
    },
    methods:{
      loadAll(){
        this.loadRepoList();
        this.loadRepo();
      },loadRepoList(){
        var ref= this;
        axios.get('/api/v1/repo/',TokenStorage.getAuthentication())
          .then((result)=>{
            if(result.data.status=="error"){
              ref.$toast.error(result.data.message);
            }else{
              ref.repoList=result.data.data.output;
            }
          }),function(error){
            ref.$toast.error(error.message);
          };
      },
      reset(){
        this.repoItem=-1
        this.known_hosts=-1
        this.repo.uri=""
        this.repo.command=""
        this.repo.username="Ansibleforms"
        this.repo.email="info@ansibleforms.com"
      },
      selectItem(value){
        this.repoItem=value
        this.loadRepo()
      },
      deleteItem(value){
        this.selectItem(value)
        this.showDelete=true
      },
      loadRepo(){
        var ref= this;
        if(this.repoItem!=undefined && this.repoItem!=-1){
          this.loading=true
          axios.get('/api/v1/repo/?name=' + this.repoItem,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message);
              }else{
                console.log("loaded repo item");
                ref.repoStatus=result.data.data.output
              }
              ref.loading=false
            }),function(error){
              ref.$toast.error(error.message);
              ref.loading=false
            };
        }else{
          console.log("No item selected")
          this.reset()
          this.repoStatus=undefined
        }
      },deleteRepo(){
        var ref= this;
        axios.delete('/api/v1/repo/?name='+this.repoItem,TokenStorage.getAuthentication())
          .then((result)=>{
            if(result.data.status=="error"){
              ref.$toast.error(result.data.message + ", " + result.data.data.error);
            }else{
              ref.$toast.success("Repo is removed");
              ref.repoItem=undefined;
              ref.loadAll();
            }
          }),function(error){
            ref.$toast.error(error.message);
          };
      },newRepo(){
        var ref= this;
        if (!this.$v.repo.$invalid) {
          this.loading=true
          axios.post('/api/v1/repo/',this.repo,TokenStorage.getAuthentication())
            .then((result)=>{
              ref.loading=false
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                ref.reset()
                ref.$toast.success("Created repository");
                ref.loadAll();
              }
            }),function(error){
              ref.loading=false
              ref.$toast.error(error.message);
            };
        }
      },
      addKnownHosts(){
        var ref= this;
        if (!this.$v.hosts.$invalid) {
          this.loading=true
          axios.post('/api/v1/repo/known_hosts',{hosts:this.hosts},TokenStorage.getAuthentication())
            .then((result)=>{
              ref.loading=false
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                ref.hosts=""
                ref.reset()
                ref.$toast.success("Added keys of hosts\n"+result.data.data.output.replaceAll('\n\n','\n'));
                ref.loadAll();
              }
            }),function(error){
              ref.loading=false
              ref.$toast.error(error.message);
            };
        }
      }
      ,showAlert(type,message){
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
      repo:{
        uri: {
          requiredIf:requiredIf(function(repo){
            return !repo.isAdvanced
          })
        },
        command: {
          requiredIf:requiredIf(function(repo){
            return repo.isAdvanced
          }),
          gitclone
        },
        email:{
          required,
          email
        },
        username:{
          required
        }
      },
      hosts:{
        required
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
  .is-text-overflow {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
  }
  .enable-line-break {
      white-space: pre-wrap;
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
