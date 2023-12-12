<template>
  <section v-if="isAdmin" class="section">
    <BulmaQuickView class="quickview" v-if="showOutput" title="Execution result" footer="" @close="showOutput=false">
        <p class="is-family-code" v-html="output.split('\n').join('<br>')"></p>
    </BulmaQuickView>    
    <BulmaModal v-if="showDelete" title="Delete" action="Delete" @click="deleteRepo();showDelete=false" @close="showDelete=false" @cancel="showDelete=false">Are you sure you want to delete repository '{{ repoItem}}'</BulmaModal>
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon :icon="['fab','git-square']" /> Repositories</h1>
      <div class="columns">
        <div class="column is-narrow">
          <BulmaSettingsMenu />
        </div>
        <div class="column">    
          <nav class="level">
            <!-- Left side -->
            <div class="level-left">
              <p class="level-item"><BulmaButton icon="plus" label="New Repo" @click="reset();loadRepo()"></BulmaButton></p>
            </div>
          </nav>
          <div class="columns">
            <div class="column" v-if="repoList && repoList.length>0">
              <BulmaAdminTable
                :dataList="repoList"
                :labels="['Name']"
                :columns="['']"
                identifier=""
                :actions="[{name:'select',title:'show repository',icon:'info-circle',color:'has-text-link'},{name:'delete',title:'delete repository',icon:'times',color:'has-text-danger'},{name:'pull',title:'pull repository',icon:'refresh',color:'has-text-link'}]"
                :currentItem="repoItem"
                @select="selectItem"
                @delete="deleteItem"
                @pull="pullRepo"
              />
            </div>
            <transition name="add-column" appear>
              <div class="column is-two-thirds" v-if="repoItem!==undefined && !showDelete">
                <div v-if="repoStatus || loading" class="box  is-family-monospace enable-line-break is-size-7">
                  <span v-if="loading" class="icon"><font-awesome-icon icon="spinner" spin /></span><span v-if="loading">TIMEOUT = 60s</span>
                  <div v-html="repoStatus"></div>
                </div>
             
                <BulmaCheckbox v-if="!repoStatus && !loading" checktype="checkbox" v-model="repo.isAdvanced" label="Advanced" />
                <div v-if="!repoStatus && !loading">
                  <div v-if="repo.isAdvanced" class="notification is-warning is-light mt-3">
                    <strong>Advanced mode</strong> : You need to run the git clone command manually.<br>
                    The command MUST start with <code>git clone</code> and note that <strong>NO PROMPTS</strong> are allowed.<br><br>
                    The command will timeout after 60 seconds.<br><br>
                    current directory is <code>%REPO_PATH%</code> (see environment variables)
                  </div>
                  <div v-else class="notification is-info is-light mt-3">
                    <strong>The following command will be ran :</strong><br>
                    <div class="is-family-code">git clone --verbose {repository_uri};</div>
                    <div class="mt-3"><strong>The repository_uri must something like :</strong><br>
                      <div class="is-family-code">
                      - git@{url}/{account_name}/{repository_name}.git<br>
                      - https://{url}/{account_name}/{repository_name}.git<br>
                      - https://{username}:{password/token}@{url}/{account_name}/{repository_name}.git
                      </div>
                    </div>
                    <div class="mt-3"><strong>If you want to run your own custom command, use advanced mode</strong></div>
                  </div>  
                </div>
                <BulmaInput v-if="!repoStatus && !loading && !repo.isAdvanced" :icon="['fab','git-square']" v-model="repo.uri" label="Repository Uri" placeholder="valid git uri" :required="true" :hasError="$v.repo.uri.$invalid" :errors="[]" />
                <BulmaInput v-if="!repoStatus && !loading && repo.isAdvanced" :icon="['fab','git-square']" v-model="repo.command" label="Command" placeholder="git clone --verbose git@github.com:myrepo" :required="true" :hasError="$v.repo.command.$invalid" :errors="[]" />
                <BulmaButton v-if="repoItem==-1 && !loading" icon="save" :label="(repo.isAdvanced)?'Run command':'Create Repository'" @click="newRepo()"></BulmaButton>
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
  import BulmaCheckbox from './../components/BulmaCheckRadio.vue'
  import BulmaInput from './../components/BulmaInput.vue'
  import BulmaAdminTable from './../components/BulmaAdminTable.vue'
  // import BulmaTextArea from './../components/BulmaTextArea.vue'
  import BulmaModal from './../components/BulmaModal.vue'
  import BulmaSettingsMenu from '../components/BulmaSettingsMenu.vue'
  import BulmaQuickView from './../components/BulmaQuickView.vue'
  import TokenStorage from './../lib/TokenStorage'
  import { required, email, minValue,maxValue,minLength,maxLength,helpers,requiredIf,sameAs } from 'vuelidate/lib/validators'
  Vue.use(Vuelidate)

  export default{
    name: "Repos",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{BulmaButton,BulmaInput,BulmaModal,BulmaQuickView,BulmaCheckbox,BulmaAdminTable,BulmaSettingsMenu},
    data(){
      return  {
          loading:false,
          repo:{
            uri:"",
            isAdvanced:false,
            command:""
          },
          showDelete:false,
          repoItem:undefined,
          repoList:[],
          output:"",
          alert:{
            timeout:undefined,
            message:"",
            type:""
          },
          repoStatus:"",
          showOutput:false
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
          }),function(err){
            ref.$toast.error(err.toString());
          };
      },
      reset(){
        this.repoItem=-1
        this.known_hosts=-1
        this.repo.uri=""
        this.repo.command=""
        this.repo.isAdvanced=false
      },
      selectItem(value){
        this.repoItem=value
        this.loadRepo()
      },
      pullRepo(value){
        var ref=this
        this.repoItem=value
        axios.post(`/api/v1/repo/pull/${encodeURI(value)}`,{},TokenStorage.getAuthentication())
        .then((result)=>{
              ref.loading=false
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message);
                ref.output = result.data.data.error
              }else{
                ref.reset()
                ref.output = result.data.data.output
                ref.loadAll();
              }
              ref.showOutput=true
            }),function(err){
              ref.loading=false
              ref.$toast.error(err.toString());
            };        
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
            }),function(err){
              ref.$toast.error(err.toString());
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
              ref.$toast.error(result.data.message);
              ref.output = result.data.data.error;
              ref.showOutput=true
            }else{
              ref.$toast.success("Repo is removed");
              ref.repoItem=undefined;
              ref.loadAll();
            }
            
          }),function(err){
            ref.$toast.error(err.toString());
          };
      },newRepo(){
        var ref= this;
        if ((!this.$v.repo.command.$invalid && this.repo.isAdvanced) || (!this.$v.repo.uri.$invalid && !this.repo.isAdvanced)) {
          this.loading=true
          axios.post('/api/v1/repo/',this.repo,TokenStorage.getAuthentication())
            .then((result)=>{
              ref.loading=false
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message);
                ref.output = result.data.data.error
              }else{
                ref.reset()
                ref.output = result.data.data.output
                ref.loadAll();
              }
              ref.showOutput=true
            }),function(err){
              ref.loading=false
              ref.reset()
              ref.$toast.error(err.toString());
            };
        }else{
          ref.$toast.warning('Invalid formdata')
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
          })
        },
        email:{
          required,
          email
        },
        username:{
          required
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
  .quickview{
    z-index:91000;
  }
  .cursor-progress{
    cursor:progress;
  }
  .select, .select select{
    width:100%;
  }
  .is-not-clickable{
    cursor:default!important;
  }
  .pop-enter-active,
  .pop-leave-active {
    transform: scale(1.2);
    transition: all 0.2s ease-in-out;
  }
  .pop-enter,
  .pop-leave-to {
    transform: scale(1);
  }  
</style>
