<template>
  <section class="hero has-background-light is-fullheight">
    <div class="hero-body">
      <div class="container">
        <div class="columns is-centered">
          <div class="column is-6-tablet is-6-desktop is-6-widescreen">
            <div class="notification is-danger" v-if="error!=''" v-text="error"></div>
            <div class="notification is-success" v-if="success" v-html="success"></div>
            <div class="notification is-warning" v-if="failed" v-html="failed"></div>
            <div v-if="error!='Schema creation is disabled'">
              <form action="" class="box" v-if="error!='FATAL ERROR' && error!='' && success==''">
                <div class="content">
                  If this is the first time setup and you don't have your own schema and tables.<br><br>
                  Would you like me to try and create the schema and tables ?<br>
                  I would create the following : <br><br>
                  <table class="table is-bordered is-striped">
                    <tbody>
                      <tr><th>Databaseschema</th><td>AnsibleForms</td></tr>
                      <tr><th>Tables</th><td>All required tables</td></tr>
                      <tr><th>Users</th><td>admin (pw = AnsibleForms!123)</td></tr>
                      <tr><th>Groups</th><td>admins</td></tr>
                      
                    </tbody>
                  </table>
                </div>
                <div class="field">
                  <button class="button is-success" @click="create()">
                    <span class="icon"><font-awesome-icon icon="magic" /></span><span>Create</span>
                  </button>
                </div>
              </form>
              <form action="" class="box" v-else>
                <div class="content">
                  It appears that you have an unuseable schema.  Part of the tables is present, and part is missing.<br>
                  Please contact your database or application administrator to either restore from a backup, or create the missing tables.  
                  For now there is nothing I can do for you, until the schema and tables are in a consistent state.
                </div>
              </form>
            </div>
            <div v-else class="box">
              <div class="content">
                Schema creation is disabled by your administrator.<br>
                Please contact your database or application administrator to create the schema and tables.
              </div>   
            </div>
            <div v-if="error=='FATAL ERROR'" class="box">
              <div class="content">
                Something went wrong.  Most likely the database is simply not reachable.   
              </div>
                
            </div>  
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
  import axios from 'axios'


  export default {
      name: 'AfSchema',
      props:{
        schema:{type:Object},
        errorMessage:{type:String},
        errorData:{type:Object}
      },
      data() {
          return {
              error:(this.errorMessage=="schema and tables are ok")?"":this.errorMessage
          }
      },
      computed:{
        success(){
          if(Array.isArray(this.errorData.output)){
            return this.errorData.output.join('<br>')
          }else {
            return this.errorData.output
          }
        },
        failed(){
          if(Array.isArray(this.errorData.error)){
            return this.errorData.error.join('<br>')
          }else {
            return this.errorData.error
          }
        }
      },
      methods: {
          create() {
            var ref=this
            this.$toast.info("Creating... wait a moment")
            axios.post(`${process.env.BASE_URL}api/v1/schema`,{})
              .then((result)=>{

                if(result.data.status!="error"){
                  ref.error=""
                  this.$toast.success(result.data.message)
                  //setTimeout(()=>{ref.$router.push({name:"Login"})},3000)
                }else{
                  ref.error=result.data.message
                }
                console.log(result)
              }).catch(function (error) {
                  ref.error=error
              })
            console.log("creating")
          }
      }
  }
</script>
