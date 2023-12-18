<template>
  <section v-if="isAdmin" class="section">
    <BulmaQuickView class="quickview" v-if="showOutput" title="Last execution result" footer="" @close="showOutput=false">
        <p class="is-family-code" v-html="output.split('\n').join('<br>')"></p>
    </BulmaQuickView>        
    <BulmaModal v-if="showDelete && repository.name" title="Delete" action="Delete" @click="deleteRepository();showDelete=false" @close="removeDelete()" @cancel="removeDelete()">Are you sure you want to delete Repository '{{ repository.name}}'</BulmaModal>
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon :icon="['fab','git']" /> Repositories</h1>
      <div class="columns">
        <div class="column is-narrow">
          <BulmaSettingsMenu />
        </div>
        <div class="column">         
          <nav class="level">
            <!-- Left side -->
            <div class="level-left">
              <p class="level-item"><BulmaButton icon="plus" label="New Repository" @click="repositoryItem=-1;loadRepository()"></BulmaButton></p>
            </div>
          </nav>
          <div class="columns">
            <div class="column" v-if="repositoryList && repositoryList.length>0">
              <div v-if="hasDoubles" class="notification is-warning is-light">
                <strong>Warning:</strong><br>
                You can have only 1 repository for forms or playbooks.
              </div>
              <div v-if="isDouble" class="notification is-warning is-light">
                <strong>Warning:</strong><br>
                A repository can either be for forms or for playbooks, but not both.
              </div>              
              <BulmaAdminTable
                :dataList="repositoryList"
                :labels="['Name','Status','Head','Type']"
                :columns="['name','status','head','icon']"
                :filters="['name','status']"
                :icons="[false,false,false,true]"
                identifier="name"
                :actions="[{name:'select',title:'edit repository',icon:'pencil-alt',color:'has-text-warning'},{name:'delete',title:'delete repository',icon:'times',color:'has-text-danger'},{name:'clone',title:'clone',icon:'download',color:'has-text-info'},{name:'output',title:'info',icon:'circle-info',color:'has-text-link'}]"
                :currentItem="repositoryItem"
                @select="selectItem"
                @clone="cloneItem"
                @delete="deleteItem"
                @output="outputItem"
              />
            </div>
            <transition name="add-column" appear>
              <div class="column" v-if="repositoryItem!==undefined && !showDelete">
                <BulmaInput icon="heading" v-model="repository.name" label="Name" placeholder="my_repo_name" :readonly="repositoryItem!==-1" :required="true" :hasError="$v.repository.name.$invalid" :errors="[]" help="Alphanumeric with dash and hyphen" />
                <BulmaInput icon="user" v-model="repository.user" label="Username" placeholder="my-user" :hasError="$v.repository.user.$invalid" :errors="[]" help="Alphnumeric with hyphen" />
                <BulmaInput icon="lock" v-model="repository.password" type="password" label="Password" placeholder="Password or Token" />
                <BulmaInput :icon="['fab','git']" v-model="repository.uri" label="Uri" placeholder="https://github.com/account/repo.git" :required="true" :hasError="$v.repository.uri.$invalid" :errors="[]" help="Only ssh or https uri's are allowed" />
                <BulmaInput icon="stopwatch" v-model="repository.cron" label="Cron Schedule" placeholder="*/5 * L * 1,3L" :hasError="$v.repository.cron.$invalid" :errors="[]" help="Minute Hour DayOfMonth Month DayOfWeek" />
                <BulmaInput icon="info-circle" v-model="repository.description" label="Description" placeholder="Description" :required="true" :hasError="$v.repository.description.$invalid" :errors="[]" />
                <BulmaCheckbox checktype="checkbox" v-model="repository.use_for_forms" label="Use for forms ?" /><br>
                <BulmaCheckbox checktype="checkbox" v-model="repository.use_for_playbooks" label="Use for playbooks ?" /><br>
                <BulmaCheckbox checktype="checkbox" v-model="repository.rebase_on_start" label="Clone on app start ?" /><br><br>
                <BulmaButton v-if="repositoryItem==-1" icon="save" label="Create Repository" @click="newRepository()"></BulmaButton>
                <BulmaButton v-if="repositoryItem!=-1" icon="save" label="Update Repository" @click="updateRepository()"></BulmaButton>
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
  import BulmaQuickView from './../components/BulmaQuickView.vue'
  // import BulmaSelect from './../components/BulmaSelect.vue'
  import TokenStorage from './../lib/TokenStorage'
  import { required, email, minValue,maxValue,minLength,maxLength,helpers,requiredIf,sameAs,numeric } from 'vuelidate/lib/validators'

  Vue.use(Vuelidate)
  export default{
    name:"Repositories",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{BulmaButton,BulmaInput,BulmaModal,BulmaQuickView,BulmaAdminTable,BulmaCheckbox,BulmaSettingsMenu},
    data(){
      return  {
          repository:{
            name:"",
            user:"",
            password:"",
            uri:"",
            description:"",
            // use_for_forms:false,
            // use_for_playbooks:false,
            rebase_on_start:false
            // cron:""
          },
          interval:undefined,
          showDelete:false,
          repositoryItem:undefined,
          repositoryList:[],
          output:"",
          showOutput:false,
          alert:{
            timeout:undefined,
            message:"",
            type:""
          }
        }
    },
    computed:{
      hasDoubles(){
        return (this.repositoryList.filter(x => x.use_for_forms).length > 1 || this.repositoryList.filter(x => x.use_for_playbooks).length > 1)
      },
      isDouble(){
        return (this.repositoryList.filter(x => x.use_for_forms && x.use_for_playbooks).length>0)
      },      
    },
    beforeDestroy(){
      clearInterval(this.interval)
    },    
    methods:{
      loadAll(){
        this.loadRepositoryList();
        this.loadRepository();
      },
      loadRepositoryList(){
        var ref= this;
        axios.get(`${process.env.BASE_URL}api/v1/repository/`,TokenStorage.getAuthentication())
          .then((result)=>{
            ref.repositoryList=result.data.data.output.map((x)=>{
              var icon = ""
              if(x.use_for_forms){
                icon = "table-list"
              }
              if(x.use_for_playbooks){
                icon = "circle-play"
              }
              return {...x,icon:icon}
            });
          }),function(err){
            ref.$toast.error(err.toString());
          };
      },
      selectItem(value,showOutput=false){
        this.repositoryItem=value
        this.loadRepository(showOutput)
      },
      resetItem(){
        this.repositoryItem=undefined
      },
      deleteItem(value){
        this.selectItem(value)
        this.showDelete=true
      },
      cloneItem(value){
        this.selectItem(value)
        this.cloneRepository()
      },
      outputItem(value){
        this.selectItem(value,true)
      },    
      removeDelete(){
        this.showDelete=false
        this.resetItem()
      }, 
      loadRepository(showOutput=false){
        var ref= this;
        if(this.repositoryItem!=undefined && this.repositoryItem!=-1){

          axios.get(`${process.env.BASE_URL}api/v1/repository/${this.repositoryItem}`,TokenStorage.getAuthentication())
            .then((result)=>{
              console.log("loaded repository item");
              ref.repository=result.data.data.output
              if(showOutput){
                ref.output=this.repository.output
                ref.resetItem()
                if(ref.output){
                  ref.showOutput=true
                }   
              }
           
            }),function(err){
              ref.$toast.error(err.toString());
            };
        }else{
          console.log("No item selected")
          this.repository = {
            name:""
          }
        }
      },
      deleteRepository(){
        var ref= this;
        axios.delete(`${process.env.BASE_URL}api/v1/repository/${this.repositoryItem}`,TokenStorage.getAuthentication())
          .then((result)=>{
            if(result.data.status=="error"){
              ref.$toast.error(result.data.message + ", " + result.data.data.error);
            }else{
              ref.$toast.success("Repository is removed");
              ref.repositoryItem=undefined;
              ref.loadAll();
            }
          }),function(err){
            ref.$toast.error(err.toString());
          };
      },updateRepository(){
        var ref= this;
        if (!this.$v.repository.$invalid) {
          // clone the selected item
          var postdata = JSON.parse(JSON.stringify(this.repository))
          // and remove status data
          delete postdata.output
          delete postdata.status
          delete postdata.head
          axios.put(`${process.env.BASE_URL}api/v1/repository/${this.repositoryItem}`,postdata,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                ref.$toast.success("Repository is updated");
                ref.loadAll();
              }
            }),function(err){
              ref.$toast.error(err.toString());
            };
        }else{
          this.$toast.warning("Invalid form data")
        }
      },newRepository(){
        var ref= this;
        if (!this.$v.repository.$invalid) {
          axios.post(`${process.env.BASE_URL}api/v1/repository/`,this.repository,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                Vue.set(ref,"repositoryItem",result.data.data.output)
                ref.$toast.success("Created repository with new id " + result.data.data.output);
                ref.loadAll();
              }
            }),function(err){
              ref.$toast.error(err.toString());
            };
        }
      },cloneRepository(){
        var ref= this;
        axios.post(`${process.env.BASE_URL}api/v1/repository/${this.repositoryItem}/clone`,{},TokenStorage.getAuthentication())
        setTimeout(()=>{ref.loadAll()},500)
        this.resetItem()
        this.loadAll()
      }      
    },
    validations: {
      repository:{
        name: {
          required,
          regex : helpers.withParams(
              {description: "User must be a valid repository name",type:"regex"},
              (value) => !helpers.req(value) || (new RegExp("^[a-z0-9_-]{1,50}$").test(value)) // eslint-disable-line
          )             
        },
        uri: {
          required,
          regex : helpers.withParams(
              {description: "Must be valid git repository uri",type:"regex"},
              (value) => !helpers.req(value) || (new RegExp("^git@.+$|^https:\/\/.+$").test(value)) // eslint-disable-line
          )             
        },
        description: {
          required
        },
        cron: {
          regex : helpers.withParams(
              {description: "User must be a valid github user (alphanumeric / hyphens)",type:"regex"},
              (value) => !helpers.req(value) || (new RegExp("^[0-9-,*/]+ [0-9-,*/]+ [0-9-,*/L]+ [0-9-,*/]+ [0-9-,*/L]+$").test(value)) // eslint-disable-line
          )                    
        },
        user: {
          maxLength:39,
          regex : helpers.withParams(
              {description: "User must be a valid github user (alphanumeric / hyphens)",type:"regex"},
              (value) => !helpers.req(value) || (new RegExp("^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$").test(value)) // eslint-disable-line
          )          
        }
      }

    },
    mounted() { // when the Vue app is booted up, this is run automatically.
        this.loadAll();
        this.interval=setInterval(this.loadRepositoryList,7000) // reload running jobs every 7s
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
  .quickview{
    z-index:91000;
  }  
</style>
