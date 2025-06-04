<template>
  <section v-if="profile?.options?.showSettings ?? isAdmin" class="section">
    <BulmaQuickView class="quickview" v-if="showOutput" title="Last execution result" footer="" @close="showOutput=false">
        <p class="is-family-code" v-html="output.split('\n').join('<br>')"></p>
    </BulmaQuickView>        
    <BulmaModal v-if="showDelete && schedule.name" title="Delete" action="Delete" @click="deleteSchedule();showDelete=false" @close="removeDelete()" @cancel="removeDelete()">Are you sure you want to delete Schedule '{{ schedule.name}}'</BulmaModal>
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="fa-calendar-check" /> Schedules</h1>
      <div class="columns">
        <div class="column is-narrow">
          <BulmaSettingsMenu />
        </div>
        <div class="column">         
          <nav class="level">
            <!-- Left side -->
            <div class="level-left">
              <p class="level-item"><BulmaButton icon="plus" label="New Schedule" @click="scheduleItem=-1;loadSchedule()"></BulmaButton></p>
            </div>
          </nav>
          <div class="columns">
            <div class="column" v-if="scheduleList && scheduleList.length>0">
              <BulmaAdminTable
                :dataList="scheduleList"
                :labels="['Name','Last Run','Status','State']"
                :columns="['name','last_run','status','state']"
                :filters="['name','status']"
                identifier="id"
                :actions="[{name:'select',title:'edit schedule',icon:'pencil-alt',color:'has-text-warning'},{name:'delete',title:'delete schedule',icon:'times',color:'has-text-danger'},{name:'launch',title:'launch schedule',icon:'play',color:'has-text-info'},{name:'output',title:'info',icon:'circle-info',color:'has-text-link'}]"
                :currentItem="scheduleItem"
                @select="selectItem"
                @launch="launchItem"
                @delete="deleteItem"
                @output="outputItem"
              />
            </div>
            <transition name="add-column" appear>
              <div class="column" v-if="scheduleItem!==undefined && !showDelete">
                <BulmaInput icon="heading" v-model="schedule.name" label="Name" placeholder="Schedule name" :readonly="scheduleItem!==-1" :required="true" :hasError="v$.schedule.name.$invalid" :errors="[]" help="Alphanumeric with underscore and hyphen" />
                <BulmaInput icon="stopwatch" v-model="schedule.cron" label="Cron Schedule" placeholder="*/5 * L * 1,3L" :hasError="v$.schedule.cron.$invalid" :errors="[]" help="Minute Hour DayOfMonth Month DayOfWeek" />
                <BulmaInput icon="play" v-model="schedule.form" label="PLaybook" placeholder="Playbook" />
                <p class="has-text-weight-bold">
                  Extra vars (YAML)
                </p>
                <small>Next to the extra vars, the schedule object itself will also be appended and the credentials that are defined in the form.</small>
                <VueCodeEditor
                  v-model="schedule.extra_vars"
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
                <BulmaButton v-if="scheduleItem==-1" icon="save" label="Create Schedule" @click="newSchedule()"></BulmaButton>
                <BulmaButton v-if="scheduleItem!=-1" icon="save" label="Update Schedule" @click="updateSchedule()"></BulmaButton>
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
  import BulmaSettingsMenu from '../components/BulmaSettingsMenu.vue'
  import BulmaQuickView from './../components/BulmaQuickView.vue'
  import VueCodeEditor from './../components/VueCodeEditor';
  import TokenStorage from './../lib/TokenStorage'
  import { useVuelidate } from '@vuelidate/core'
  import { required, helpers } from '@vuelidate/validators'

  export default{
    name:"AfSchedules",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean},
      profile:{type:Object}
    },
    components:{BulmaButton,BulmaInput,BulmaModal,BulmaQuickView,BulmaAdminTable,BulmaSettingsMenu,VueCodeEditor},
    setup(){
      return { v$: useVuelidate() }
    },
    data(){
      return  {
          schedule:{
            id:undefined,
            name:"",
            form:"",
            extra_vars:"",
            cron:""
          },
          interval:undefined,
          showDelete:false,
          scheduleItem:undefined,
          scheduleList:[],
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
        this.loadScheduleList();
        this.loadSchedule();
      },
      loadScheduleList(){
        var ref= this;
        axios.get(`/api/v1/schedule`,TokenStorage.getAuthentication())
          .then((result)=>{
            ref.scheduleList=result.data.data.output
            // correct last run time to local time
            ref.scheduleList.forEach((item)=>{
              if(item.last_run){
                item.last_run=new Date(item.last_run).toLocaleString()
              }
            })
          }),function(err){
            ref.$toast.error(err.toString());
          };
      },
      selectItem(value,showOutput=false){
        this.scheduleItem=value
        this.loadSchedule(showOutput)
      },
      resetItem(){
        this.scheduleItem=undefined
      },
      deleteItem(value){
        this.selectItem(value)
        this.showDelete=true
      },
      launchItem(value){
        this.selectItem(value)
        this.launchSchedule()
      },
      outputItem(value){
        this.selectItem(value,true)
      },    
      removeDelete(){
        this.showDelete=false
        this.resetItem()
      }, 
      loadSchedule(showOutput=false){
        var ref= this;
        if(this.scheduleItem!=undefined && this.scheduleItem!=-1){

          axios.get(`/api/v1/schedule/${this.scheduleItem}`,TokenStorage.getAuthentication())
            .then((result)=>{
              console.log("loaded schedule item");
              ref.schedule=result.data.data.output
              if(showOutput){
                ref.output=this.schedule.output
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
          this.schedule = {
            name:""
          }
        }
      },
      deleteSchedule(){
        var ref= this;
        axios.delete(`/api/v1/schedule/${this.scheduleItem}`,TokenStorage.getAuthentication())
          .then((result)=>{
            if(result.data.status=="error"){
              ref.$toast.error(result.data.message + ", " + result.data.data.error);
            }else{
              ref.$toast.success("Schedule is removed");
              ref.scheduleItem=undefined;
              ref.loadAll();
            }
          }),function(err){
            ref.$toast.error(err.toString());
          };
      },updateSchedule(){
        var ref= this;
        if (!this.v$.schedule.$invalid) {
          // clone the selected item
          var postdata = JSON.parse(JSON.stringify(this.schedule))
          // and remove status data
          delete postdata.output
          delete postdata.status
          delete postdata.head
          axios.put(`/api/v1/schedule/${this.scheduleItem}`,postdata,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                ref.$toast.success("Schedule is updated");
                ref.loadAll();
              }
            }),function(err){
              ref.$toast.error(err.toString());
            };
        }else{
          this.$toast.warning("Invalid form data")
        }
      },newSchedule(){
        var ref= this;
        if (!this.v$.schedule.$invalid) {
          axios.post(`/api/v1/schedule/`,this.schedule,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                Vue.set(ref,"scheduleItem",result.data.data.output)
                ref.$toast.success("Created schedule with new id " + result.data.data.output);
                ref.loadAll();
              }
            }),function(err){
              ref.$toast.error(err.toString());
            };
        }           
      },launchSchedule(){
        var ref= this;
        axios.post(`/api/v1/schedule/${this.scheduleItem}/launch`,{},TokenStorage.getAuthentication())
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
      schedule:{
        name: {
          required           
        },
        cron: {
          regex : helpers.withParams(
              {description: "Cron must be valid format",type:"regex"},
              (value) => !helpers.req(value) || (new RegExp("^[0-9-,*/]+ [0-9-,*/]+ [0-9-,*/L]+ [0-9-,*/]+ [0-9-,*/L]+$").test(value)) // eslint-disable-line
          )                    
        }
      }
    },
    mounted() { // when the Vue app is booted up, this is run automatically.
        this.loadAll();
        this.interval=setInterval(this.loadScheduleList,7000) // reload running jobs every 7s
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
