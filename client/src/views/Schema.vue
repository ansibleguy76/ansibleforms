<template>
  <section class="hero has-background-light is-fullheight">
    <div class="hero-body">
      <div class="container">
        <div class="columns is-centered">
          <div class="column is-6-tablet is-6-desktop is-6-widescreen">
            <div class="notification is-danger" v-if="errorMessage!=''" v-text="errorMessage"></div>
            <div class="notification is-success" v-if="success!=''" v-html="success"></div>
            <div class="notification is-warning" v-if="failed!=''" v-html="failed"></div>
            <form action="" class="box">
              <div class="content">
                If this is the first time setup and you don't have your own schema and tables.<br><br>
                Would you like me to try and create the schema and tables ?<br>
                I would create the following : <br><br>
                <table class="table is-bordered is-striped">
                  <tbody>
                    <tr><th>Databaseschema</th><td>AnsibleForms</td></tr>
                    <tr><th>Tables</th><td>users, groups, ldap, tokens, awx, credentials, jobs, job_output</td></tr>
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
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
  import Vue from 'vue'
  import axios from 'axios'


  export default {
      name: 'Schema',
      props:{
        schema:{type:Object},
        errorMessage:{type:String},
        errorData:{type:Object}
      },
      data() {
          return {
          }
      },
      computed:{
        success(){return this.errorData.output.join('<br>')},
        failed(){return this.errorData.error.join('<br>')}
      },
      methods: {
          create() {
            var ref=this
            axios.post("/api/v1/schema")
              .then((result)=>{
                if(result.data.status!="error"){
                  ref.errorMessage=""
                  ref.$router.push({name:"Login"})
                }else{
                  ref.errorMessage=result.data.message
                }

              }).catch(function (error) {
                  ref.errorMessage=error
              })

          }
      }
  }
</script>
