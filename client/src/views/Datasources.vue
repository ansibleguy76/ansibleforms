<template>
  <section v-if="profile?.options?.showSettings ?? isAdmin" class="section">
    <BulmaQuickView class="quickview" v-if="showOutput" title="Last execution result" footer="" @close="showOutput=false">
        <p class="is-family-code" v-html="output.split('\n').join('<br>')"></p>
    </BulmaQuickView>        
    <BulmaModal v-if="showDelete && datasource.name" title="Delete" action="Delete" @click="deleteDatasource();showDelete=false" @close="removeDelete()" @cancel="removeDelete()">Are you sure you want to delete Datasource '{{ datasource.name}}'</BulmaModal>
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="fa-square-binary" /> Datasources</h1>
      <div class="columns">
        <div class="column is-narrow">
          <BulmaSettingsMenu />
        </div>
        <div class="column">         
          <nav class="level">
            <!-- Left side -->
            <div class="level-left">
              <p class="level-item"><BulmaButton icon="plus" label="New Datasource" @click="datasourceItem=-1;loadDatasource()"></BulmaButton></p>
            </div>
          </nav>
          <div class="columns">
            <div class="column" v-if="datasourceList && datasourceList.length>0">
              <BulmaAdminTable
                :dataList="datasourceList"
                :labels="['Name','Schema','Last Run','Status','State']"
                :columns="['name','schema','last_run','status','state']"
                :filters="['name','status']"
                identifier="id"
                :actions="[{name:'select',title:'edit datasource',icon:'pencil-alt',color:'has-text-warning'},{name:'delete',title:'delete datasource',icon:'times',color:'has-text-danger'},{name:'import',title:'import datasource',icon:'play',color:'has-text-info'},{name:'output',title:'info',icon:'circle-info',color:'has-text-link'}]"
                :currentItem="datasourceItem"
                @select="selectItem"
                @import="importItem"
                @delete="deleteItem"
                @output="outputItem"
              />
            </div>
            <transition name="add-column" appear>
              <div class="column" v-if="datasourceItem!==undefined && !showDelete">
                <BulmaInput icon="heading" v-model="datasource.name" label="Name" placeholder="Datasource name" :readonly="datasourceItem!==-1" :required="true" :hasError="v$.datasource.name.$invalid" :errors="[]" help="Alphanumeric with underscore and hyphen" />
                <BulmaSelect icon="project-diagram" label="Select a schema" :list="schemaList" valuecol="name" :required="true" :hasError="v$.datasource.schema.$invalid" labelcol="name" v-model="datasource.schema" :errors="[]" />
                <BulmaInput icon="stopwatch" v-model="datasource.cron" label="Cron Schedule" placeholder="*/5 * L * 1,3L" :hasError="v$.datasource.cron.$invalid" :errors="[]" help="Minute Hour DayOfMonth Month DayOfWeek" />
                <BulmaInput icon="play" v-model="datasource.form" label="PLaybook" placeholder="Playbook" />
                <p class="has-text-weight-bold">
                  Extra vars (YAML)
                </p>
                <small>Next to the extra vars, the datasource object itself will also be appended and the credentials that are defined in the form.</small>
                <VueCodeEditor
                  v-model="datasource.extra_vars"
                  @init="editorInit"
                  lang="yaml"
                  theme="monokai"
                  width="100%"
                  height="40vh"
                  tabindex=0
                  :lazymodel="true"
                  @dirty="formDirty=true"
                  :options="{
                      enableBasicAutocompletion: true,
                      enableLiveAutocompletion: false,
                      fontSize: 14,
                      highlightActiveLine: true,
                      enableSnippets: false,
                      showLineNumbers: true,
                      tabSize: 2,
                      wrap:false,
                      showPrintMargin: false,
                      showGutter: true
                  }"
                />
                <br />                
                <BulmaButton v-if="datasourceItem==-1" icon="save" label="Create Datasource" @click="newDatasource()"></BulmaButton>
                <BulmaButton v-if="datasourceItem!=-1" icon="save" label="Update Datasource" @click="updateDatasource()"></BulmaButton>
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
  import BulmaAdminTable from './../components/BulmaAdminTable.vue'
  import BulmaInput from './../components/BulmaInput.vue'
  import BulmaModal from './../components/BulmaModal.vue'
  import BulmaSelect from '../components/BulmaSelect.vue'
  import BulmaSettingsMenu from '../components/BulmaSettingsMenu.vue'
  import BulmaQuickView from './../components/BulmaQuickView.vue'
  import VueCodeEditor from './../components/VueCodeEditor';
  import TokenStorage from './../lib/TokenStorage'
  import { useVuelidate } from '@vuelidate/core'
  import { required, helpers } from '@vuelidate/validators'
  import 'brace/ext/language_tools'
  import 'brace/mode/yaml'
  import 'brace/theme/monokai'  

  export default{
    name:"AfDatasources",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean},
      profile:{type:Object}
    },
    components:{BulmaButton,BulmaInput,BulmaModal,BulmaQuickView,BulmaAdminTable,BulmaSettingsMenu,BulmaSelect,VueCodeEditor},
    setup(){
      return { v$: useVuelidate() }
    },
    data(){
      return  {
          datasource:{
            id:undefined,
            name:"",
            schema:"",
            form:"",
            extra_vars:"",
            cron:""
          },
          interval:undefined,
          showDelete:false,
          schemaList:[],
          datasourceItem:undefined,
          datasourceList:[],
          output:"",
          showOutput:false,
          alert:{
            timeout:undefined,
            message:"",
            type:""
          }
        }
    },
    beforeDestroy(){
      clearInterval(this.interval)
    },    
    methods:{
      loadAll(){
        this.loadDatasourceList();
        this.loadDatasource();
        this.loadSchemaList();
      },
      loadDatasourceList(){
        var ref= this;
        axios.get(`/api/v1/datasource`,TokenStorage.getAuthentication())
          .then((result)=>{
            ref.datasourceList=result.data.data.output
            // correct last run time to local time
            ref.datasourceList.forEach((item)=>{
              if(item.last_run){
                item.last_run=new Date(item.last_run).toLocaleString()
              }
            })
          }),function(err){
            ref.$toast.error(err.toString());
          };
      },
      selectItem(value,showOutput=false){
        this.datasourceItem=value
        this.loadDatasource(showOutput)
      },
      resetItem(){
        this.datasourceItem=undefined
      },
      deleteItem(value){
        this.selectItem(value)
        this.showDelete=true
      },
      importItem(value){
        this.selectItem(value)
        this.importDatasource()
      },
      outputItem(value){
        this.selectItem(value,true)
      },    
      removeDelete(){
        this.showDelete=false
        this.resetItem()
      }, 
      loadDatasource(showOutput=false){
        var ref= this;
        if(this.datasourceItem!=undefined && this.datasourceItem!=-1){

          axios.get(`/api/v1/datasource/${this.datasourceItem}`,TokenStorage.getAuthentication())
            .then((result)=>{
              console.log("loaded datasource item");
              ref.datasource=result.data.data.output
              if(showOutput){
                ref.output=this.datasource.output
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
          this.datasource = {
            name:""
          }
        }
      },
      deleteDatasource(){
        var ref= this;
        axios.delete(`/api/v1/datasource/${this.datasourceItem}`,TokenStorage.getAuthentication())
          .then((result)=>{
            if(result.data.status=="error"){
              ref.$toast.error(result.data.message + ", " + result.data.data.error);
            }else{
              ref.$toast.success("Datasource is removed");
              ref.datasourceItem=undefined;
              ref.loadAll();
            }
          }),function(err){
            ref.$toast.error(err.toString());
          };
      },updateDatasource(){
        var ref= this;
        if (!this.v$.datasource.$invalid) {
          // clone the selected item
          var postdata = JSON.parse(JSON.stringify(this.datasource))
          // and remove status data
          delete postdata.output
          delete postdata.status
          delete postdata.head
          axios.put(`/api/v1/datasource/${this.datasourceItem}`,postdata,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                ref.$toast.success("Datasource is updated");
                ref.loadAll();
              }
            }),function(err){
              ref.$toast.error(err.toString());
            };
        }else{
          this.$toast.warning("Invalid form data")
        }
      },newDatasource(){
        var ref= this;
        if (!this.v$.datasource.$invalid) {
          axios.post(`/api/v1/datasource/`,this.datasource,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                Vue.set(ref,"datasourceItem",result.data.data.output)
                ref.$toast.success("Created datasource with new id " + result.data.data.output);
                ref.loadAll();
              }
            }),function(err){
              ref.$toast.error(err.toString());
            };
        }           
      },importDatasource(){
        var ref= this;
        axios.post(`/api/v1/datasource/${this.datasourceItem}/import`,{},TokenStorage.getAuthentication())
        setTimeout(()=>{ref.loadAll()},500)
        this.resetItem()
        this.loadAll()
      }, loadSchemaList(){
        var ref= this;
        axios.get(`/api/v1/datasource/schema`,TokenStorage.getAuthentication())
          .then((result)=>{
            ref.schemaList=result.data.data.output;
          }),function(err){
            ref.$toast.error(err.toString());
          };
      },      
      editorInit: function () {
          // vue2-code-editor/node_modules/
            // language extension prerequisite...

      }           
    },
    validations: {
      datasource:{
        name: {
          required,
          regex : helpers.withParams(
              {description: "Must be a valid datasource name",type:"regex"},
              (value) => !helpers.req(value) || (new RegExp("^[a-zA-Z0-9_\.]{1,50}$").test(value)) // eslint-disable-line
          )             
        },
        cron: {
          regex : helpers.withParams(
              {description: "Cron must be valid format",type:"regex"},
              (value) => !helpers.req(value) || (new RegExp("^[0-9-,*/]+ [0-9-,*/]+ [0-9-,*/L]+ [0-9-,*/]+ [0-9-,*/L]+$").test(value)) // eslint-disable-line
          )                    
        },        
        schema: {
          required,
          regex : helpers.withParams(
              {description: "Must be a valid schema name",type:"regex"},
              (value) => !helpers.req(value) || (new RegExp("^[a-zA-Z0-9_]{1,50}$").test(value)) // eslint-disable-line
          )             
        }
      }
    },
    mounted() { // when the Vue app is booted up, this is run automatically.
        this.loadAll();
        this.interval=setInterval(this.loadDatasourceList,7000) // reload running jobs every 7s
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
