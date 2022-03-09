<template>
  <section v-if="isAdmin" class="section">
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="file-lines" /> Logs</h1>
      <log-viewer :log="log" autoSroll="true"  />
    </div>
  </section>
</template>
<script>
  import Vue from 'vue'
  import axios from 'axios'
  import Copy from 'copy-to-clipboard'
  import LogViewer from '@femessage/log-viewer'
  import TokenStorage from './../lib/TokenStorage'

  export default{
    name: "Logs",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{LogViewer},
    data(){
      return  {
          log:"",
          isLoading:false
      }
    },
    methods:{
      load(){
        var ref=this
        if(!this.isLoading){
          this.isLoading=true;
          axios.get("/api/v1/log",TokenStorage.getAuthentication())
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
