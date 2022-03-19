<template>
  <section class="section">
    <BulmaModal v-if="showDelete" title="Comfirm" action="Delete" @click="deleteJob(tempJobId);showDelete=false" @close="showDelete=false" @cancel="showDelete=false">Are you sure you want to delete job '{{ tempJobId }}'</BulmaModal>
    <BulmaModal v-if="showRelaunch" title="Comfirm" action="Relaunch" @click="relaunchJob(tempJobId);showRelaunch=false" @close="showRelaunch=false" @cancel="showRelaunch=false">Are you sure you want to relaunch job '{{ tempJobId }}'</BulmaModal>
    <BulmaModal v-if="showAbort" title="Comfirm" action="Abort" @click="abortJob(tempJobId);showAbort=false" @close="showAbort=false" @cancel="showAbort=false">Are you sure you want to abort job '{{ tempJobId }}'</BulmaModal>
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="history" /> Job history
      </h1>
      <nav class="level">
        <div class="level-left">
          <div class="level-item">
            <div class="field">
              <p class="control has-icons-left">
                <input class="input" v-model="filter" type="text" placeholder="Regex">
                <span class="icon is-small is-left">
                  <font-awesome-icon icon="filter" />
                </span>
              </p>
            </div>
          </div>
        </div>
        <div class="level-right">
          <button :disabled="isLoading" class="button is-info level-item" @click="loadJobs(true)">
            <span class="icon"><font-awesome-icon icon="arrow-rotate-right" /></span>
            <span>Refresh</span>
          </button>
          <div class="level-item control has-icons-left">
            <div class="select">
              <select v-model="lines">
                <option selected>100</option>
                <option>200</option>
                <option>300</option>
                <option>400</option>
                <option>500</option>
                <option>1000</option>
              </select>
            </div>
            <div class="icon is-small is-left">
              <font-awesome-icon icon="arrow-down-short-wide" />
            </div>
          </div>
        </div>
      </nav>
      <div>
        <table class="table is-bordered is-narrow">
          <thead>
            <tr class="has-text-left">
              <th class="action"></th>
              <th class="id">id</th>
              <th>form</th>
              <th class="jobtype">job type</th>
              <th class="status">status</th>
              <th>start time</th>
              <th>end time</th>
              <th>user</th>
            </tr>
          </thead>
          <tbody>
          <template v-for="j in displayedJobs">
            <tr :key="j.id" :class="{'has-background-success-light':(j.status=='success' && j.id!=jobId),'has-background-danger-light':(j.status=='failed' && j.id!=jobId),'has-background-warning-light':((j.status=='aborted'||j.status=='warning') && j.id!=jobId),'has-background-info':j.id==jobId,'has-text-white':j.id==jobId}">
              <td class="has-background-info-light">
                <span v-if="j.status!='running'&&j.status!='aborting'&&j.status!='abort'" class="icon has-text-info is-clickable" @click="tempJobId=j.id;showRelaunch=true" title="Relaunch job"><font-awesome-icon icon="redo" /></span>
                <span v-if="j.status && (j.status=='running')" class="icon has-text-warning is-clickable" @click="tempJobId=j.id;showAbort=true" title="Abort job"><font-awesome-icon icon="ban" /></span>
                <span v-if="j.status!='running' && j.status!='aborting' || isAdmin" class="icon has-text-danger is-clickable" @click="tempJobId=j.id;showDelete=true" title="Delete job"><font-awesome-icon icon="trash-alt" /></span>
              </td>
              <td class="is-clickable has-text-left" @click="toggleCollapse(j.id)">
                <span>{{j.id}}</span>
                <template v-if="j.job_type=='multistep'">
                  <span class="icon is-pulled-right" v-if="!collapsed.includes(j.id)"><font-awesome-icon icon="caret-right" /></span>
                  <span class="icon is-pulled-right" v-else><font-awesome-icon icon="caret-down" /></span>
                </template>
              </td>
              <td class="is-clickable has-text-left" @click="loadOutput(j.id)" :title="j.form">{{j.form}}</td>
              <td class="is-clickable has-text-left" @click="loadOutput(j.id)" :title="j.job_type">{{j.job_type || "ansible" }}</td>
              <td class="is-clickable has-text-left" @click="loadOutput(j.id)" :title="j.status">{{j.status}}</td>
              <td class="is-clickable has-text-left" @click="loadOutput(j.id)" :title="j.start">{{ formatTime(j.start) }}</td>
              <td class="is-clickable has-text-left" @click="loadOutput(j.id)" :title="j.end">{{ formatTime(j.end) }}</td>
              <td class="is-clickable has-text-left" @click="loadOutput(j.id)" :title="j.user">{{j.user}} ({{j.user_type}})</td>
            </tr>
            <template v-for="c in childJobs(j.id)">
              <tr :key="c.id" :class="{'has-background-success-light':(c.status=='success' && c.id!=jobId),'has-background-danger-light':(c.status=='failed' && c.id!=jobId),'has-background-warning-light':((c.status=='aborted'||c.status=='warning') && c.id!=jobId),'has-background-info':c.id==jobId,'has-text-white':c.id==jobId}">
                <td class="has-background-info-light">
                  <span v-if="isAdmin" class="icon has-text-danger is-clickable" @click="tempJobId=c.id;showDelete=true" title="Delete job"><font-awesome-icon icon="trash-alt" /></span>
                </td>
                <td class="is-clickable has-text-right" @click="loadOutput(c.id)">{{c.id}}</td>
                <td class="is-clickable has-text-left" @click="loadOutput(c.id)" :title="c.form">{{c.form}}</td>
                <td class="is-clickable has-text-left" @click="loadOutput(c.id)" :title="c.job_type">{{c.job_type || "ansible" }}</td>
                <td class="is-clickable has-text-left" @click="loadOutput(c.id)" :title="c.status">{{c.status}}</td>
                <td class="is-clickable has-text-left" @click="loadOutput(c.id)" :title="c.start">{{ formatTime(c.start) }}</td>
                <td class="is-clickable has-text-left" @click="loadOutput(c.id)" :title="c.end">{{ formatTime(c.start) }}</td>
                <td class="is-clickable has-text-left" @click="loadOutput(c.id)" :title="c.user">{{c.user}} ({{c.user_type}})</td>
              </tr>
            </template>
          </template>
          </tbody>
        </table>
        <nav v-if="!isLoading && parentJobs.length>perPage" class="pagination" role="pagination" aria-label="pagination">
          <a class="pagination-previous" v-if="page != 1" @click="page--">Previous</a>
          <a class="pagination-next" @click="page++" v-if="page < pages.length">Next page</a>
          <ul class="pagination-list">
            <li>
              <a class="pagination-link" v-if="showFirstPage" :class="{'is-current':1==page}" aria-label="Goto page 1" @click="page = 1">1</a>
            </li>
            <li>
              <span class="pagination-ellipsis" v-if="showFirstEllipsis">&hellip;</span>
            </li>
            <li v-for="pageNumber in displayedPages" :key="pageNumber" @click="page = pageNumber">
              <a class="pagination-link" :class="{'is-current':pageNumber==page}" :aria-label="'Goto page '+pageNumber">{{pageNumber}}</a>
            </li>
            <li>
              <span class="pagination-ellipsis" v-if="showLastEllipsis">&hellip;</span>
            </li>
            <li>
              <a class="pagination-link" v-if="showLastPage" :class="{'is-current':page==(pages.length)}" @click="page = pages.length" :aria-label="'Goto page '+pages.length">{{pages.length}}</a>
            </li>
          </ul>
        </nav>
        <div v-if="job"  class="columns">
          <div class="column">
            <h3 class="subtitle">Job output for job {{jobId}}
              <span class="tag is-info mr-1 ml-3">{{ job.job_type || 'ansible'}}</span>
              <span class="tag" :class="{'is-success':job.status=='success','is-danger':job.status=='failed'}">{{ job.status }}</span>
            </h3>
            <button @click="showExtraVars=true" class="button is-info is-small mr-3">
              <span class="icon">
                <font-awesome-icon icon="eye" />
              </span>
              <span>Show Extravars</span>
            </button>
            <button @click="loadOutput(jobId)" v-if="jobId" class="button is-primary is-small">
              <span class="icon">
                <font-awesome-icon icon="sync-alt" />
              </span>
              <span>Refresh</span>
            </button>
            <div class="box mt-3">
              <pre v-html="job.output"></pre>
            </div>
          </div>

          <!-- extra vars column -->
          <div v-if="showExtraVars" class="column is-clipped-horizontal">
            <h3 class="subtitle">Extravars</h3>
            <!-- close extravar view button -->
            <button @click="showExtraVars=false" class="button is-danger is-small">
              <span class="icon">
                <font-awesome-icon icon="times" />
              </span>
              <span>Close</span>
            </button>
            <!-- copy extravars button -->
            <button @click="clip(job.extravars)" class="ml-2 button is-success is-small">
              <span class="icon">
                <font-awesome-icon icon="copy" />
              </span>
              <span>Copy to clipboard</span>
            </button>
            <!-- extravars raw -->
            <div class="box mt-4 is-limited">
              <vue-json-pretty :data="job.extravars"></vue-json-pretty>
            </div>
          </div>
        </div>

      </div>
    </div>
  </section>
</template>
<script>
  import Vue from 'vue'
  import axios from 'axios'
  import BulmaModal from './../components/BulmaModal.vue'
  import moment from 'moment'
  import TokenStorage from './../lib/TokenStorage'
  import VueJsonPretty from 'vue-json-pretty';
  import Copy from 'copy-to-clipboard'
  import 'vue-json-pretty/lib/styles.css';
  Vue.use(moment)

  export default{
    name: "Jobs",
    props:{
      isAdmin:{type:Boolean}
    },
    components:{BulmaModal,VueJsonPretty},
    data(){
      return  {
        jobs : [],
        page: 1,
        perPage: 10,
        buttonsShown:7,
        pages: [],
        isLoading:false,
        job:undefined,
        jobId:undefined,
        showExtraVars:false,
        tempJobId:undefined,
        showDelete:false,
        showRelaunch:false,
        showAbort:false,
        collapsed:[],
        interval:undefined,
        lines:500,
        filter:""
      }
    },
    methods:{
      // copy to clipboard
      clip(v){
        try{
          Copy(v)
          this.$toast.success("Copied to clipboard")
        }catch(e){
          this.$toast.error("Error copying to clipboard : \n" + e)
        }
      },
      toggleCollapse(id){
        if(!this.collapsed.includes(id)){
          this.collapsed.push(id)
        }else{
          for( var i = 0; i < this.collapsed.length; i++){
              if ( this.collapsed[i] === id) {
                  this.collapsed.splice(i, 1);
                  i--;
              }
          }
        }
      },
      getJobIndex(id){
        return this.jobs.map((e)=>e.id).indexOf(id);
      },
      childJobs(id){
        var ref=this
        if(!this.isLoading){
          return this.jobs.filter(x=> (x.parent_id===id && ref.collapsed.includes(id))).sort((a, b) => a.id > b.id && 1 || -1)
        } else {
          return []
        }
      },
      loadJobs(){
        var ref= this;
        if(!this.isLoading){
          this.isLoading=true;
          axios.get(`/api/v1/job?records=${ref.lines}`,TokenStorage.getAuthentication())                               // load forms
            .then((result)=>{
              ref.jobs=result.data.data.output;
              this.setPages();
              this.isLoading=false
            })
            .catch(function(err){
              if(err.response && err.response.status!=401){
                ref.errorMessage="Could not get jobs\n\n" + err
              }else{
                ref.$toast.error("Failed to load jobs")
              }
            })
        }
      },
      loadRunningJobs(){
        var ref= this;
        this.runningJobs.forEach((item, i) => {
          axios.get(`/api/v1/job/${item.id}`,TokenStorage.getAuthentication())                               // load forms
            .then((result)=>{
              var idx = ref.getJobIndex(item.id)
              Vue.set(ref.jobs,idx,result.data.data)
              if(item.id==ref.jobId){
                ref.job=result.data.data
              }
            })
            .catch(function(err){
              console.error(`Error loading job ${item.id} : ${err}`)
            })
        });
      },
      setPages () {
        this.pages=[]
        let numberOfPages = Math.ceil(this.parentJobs.length / this.perPage);
        for (let index = 1; index <= numberOfPages; index++) {
         this.pages.push(index);
        }
      },
      paginate (jobs) {
        let page = this.page;
        let perPage = this.perPage;
        let from = (page * perPage) - perPage;
        let to = (page * perPage);
        return  jobs.slice(from, to);
      },
      formatTime(t){
        var result = ''
        if(t){
          result = moment(t).format('YYYY-MM-DD HH:mm:ss')
        }
        return result
      },
      loadOutput(id){
        var ref=this
        this.jobId=id
        axios.get("/api/v1/job/" + id,TokenStorage.getAuthentication())
          .then((result)=>{
              if(result.data.data!==undefined){
                // import the data if output returned
                ref.job=result.data.data;
                if(ref.job.extravars){
                  ref.job.extravars=JSON.parse(ref.job.extravars)
                }
              }
          })
          .catch(function(err){
            console.log("error getting ansible job " + err)
            ref.$toast.error("Failed to get job output");
          })
      },
      deleteJob(id){
        var ref=this
        this.jobId=id
        axios.delete("/api/v1/job/" + id,TokenStorage.getAuthentication())
          .then((result)=>{
              // console.log(result)
              if(result.data.status=="success"){
                ref.jobOutput=result.data.data.output;
                ref.$toast.success("Job "+id+" is deleted");
                this.loadJobs(true)
                this.tempJobId=undefined
              }else{
                ref.$toast.error("Failed to delete job "+id);
              }
          })
          .catch(function(err){
            console.log("error deleting job " + err)
            ref.$toast.error("Failed to delete job");
          })
      },
      abortJob(id){
        var ref=this
        this.jobId=id
        axios.post("/api/v1/job/" + id + "/abort",TokenStorage.getAuthentication())
          .then((result)=>{
              // console.log(result)
              if(result.data.status=="success"){
                ref.$toast.success(result.data.message);
                this.loadJobs(true)
                this.tempJobId=undefined
              }else{
                ref.$toast.error(result.data.message);
              }
          })
          .catch(function(err){
            console.log("error aborting job " + err)
            ref.$toast.error("Failed to abort job");
          })
      },
      relaunchJob(id){
        var ref=this
        this.jobId=id
        axios.post("/api/v1/job/" + id + "/relaunch",TokenStorage.getAuthentication())
          .then((result)=>{
              // console.log(result)
              if(result.data.status=="success"){
                ref.$toast.success(result.data.message);
                this.loadJobs(true)
                this.tempJobId=undefined
              }else{
                ref.$toast.error(result.data.message);
              }
          })
          .catch(function(err){
            console.log("error relaunching job " + err)
            ref.$toast.error("Failed to relaunch job");
          })
      }
    },
    computed: {
      parentJobs (){
        var ref=this
        if(this.filter){
          return this.jobs.filter(x => !x.parent_id
            &&
              (
                x.id?.toString().match(ref.filter) ||
                x.status?.match(ref.filter) ||
                x.form?.match(ref.filter)  ||
                x.job_type?.match(ref.filter) ||
                x.start?.match(ref.filter) ||
                x.end?.match(ref.filter) ||
                x.user?.match(ref.filter)
              )
          )
        }else{
          return this.jobs.filter(x => !x.parent_id)
        }
      },
      runningJobs(){
        return this.jobs.filter(x => (x.start && this.$moment().diff(x.start,'hours')<6) && (x.status=="running" || x.status=="aborting" || x.status=="abort"))
      },
      displayedJobs () {
          return this.paginate(this.parentJobs);
      },
      displayedPages(){
        var from=this.page-1 // from the first
        if(from==0)from=1     // force on first
        var to = this.page+this.buttonsShown
        // for x from the last
        if(this.page>=this.pages.length-this.buttonsShown){
          from=this.pages.length-this.buttonsShown-1
        }
        // make sure the have the right amount of buttons
        if((to-from)!=this.buttonsShown)to=this.buttonsShown+from
        // if all can be show, show all - otherwise a subset
        if(this.buttonsShown>=this.pages.length){
          return this.pages
        }else{
          return this.pages.slice(from, to)
        }
      },
      showFirstPage(){
        return !(this.displayedPages.includes(1))
      },
      showLastPage(){
        return !(this.displayedPages.includes(this.pages.length))
      },
      showFirstEllipsis(){
        return (this.page>2 && this.pages.length>=2 && !this.displayedPages.includes(2))
      },
      showLastEllipsis(){
        return (!this.displayedPages.includes(this.pages.length-1) && this.page<(this.pages.length-1))
      }

    },
    mounted(){
      this.loadJobs();
      this.interval=setInterval(this.loadRunningJobs,2000)
    },
    beforeDestroy(){
      clearInterval(this.interval)
    }
  }
</script>
<style scoped>

  .table td,.table th{
    max-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .table,table tr {
    width: 100%!important;
  }
  table thead th.action{
    width:7em!important;
    max-width:7em!important;
  }
  table thead th.id{
    width:7em!important;
    max-width:7em!important;
  }
  table thead th.jobtype{
    width:6em!important;
    max-width:6em!important;
  }
  table thead th.status{
    width:6em!important;
    max-width:6em!important;
  }
  .cursor-progress{
    cursor:progress;
  }
  .select, .select select{
    width:100%;
  }
  .is-clipped-horizontal{
    overflow-x: clip;
    overflow-y: visible;
  }
  .is-limited {
    text-overflow: ellipsis;
    width:100%;
    overflow: hidden;
  }
  .is-nowrap{
    white-space:nowrap;
  }
  pre{
    white-space: pre-wrap;       /* Since CSS 2.1 */
    white-space: -moz-pre-wrap;  /* Mozilla, since 1999 */
    white-space: -pre-wrap;      /* Opera 4-6 */
    white-space: -o-pre-wrap;    /* Opera 7 */
    word-wrap: break-word;       /* Internet Explorer 5.5+ */
  }
</style>
