<template>
  <section class="section">
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="history" /> Job history
        <button @click="loadJobs" class="button is-primary is-small is-pulled-right">
          <span class="icon">
            <font-awesome-icon icon="sync-alt" />
          </span>
          <span>Refresh</span>
        </button>
      </h1>
      <div>
        <table v-if="isLoaded" class="table is-bordered is-fullwidth">
          <thead>
            <tr class="has-text-centered">
              <th style="width:100px">id</th>
              <th>status</th>
              <th>start time</th>
              <th>end time</th>
            </tr>
          </thead>
          <tbody>
          <tr v-for="j in displayedJobs" :key="j.id" class="is-clickable has-text-centered" @click="loadOutput(j.id)" :class="{'has-background-success-light':(j.status=='success' && j.id!=jobId),'has-background-danger-light':(j.status=='error' && j.id!=jobId),'has-background-warning-light':(j.status=='aborted' && j.id!=jobId),'has-background-info':j.id==jobId,'has-text-white':j.id==jobId}">
            <td>{{j.id}}</td>
            <td>{{j.status}}</td>
            <td>{{j.start | moment('YYYY-MM-DD HH:mm:ss')}}</td>
            <td>{{j.end | moment('YYYY-MM-DD HH:mm:ss')}}</td>
          </tr>
          </tbody>
        </table>
        <nav v-if="isLoaded" class="pagination" role="pagination" aria-label="pagination">
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
        <div v-if="jobOutput" class="box mt-3">
          <h3 class="subtitle">Job output for job {{jobId}}
            <button @click="loadOutput(jobId)" v-if="jobId" class="button is-primary is-small is-pulled-right">
              <span class="icon">
                <font-awesome-icon icon="sync-alt" />
              </span>
              <span>Refresh</span>
            </button>
          </h3>
          <pre v-html="jobOutput"></pre>
        </div>
      </div>
    </div>
  </section>
</template>
<script>
  import Vue from 'vue'
  import axios from 'axios'
  import BulmaButton from './../components/BulmaButton.vue'
  import moment from 'vue-moment'
  import TokenStorage from './../lib/TokenStorage'

  Vue.use(moment)

  export default{
    name: "Jobs",
    props:{
    },
    components:{},
    data(){
      return  {
        jobs : [],
        page: 1,
        perPage: 10,
        buttonsShown:7,
        pages: [],
        isLoaded:false,
        jobOutput:"",
        jobId:undefined
      }
    },
    methods:{
      loadJobs(){
        var ref= this;
        axios.get(`/api/v1/job?timestamp=${new Date().getTime()}`,TokenStorage.getAuthentication())                               // load forms
          .then((result)=>{
            ref.jobs=result.data.data.output;
            this.setPages();
            this.isLoaded=true
          })
          .catch(function(err){
            if(err.response && err.response.status!=401){
              ref.errorMessage="Could not get jobs\n\n" + err
            }else{
              ref.$toast.error("Failed to load jobs")
            }
          })
      },
      setPages () {
        this.pages=[]
        let numberOfPages = Math.ceil(this.jobs.length / this.perPage);
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
      loadOutput(id){
        var ref=this
        this.jobId=id
        axios.get("/api/v1/ansible/job/" + id,TokenStorage.getAuthentication())
          .then((result)=>{
              if(result.data.data!==undefined){
                // import the data if output returned
                if(result.data.data.output!=""){
                  ref.jobOutput=result.data.data.output;
                }
              }
          })
          .catch(function(err){
            console.log("error getting ansible job " + err)
            ref.$toast.error("Failed to get job output");
          })
      }
    },
    computed: {
      displayedJobs () {
        return this.paginate(this.jobs);
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
