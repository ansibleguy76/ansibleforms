<template>
  <section v-if="isAdmin" class="section">
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="file-lines" /> Logs</h1>
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
          <button :disabled="refresh" class="button is-info level-item" @click="load(true)">
            <span class="icon"><font-awesome-icon icon="arrow-rotate-right" :spin="refresh" /></span>
            <span>Refresh</span>
          </button>
          <span class="level-item"><BulmaCheckRadio checktype="checkbox" v-model="refresh" name="refresh" label="Auto Refresh" /></span>
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

      <log-viewer :log="filtered" autoSroll="true"  />
    </div>
  </section>
</template>
<script>
  import Vue from 'vue'
  import axios from 'axios'
  import Copy from 'copy-to-clipboard'
  import LogViewer from '@femessage/log-viewer'
  import BulmaCheckRadio from './../components/BulmaCheckRadio.vue'
  import TokenStorage from './../lib/TokenStorage'

  export default{
    name: "Logs",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{LogViewer,BulmaCheckRadio},
    data(){
      return  {
          filter:"",
          log:"",
          lines:100,
          lineoptions:[100,200,300,400,500,1000],
          isLoading:false,
          refresh:true
      }
    },
    computed:{
      filtered(){
        if(this.filter){
          return this.log.split("\n").filter(x => x.match(this.filter)).join("\n")
        }else{
          return this.log
        }
      }
    },
    methods:{
      load(force=false){
        var ref=this
        if(!this.isLoading && (this.refresh ||force)){
          this.isLoading=true;
          axios.get(`${process.env.BASE_URL}api/v1/log?lines=${this.lines||100}`,TokenStorage.getAuthentication())
            .then((result)=>{
                if(result.data!="..."){
                  ref.log=result.data
                  ref.isLoading=false
                }
            })
            .catch(function(err){
              //
            })
        }
      }
    },
    mounted() { // when the Vue app is booted up, this is run automatically.
      this.load()
      this.interval=setInterval(this.load,2000)
    },
    beforeDestroy(){
      clearInterval(this.interval)
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
  .log-viewer{
    font-family: monospace;
  }
</style>
