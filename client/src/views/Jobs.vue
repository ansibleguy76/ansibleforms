<template>
  <section class="section">
    <BulmaModal v-if="showDelete" title="Delete" action="Delete" @click="deleteJob(tempJobId);showDelete=false" @close="showDelete=false" @cancel="showDelete=false">Are you sure you want to delete job '{{ tempJobId }}'</BulmaModal>
    <BulmaModal v-if="showRelaunch" title="Relaunch" action="Relaunch" @click="relaunchJob(tempJobId);showRelaunch=false" @close="showRelaunch=false" @cancel="showRelaunch=false">Are you sure you want to relaunch job '{{ tempJobId }}'</BulmaModal>
    <BulmaModal v-if="showAbort" title="Abort" action="Abort" @click="abortJob(tempJobId);showAbort=false" @close="showAbort=false" @cancel="showAbort=false">Are you sure you want to abort job '{{ tempJobId }}'</BulmaModal>
    <BulmaModal v-if="showApprove" :title="approvalTitle" action="Approve" @click="approveJob(jobId);showApprove=false" @close="showApprove=false" @cancel="showApprove=false">You are about to approve job '{{ jobId }}'<br><div v-if="approvalMessage" class="is-divider" data-content="Approval info"></div><div v-html="approvalMessage"></div></BulmaModal>
    <BulmaModal v-if="showReject" title="Reject" action="Reject" @click="rejectJob(jobId);showReject=false" @close="showReject=false" @cancel="showReject=false">You are about to reject job '{{ jobId }}'<br><div v-if="approvalMessage" class="is-divider" data-content="Approval info"></div><div v-html="approvalMessage"></div></BulmaModal>
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="history" /> Job log
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
          <button :disabled="isLoading" class="button is-info level-item" @click="loadJobs()">
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
            <tr :key="j.id" :class="{'has-background-success-light':(j.status=='success' && j.id!=jobId),'has-background-danger-light':(j.status=='failed' && j.id!=jobId),'has-background-warning':(j.status=='approve' && j.id!=jobId),'has-text-black':(j.status=='approve' && j.id!=jobId),'has-background-warning-light':(['aborted','warning','rejected'].includes(j.status) && j.id!=jobId),'has-background-info':j.id==jobId,'has-text-white':j.id==jobId}">
              <td class="has-background-info-light">
                <span v-if="j.status!='running'&&j.status!='aborting'&&j.status!='abort'" class="icon has-text-info is-clickable" @click="tempJobId=j.id;showRelaunch=true" title="Relaunch job"><font-awesome-icon icon="redo" /></span>
                <span v-if="j.status && (j.status=='running')" class="icon has-text-warning is-clickable" @click="tempJobId=j.id;showAbort=true" title="Abort job"><font-awesome-icon icon="ban" /></span>
                <span v-if="j.status!='running' && j.status!='aborting' || isAdmin" class="icon has-text-danger is-clickable" @click="tempJobId=j.id;showDelete=true" title="Delete job"><font-awesome-icon icon="trash-alt" /></span>
                <span v-if="j.status=='approve'" class="icon has-text-success is-clickable" @click="showApproval(j.id)" title="Approve job"><font-awesome-icon icon="circle-check" /></span>
                <span v-if="j.status=='approve'" class="icon has-text-danger is-clickable" @click="showApproval(j.id,true)" title="Reject job"><font-awesome-icon icon="circle-xmark" /></span>
              </td>
              <td class="is-clickable has-text-left" @click="(j.job_type=='multistep')?toggleCollapse(j.id):loadOutput(j.id)">
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
                  <!-- <span v-if="isAdmin" class="icon has-text-danger is-clickable" @click="tempJobId=c.id;showDelete=true" title="Delete job"><font-awesome-icon icon="trash-alt" /></span> -->
                </td>
                <td class="is-clickable has-text-right" @click="jobId=c.id">{{c.id}}</td>
                <td class="is-clickable has-text-left" @click="jobId=c.id" :title="c.target">{{c.target}}</td>
                <td class="is-clickable has-text-left" @click="jobId=c.id" :title="c.job_type">{{c.job_type || "ansible" }}</td>
                <td class="is-clickable has-text-left" @click="jobId=c.id" :title="c.status">{{c.status}}</td>
                <td class="is-clickable has-text-left" @click="jobId=c.id" :title="c.start">{{ formatTime(c.start) }}</td>
                <td class="is-clickable has-text-left" @click="jobId=c.id" :title="c.end">{{ formatTime(c.start) }}</td>
                <td class="is-clickable has-text-left" @click="jobId=c.id" :title="c.user">{{c.user}} ({{c.user_type}})</td>
              </tr>
            </template>
          </template>
          </tbody>
        </table>
        <BulmaNavigation
          v-if="!isLoading"
          :dataList="parentJobs"
          :perPage="10"
          :buttonsShown="7"
          :index="displayedJobIndex"
          @change="setDisplayJobs"
        />
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
              <div class="columns">
                <div v-if="job" class="column">
                  <h3 v-if="subjobId" class="subtitle">Main job (jobid {{jobId}})  <span class="tag" :class="jobClass(job.status)">{{ job.status}}</span></h3>
                  <pre v-if="job.output" v-html="job.output"></pre>
                </div>
                <div v-if="subjobId && subjob && !showExtraVars" class="column">
                  <h3 class="subtitle">Current step (jobid {{subjobId}})  <span class="tag" :class="jobClass(job.status)">{{ job.status}}</span></h3>
                  <pre v-if="subjob.output" v-html="subjob.output"></pre>
                  <pre v-else><font-awesome-icon icon="spinner" spin /></pre>
                </div>
              </div>
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
  import BulmaNavigation from './../components/BulmaNavigation.vue'
  import moment from 'moment'
  import TokenStorage from './../lib/TokenStorage'
  import VueJsonPretty from 'vue-json-pretty';
  import Copy from 'copy-to-clipboard'
  import 'vue-json-pretty/lib/styles.css';

  export default{
    name: "Jobs",
    props:{
      isAdmin:{type:Boolean},
      profile:{type:Object}
    },
    components:{BulmaModal,VueJsonPretty,BulmaNavigation},
    data(){
      return  {
        jobs : [],
        displayedJobs: [],
        isLoading:false,
        job:undefined,
        jobId:undefined,
        approvalMessage:"",
        approvalTitle:"",
        showExtraVars:false,
        tempJobId:undefined,
        showDelete:false,
        showRelaunch:false,
        showAbort:false,
        showApprove:false,
        showReject:false,
        collapsed:[],
        interval:undefined,
        interval2:undefined,
        lines:500,
        noOfRecords:0,
        filter:""
      }
    },
    watch:{
        $route (to, from){
            if(this.$route.params.id){
              this.jobId=this.$route.params.id
              this.loadOutput(this.jobId)
            }
        },
        jobId (to,from){
          this.loadOutput(this.jobId)
        }
    } ,
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
      setDisplayJobs(jobs){
        this.displayedJobs=jobs
      },
      jobClass(status){
        if(status=="success"){
          return "is-success"
        }
        if(status=="running"){
          return "is-info"
        }
        if(status=="warning" || status=="aborted"){
          return "is-warning"
        }
        if(status=="failed"){
          return "is-danger"
        }
        return ""
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
      loadJobs(first=false){
        var ref= this;
        if(!this.isLoading){
          this.isLoading=true;
          axios.get(`/api/v1/job?records=${ref.lines}`,TokenStorage.getAuthentication())                               // load forms
            .then((result)=>{
              ref.jobs=result.data.data.output;
              ref.isLoading=false
              // if(first && ref.jobId){
              //   ref.jobIndex=ref.displayedJobIndex
              // }
            })
            .catch(function(err){
              if(err.response && err.response.status!=401){
                ref.errorMessage="Could not get jobs\n\n" + err
              }else{
                //ref.$toast.error("Failed to load jobs")
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
              if(result.data.data && ref.noOfRecords!=result.data.data.no_of_records){
                ref.loadJobs() // no of records changed ; reload jobs
                ref.noOfRecords=result.data.data.no_of_records
              }
              Vue.set(ref.jobs,idx,result.data.data)
              if(item.id==ref.jobId){
                ref.job=result.data.data
              }
              ref.$emit('refreshApprovals')
            })
            .catch(function(err){
              console.error(`Error loading job ${item.id} : ${err}`)
            })
        });
      },
      formatTime(t){
        var result = ''
        if(t){
          result = moment(t).format('YYYY-MM-DD HH:mm:ss')
        }
        return result
      },
      loadOutput(id,sub=false){
        var ref=this
        if(!sub)this.jobId=id
        axios.get("/api/v1/job/" + id,TokenStorage.getAuthentication())
          .then((result)=>{
              if(result.data.data!==undefined){
                // import the data if output returned
                if(!sub){
                  ref.job=result.data.data;
                  if(ref.job.extravars){
                    ref.job.extravars=JSON.parse(ref.job.extravars)
                    ref.job.approval=JSON.parse(ref.job.approval)
                  }
                  if(ref.subjobId)
                    ref.loadOutput(ref.subjobId,true)
                }else{
                  var idx = ref.getJobIndex(id)
                  Vue.set(ref.jobs,idx,result.data.data)
                }
              }
          })
          .catch(function(err){
            console.log("error getting ansible job " + err)
            //ref.$toast.error("Failed to get job output");
          })
      },
      showApproval(id,reject){
        var ref=this
        this.jobId=id
        axios.get("/api/v1/job/" + id,TokenStorage.getAuthentication())
          .then((result)=>{
              if(result.data.data!==undefined){
                // import the data if output returned
                ref.job=result.data.data;
                if(ref.job.extravars && ref.job.approval){
                  ref.job.extravars=JSON.parse(ref.job.extravars) || {}
                  ref.job.approval=JSON.parse(ref.job.approval) || {}
                  ref.approvalMessage=ref.replacePlaceholders(ref.job.approval?.message)
                  ref.approvalTitle=ref.replacePlaceholders(ref.job.apprival?.title) || "Approve"
                  if(ref.job.approval){
                    if(reject){
                      ref.showReject=true
                    }else{
                      ref.showApprove=true
                    }

                  }else{
                    ref.$toast.error("No approval information for this job found");
                  }
                }else{
                  ref.approvalMessage=""
                  ref.approvalTitle=ref.replacePlaceholders(ref.job.apprival?.title) || "Approve"
                  if(reject){
                    ref.showReject=true
                  }else{
                    ref.showApprove=true
                  }
                }

              }
          })
          .catch(function(err){
            console.log("error getting ansible job " + err)
            ref.$toast.error("Failed to get job output");
          })

      },
      replacePlaceholders(msg){
        var ref=this
        if(!msg){
          return ""
        }
        return msg.replace(
          /\$\(([^\)]+)\)/g, // eslint-disable-line
          (placeholderWithDelimiters, placeholderWithoutDelimiters) =>
            ref.findExtravar(ref.job.extravars,placeholderWithoutDelimiters) || placeholderWithDelimiters
        );
      },
      findExtravar(data,expr){
        // convert expr into actual data
        // svm.lif.ipaddress => data["svm"]["lif"]["ipaddress"]
        // using reduce, which is a recursive function
        var outputValue=""
        // outputValue=expr.split(/\s*\.\s*/)
        expr.split(/\s*\.\s*/).reduce((master,obj, level,arr) => {
          // if last
          if (level === (arr.length - 1)){
              // the last piece we assign the value to
              try{
                outputValue=master[obj]
              }catch(e){
                outputValue="/bad placeholder/"
              }

          }else{
              // initialize first time to object
              outputValue=master
          }
          // return the result for next reduce iteration
          return master[obj]

        },data);
        return outputValue
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
                this.loadJobs()
                this.tempJobId=undefined
              }else{
                ref.$toast.error("Failed to delete job "+id);
              }
              ref.$emit('refreshApprovals')
          })
          .catch(function(err){
            console.log("error deleting job " + err)
            ref.$toast.error("Failed to delete job");
          })
      },
      abortJob(id){
        var ref=this
        this.jobId=id
        axios.post("/api/v1/job/" + id + "/abort",{},TokenStorage.getAuthentication())
          .then((result)=>{
              // console.log(result)
              if(result.data.status=="success"){
                ref.$toast.success(result.data.message);
                this.loadJobs()
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
        axios.post("/api/v1/job/" + id + "/relaunch",{},TokenStorage.getAuthentication())
          .then((result)=>{
              // console.log(result)
              if(result.data.status=="success"){
                ref.$toast.success(result.data.message);
                this.loadJobs()
                this.tempJobId=undefined
              }else{
                ref.$toast.error(result.data.message);
              }
              ref.$emit('refreshApprovals')
          })
          .catch(function(err){
            console.log("error relaunching job " + err)
            ref.$toast.error("Failed to relaunch job");
          })
      },
      approveJob(id){
        var ref=this
        this.jobId=id
        axios.post("/api/v1/job/" + id + "/approve",{},TokenStorage.getAuthentication())
          .then((result)=>{
              // console.log(result)
              if(result.data.status=="success"){
                ref.$toast.success(result.data.message);
                this.loadJobs()
                this.loadOutput(id)
                this.tempJobId=undefined
                this.$emit('refreshApprovals')
              }else{
                ref.$toast.error(result.data.message);
              }
          })
          .catch(function(err){
            console.log("error approving job " + err)
            ref.$toast.error("Failed to approve job");
          })
      },
      rejectJob(id){
        var ref=this
        this.jobId=id
        axios.post("/api/v1/job/" + id + "/reject",{},TokenStorage.getAuthentication())
          .then((result)=>{
              // console.log(result)
              if(result.data.status=="success"){
                ref.$toast.success(result.data.message);
                this.loadJobs()
                this.loadOutput(id)
                this.tempJobId=undefined
                this.$emit('refreshApprovals')
              }else{
                ref.$toast.error(result.data.message);
              }
          })
          .catch(function(err){
            console.log("error rejecting job " + err)
            ref.$toast.error("Failed to reject job");
          })
      }
    },
    computed: {
      allowedJobs (){
        var ref=this
        return this.jobs?.filter(x => {
          if(ref.profile?.roles?.includes("admin"))return true
          if(!x.approval)return true
          // not admin and approval - lets check access
          var approval=JSON.parse(x.approval)
          var access = approval?.roles?.filter(role => ref.profile?.roles?.includes(role))
          if(access?.length>0){
            return true
          }else {
            return false
          }
        })
      },
      displayedJobIndex(){
        if(this.jobId)
          return this.parentJobs.map((e)=>e.id).indexOf(this.jobId);
        else {
          return -1
        }
      },
      parentJobs (){
        var ref=this
        if(this.filter){
          return this.allowedJobs.filter(x => !x.parent_id
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
          return this.allowedJobs.filter(x => !x.parent_id)
        }
      },
      runningJobs(){
          return this.jobs.filter(x => (x.start && moment().diff(x.start,'hours')<6) && (x.status=="running" || x.status=="aborting" || x.status=="abort"))
      },
      subjobs(){
        if(this.job && this.job.subjobs){
          return this.job.subjobs.split(",").map(x => parseInt(x))
        }else{
          return []
        }
      },
      subjobId(){
        return this.subjobs.slice(-1)[0]
      },
      subjob(){
        var ref=this
        return this.jobs?.filter(x=>x.id==ref.subjobId)[0]
      }
    },
    mounted(){
      if(this.$route.params.id){
        this.jobId=this.$route.params.id
        this.loadOutput(parseInt(this.jobId))
      }
      this.loadJobs(true);
      this.$emit('refreshApprovals')
      this.interval=setInterval(this.loadRunningJobs,2000) // reload running jobs every 2s
    },
    beforeDestroy(){
      clearInterval(this.interval)
      clearInterval(this.interval2)
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
    width:8em!important;
    max-width:8em!important;
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
@-webkit-keyframes spinAround{from{-webkit-transform:rotate(0);transform:rotate(0)}to{-webkit-transform:rotate(359deg);transform:rotate(359deg)}}@keyframes spinAround{from{-webkit-transform:rotate(0);transform:rotate(0)}to{-webkit-transform:rotate(359deg);transform:rotate(359deg)}}.is-divider,.is-divider-vertical{display:block;position:relative;border-top:.1rem solid #dbdbdb;height:.1rem;margin:2rem 0;text-align:center}.is-divider-vertical[data-content]::after,.is-divider[data-content]::after{background:#fff;color:#b5b5b5;content:attr(data-content);display:inline-block;font-size:.75rem;padding:.4rem .8rem;-webkit-transform:translateY(-1.1rem);transform:translateY(-1.1rem);text-align:center}@media screen and (min-width:769px),print{.is-divider-vertical{display:block;flex:none;width:auto;height:auto;padding:2rem;margin:0;position:relative;border-top:none;min-height:2rem}.is-divider-vertical::before{border-left:.1rem solid #dbdbdb;bottom:1rem;content:"";display:block;left:50%;position:absolute;top:1rem;-webkit-transform:translateX(-50%);transform:translateX(-50%)}.is-divider-vertical[data-content]::after{position:absolute;left:50%;top:50%;padding:.1rem;-webkit-transform:translateY(-50%) translateX(-50%);transform:translateY(-50%) translateX(-50%)}}.is-divider-vertical.is-white,.is-divider.is-white{border-top-color:#fff}.is-divider-vertical.is-white[data-content]::after,.is-divider.is-white[data-content]::after{background:#0a0a0a;color:#fff}.is-divider-vertical.is-white::before,.is-divider.is-white::before{border-left-color:#fff}.is-divider-vertical.is-black,.is-divider.is-black{border-top-color:#0a0a0a}.is-divider-vertical.is-black[data-content]::after,.is-divider.is-black[data-content]::after{background:#fff;color:#0a0a0a}.is-divider-vertical.is-black::before,.is-divider.is-black::before{border-left-color:#0a0a0a}.is-divider-vertical.is-light,.is-divider.is-light{border-top-color:#f5f5f5}.is-divider-vertical.is-light[data-content]::after,.is-divider.is-light[data-content]::after{background:#363636;color:#f5f5f5}.is-divider-vertical.is-light::before,.is-divider.is-light::before{border-left-color:#f5f5f5}.is-divider-vertical.is-dark,.is-divider.is-dark{border-top-color:#363636}.is-divider-vertical.is-dark[data-content]::after,.is-divider.is-dark[data-content]::after{background:#f5f5f5;color:#363636}.is-divider-vertical.is-dark::before,.is-divider.is-dark::before{border-left-color:#363636}.is-divider-vertical.is-primary,.is-divider.is-primary{border-top-color:#00d1b2}.is-divider-vertical.is-primary[data-content]::after,.is-divider.is-primary[data-content]::after{background:#fff;color:#00d1b2}.is-divider-vertical.is-primary::before,.is-divider.is-primary::before{border-left-color:#00d1b2}.is-divider-vertical.is-link,.is-divider.is-link{border-top-color:#3273dc}.is-divider-vertical.is-link[data-content]::after,.is-divider.is-link[data-content]::after{background:#fff;color:#3273dc}.is-divider-vertical.is-link::before,.is-divider.is-link::before{border-left-color:#3273dc}.is-divider-vertical.is-info,.is-divider.is-info{border-top-color:#209cee}.is-divider-vertical.is-info[data-content]::after,.is-divider.is-info[data-content]::after{background:#fff;color:#209cee}.is-divider-vertical.is-info::before,.is-divider.is-info::before{border-left-color:#209cee}.is-divider-vertical.is-success,.is-divider.is-success{border-top-color:#23d160}.is-divider-vertical.is-success[data-content]::after,.is-divider.is-success[data-content]::after{background:#fff;color:#23d160}.is-divider-vertical.is-success::before,.is-divider.is-success::before{border-left-color:#23d160}.is-divider-vertical.is-warning,.is-divider.is-warning{border-top-color:#ffdd57}.is-divider-vertical.is-warning[data-content]::after,.is-divider.is-warning[data-content]::after{background:rgba(0,0,0,.7);color:#ffdd57}.is-divider-vertical.is-warning::before,.is-divider.is-warning::before{border-left-color:#ffdd57}.is-divider-vertical.is-danger,.is-divider.is-danger{border-top-color:#ff3860}.is-divider-vertical.is-danger[data-content]::after,.is-divider.is-danger[data-content]::after{background:#fff;color:#ff3860}.is-divider-vertical.is-danger::before,.is-divider.is-danger::before{border-left-color:#ff3860}.is-divider-vertical.is-black-bis,.is-divider.is-black-bis{border-top-color:#121212}.is-divider-vertical.is-black-bis[data-content]::after,.is-divider.is-black-bis[data-content]::after{background:#fff;color:#121212}.is-divider-vertical.is-black-bis::before,.is-divider.is-black-bis::before{border-left-color:#121212}.is-divider-vertical.is-black-ter,.is-divider.is-black-ter{border-top-color:#242424}.is-divider-vertical.is-black-ter[data-content]::after,.is-divider.is-black-ter[data-content]::after{background:#fff;color:#242424}.is-divider-vertical.is-black-ter::before,.is-divider.is-black-ter::before{border-left-color:#242424}.is-divider-vertical.is-grey-darker,.is-divider.is-grey-darker{border-top-color:#363636}.is-divider-vertical.is-grey-darker[data-content]::after,.is-divider.is-grey-darker[data-content]::after{background:#fff;color:#363636}.is-divider-vertical.is-grey-darker::before,.is-divider.is-grey-darker::before{border-left-color:#363636}.is-divider-vertical.is-grey-dark,.is-divider.is-grey-dark{border-top-color:#4a4a4a}.is-divider-vertical.is-grey-dark[data-content]::after,.is-divider.is-grey-dark[data-content]::after{background:#fff;color:#4a4a4a}.is-divider-vertical.is-grey-dark::before,.is-divider.is-grey-dark::before{border-left-color:#4a4a4a}.is-divider-vertical.is-grey,.is-divider.is-grey{border-top-color:#7a7a7a}.is-divider-vertical.is-grey[data-content]::after,.is-divider.is-grey[data-content]::after{background:#fff;color:#7a7a7a}.is-divider-vertical.is-grey::before,.is-divider.is-grey::before{border-left-color:#7a7a7a}.is-divider-vertical.is-grey-light,.is-divider.is-grey-light{border-top-color:#b5b5b5}.is-divider-vertical.is-grey-light[data-content]::after,.is-divider.is-grey-light[data-content]::after{background:#fff;color:#b5b5b5}.is-divider-vertical.is-grey-light::before,.is-divider.is-grey-light::before{border-left-color:#b5b5b5}.is-divider-vertical.is-grey-lighter,.is-divider.is-grey-lighter{border-top-color:#dbdbdb}.is-divider-vertical.is-grey-lighter[data-content]::after,.is-divider.is-grey-lighter[data-content]::after{background:rgba(0,0,0,.7);color:#dbdbdb}.is-divider-vertical.is-grey-lighter::before,.is-divider.is-grey-lighter::before{border-left-color:#dbdbdb}.is-divider-vertical.is-white-ter,.is-divider.is-white-ter{border-top-color:#f5f5f5}.is-divider-vertical.is-white-ter[data-content]::after,.is-divider.is-white-ter[data-content]::after{background:rgba(0,0,0,.7);color:#f5f5f5}.is-divider-vertical.is-white-ter::before,.is-divider.is-white-ter::before{border-left-color:#f5f5f5}.is-divider-vertical.is-white-bis,.is-divider.is-white-bis{border-top-color:#fafafa}.is-divider-vertical.is-white-bis[data-content]::after,.is-divider.is-white-bis[data-content]::after{background:rgba(0,0,0,.7);color:#fafafa}.is-divider-vertical.is-white-bis::before,.is-divider.is-white-bis::before{border-left-color:#fafafa}
</style>
