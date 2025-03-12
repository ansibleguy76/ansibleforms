<template>
  <section v-if="profile?.options?.showSettings ?? isAdmin" class="section">
    <BulmaQuickView class="quickview" v-if="showOutput" title="Last execution result" footer="" @close="showOutput=false">
        <p class="is-family-code" v-html="output.split('\n').join('<br>')"></p>
    </BulmaQuickView>        
    <BulmaModal v-if="showDelete && datasourceSchema.name" title="Delete" action="Delete" @click="deleteDatasourceSchema();showDelete=false" @close="removeDelete()" @cancel="removeDelete()">Are you sure you want to delete DatasourceSchema '{{ datasourceSchema.name}}'</BulmaModal>
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="project-diagram" /> Datasource Schemas</h1>
      <div class="columns">
        <div class="column is-narrow">
          <BulmaSettingsMenu />
        </div>
        <div class="column">         
          <nav class="level">
            <!-- Left side -->
            <div class="level-left">
              <p class="level-item"><BulmaButton icon="plus" label="New DatasourceSchema" @click="datasourceSchemaItem=-1;loadDatasourceSchema()"></BulmaButton></p>
            </div>
          </nav>
          <div class="columns">
            <div class="column" v-if="datasourceSchemaList && datasourceSchemaList.length>0">
    
              <BulmaAdminTable
                :dataList="datasourceSchemaList"
                :labels="['Name','Status']"
                :columns="['name','status']"
                :filters="['name','status']"
                identifier="id"
                :actions="[{name:'select',title:'edit datasourceSchema',icon:'pencil-alt',color:'has-text-warning'},{name:'delete',title:'delete datasourceSchema',icon:'times',color:'has-text-danger'},{name:'reset',title:'reset',icon:'rotate-left',color:'has-text-info'},{name:'output',title:'info',icon:'circle-info',color:'has-text-link'}]"
                :currentItem="datasourceSchemaItem"
                @select="selectItem"
                @reset="resetSchemaItem"
                @delete="deleteItem"
                @output="outputItem"
              />
            </div>
            <transition name="add-column" appear>
              <div class="column" v-if="datasourceSchemaItem!==undefined && !showDelete">
                <BulmaCheckbox checktype="checkbox" v-model="datasourceSchema.force" label="Force ?" /><br>
                <BulmaInput icon="heading" v-model="datasourceSchema.name" label="Name" placeholder="Schema name" :readonly="datasourceSchemaItem!==-1" :required="true" :hasError="v$.datasourceSchema.name.$invalid" :errors="[]" help="Alphanumeric with underscore and hyphen" />
                <BulmaInput icon="info" v-model="datasourceSchema.description" label="Description" placeholder="" :hasError="v$.datasourceSchema.description.$invalid" :errors="[]" />
                <p class="has-text-weight-bold">
                  Table Definitions
                </p>
                <VueCodeEditor
                  v-model="datasourceSchema.table_definitions"
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
                <BulmaButton v-if="datasourceSchemaItem==-1" icon="save" label="Create DatasourceSchema" @click="newDatasourceSchema()"></BulmaButton>
                <BulmaButton v-if="datasourceSchemaItem!=-1" icon="save" label="Update DatasourceSchema" @click="updateDatasourceSchema()"></BulmaButton>
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
  import VueCodeEditor from './../components/VueCodeEditor';
  import BulmaCheckbox from './../components/BulmaCheckRadio.vue'
  import BulmaSettingsMenu from '../components/BulmaSettingsMenu.vue'
  import BulmaQuickView from './../components/BulmaQuickView.vue'
  // import BulmaSelect from './../components/BulmaSelect.vue'
  import TokenStorage from './../lib/TokenStorage'
  import { useVuelidate } from '@vuelidate/core'
  import { required, helpers } from '@vuelidate/validators'


  export default{
    name:"AfDatasourceSchemas",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean},
      profile:{type:Object}
    },
    components:{BulmaButton,BulmaInput,BulmaModal,BulmaQuickView,BulmaAdminTable,BulmaCheckbox,BulmaSettingsMenu,VueCodeEditor},
    setup(){
      return { v$: useVuelidate() }
    },
    data(){
      return  {
          datasourceSchema:{
            id:undefined,
            name:"",
            description:"",
            table_definitions:"",
            force:false
          },
          interval:undefined,
          showDelete:false,
          datasourceSchemaItem:undefined,
          datasourceSchemaList:[],
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
        this.loadDatasourceSchemaList();
        this.loadDatasourceSchema();
      },
      loadDatasourceSchemaList(){
        var ref= this;
        axios.get(`${process.env.BASE_URL}api/v1/datasource/schema`,TokenStorage.getAuthentication())
          .then((result)=>{
            ref.datasourceSchemaList=result.data.data.output
          }),function(err){
            ref.$toast.error(err.toString());
          };
      },
      selectItem(value,showOutput=false){
        this.datasourceSchemaItem=value
        this.loadDatasourceSchema(showOutput)
      },
      resetItem(){
        this.datasourceSchemaItem=undefined
      },
      deleteItem(value){
        this.selectItem(value)
        this.showDelete=true
      },
      resetSchemaItem(value){
        this.selectItem(value)
        this.resetDatasourceSchema()
      },
      outputItem(value){
        this.selectItem(value,true)
      },    
      removeDelete(){
        this.showDelete=false
        this.resetItem()
      }, 
      loadDatasourceSchema(showOutput=false){
        var ref= this;
        if(this.datasourceSchemaItem!=undefined && this.datasourceSchemaItem!=-1){

          axios.get(`${process.env.BASE_URL}api/v1/datasource/schema/${this.datasourceSchemaItem}`,TokenStorage.getAuthentication())
            .then((result)=>{
              console.log("loaded datasourceSchema item");
              ref.datasourceSchema=result.data.data.output
              if(showOutput){
                ref.output=this.datasourceSchema.output
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
          this.datasourceSchema = {
            name:""
          }
        }
      },
      deleteDatasourceSchema(){
        var ref= this;
        axios.delete(`${process.env.BASE_URL}api/v1/datasource/schema/${this.datasourceSchemaItem}`,TokenStorage.getAuthentication())
          .then((result)=>{
            if(result.data.status=="error"){
              ref.$toast.error(result.data.message + ", " + result.data.data.error);
            }else{
              ref.$toast.success("DatasourceSchema is removed");
              ref.datasourceSchemaItem=undefined;
              ref.loadAll();
            }
          }),function(err){
            ref.$toast.error(err.toString());
          };
      },updateDatasourceSchema(){
        var ref= this;
        if (!this.v$.datasourceSchema.$invalid) {
          // clone the selected item
          var postdata = JSON.parse(JSON.stringify(this.datasourceSchema))
          // and remove status data
          delete postdata.output
          delete postdata.status
          delete postdata.head
          axios.put(`${process.env.BASE_URL}api/v1/datasource/schema/${this.datasourceSchemaItem}`,postdata,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                ref.$toast.success("DatasourceSchema is updated");
                ref.loadAll();
              }
            }),function(err){
              ref.$toast.error(err.toString());
            };
        }else{
          this.$toast.warning("Invalid form data")
        }
      },newDatasourceSchema(){
        var ref= this;
        if (!this.v$.datasourceSchema.$invalid) {
          axios.post(`${process.env.BASE_URL}api/v1/datasource/schema/`,this.datasourceSchema,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                Vue.set(ref,"datasourceSchemaItem",result.data.data.output)
                ref.$toast.success("Created datasourceSchema with new id " + result.data.data.output);
                ref.loadAll();
              }
            }),function(err){
              ref.$toast.error(err.toString());
            };
        }           
      },resetDatasourceSchema(){
        var ref= this;
        axios.post(`${process.env.BASE_URL}api/v1/datasource/schema/${this.datasourceSchemaItem}/reset`,{},TokenStorage.getAuthentication())
        setTimeout(()=>{ref.loadAll()},500)
        this.resetItem()
        this.loadAll()
      },      
      editorInit: function () {
          // vue2-code-editor/node_modules/
          require('brace/ext/language_tools') //language extension prerequsite...
          require('brace/mode/yaml')
          require('brace/theme/monokai')
      }             
    },
    validations: {
      datasourceSchema:{
        name: {
          required,
          regex : helpers.withParams(
              {description: "Must be a valid datasourceSchema name",type:"regex"},
              (value) => !helpers.req(value) || (new RegExp("^[a-zA-Z0-9_]{1,50}$").test(value)) // eslint-disable-line
          )             
        },
        description: {
          regex : helpers.withParams(
              {description: "Is maximum 250 long",type:"regex"},
              (value) => !helpers.req(value) || (new RegExp("^.{1,250}$").test(value)) // eslint-disable-line
          )             
        }
      }
    },
    mounted() { // when the Vue app is booted up, this is run automatically.
        this.loadAll();
        this.interval=setInterval(this.loadDatasourceSchemaList,7000) // reload running jobs every 7s
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
