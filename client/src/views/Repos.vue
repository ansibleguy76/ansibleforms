<template>
  <section v-if="isAdmin" class="section">
    <BulmaModal v-if="showDelete" title="Delete" action="Delete" @click="deleteRepo();showDelete=false" @close="showDelete=false" @cancel="showDelete=false">Are you sure you want to delete repository '{{ repoItem}}'</BulmaModal>
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon :icon="['fab','git-square']" /> Repositories</h1>
      <div class="columns">
        <div class="column">
            <BulmaSelect :icon="['fab','git-square']" label="Select a repository" size="10" :list="repoList" valuecol="" labelcol="" @change="loadRepo()" v-model="repoItem" />
            <BulmaButton v-if="repoItem!=undefined" icon="plus" label="New Repo" @click="repoItem=undefined;loadRepo()"></BulmaButton>
            <BulmaButton v-if="repoItem!=undefined && repoItem!=1" type="is-danger" icon="trash-alt" label="Delete Repo" @click="showDelete=true"></BulmaButton>
        </div>
        <div class="column is-three-quarters">
          <div v-if="repoStatus || loading" class="box  is-family-monospace enable-line-break is-size-7">
            <span v-if="loading" class="icon"><font-awesome-icon icon="spinner" spin /></span>
            <div v-html="repoStatus"></div>
          </div>
          <BulmaCheckbox v-if="!repoStatus && !loading" checktype="checkbox" v-model="repo.isAdvanced" label="Advanced" />
          <BulmaInput v-if="!repoStatus && !loading && !repo.isAdvanced" :icon="['fab','git-square']" v-model="repo.uri" label="Repository Uri" placeholder="git@github.com:myrepo" :required="true" :hasError="$v.repo.uri.$invalid" :errors="[]" />
          <BulmaInput v-if="!repoStatus && !loading && repo.isAdvanced" :icon="['fab','git-square']" v-model="repo.command" label="Repository Clone Command" placeholder="git clone --quite --verbose git@github.com:myrepo" :required="true" :hasError="$v.repo.command.$invalid" :errors="[]" />
          <BulmaButton v-if="repoItem==undefined && !loading" icon="save" label="Create Repository" @click="newRepo()"></BulmaButton>
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
  import BulmaCheckbox from './../components/BulmaCheckRadio.vue'
  import BulmaInput from './../components/BulmaInput.vue'
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
    components:{BulmaButton,BulmaSelect,BulmaInput,BulmaModal,BulmaCheckbox},
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
      },loadRepo(){
        var ref= this;
        if(this.repoItem!=undefined){
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
          this.repo = {
            name:""
          }
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
                ref.repo.uri=""
                ref.$toast.success("Created repository");
                ref.loadAll();
              }
            }),function(error){
              ref.loading=false
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
  .is-text-overflow {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
  }
  .enable-line-break {
      white-space: pre-wrap;
  }
</style>
