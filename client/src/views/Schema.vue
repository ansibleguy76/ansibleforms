<template>
  <section class="hero has-background-light is-fullheight">
    <div class="hero-body">
      <div class="container">
        <div class="columns is-centered">
          <div class="column is-6-tablet is-6-desktop is-6-widescreen">
            <div class="notification is-info" v-if="errorMessage!=''">
              {{ errorMessage}}
            </div>
            <div class="notification is-danger" v-if="errorMessage2!=''">
              {{ errorMessage2}}
            </div>
            <form v-if="errorMessage!='Failed to connect'" action="" class="box">
              <div class="content">
                If this is the first time setup and you don't have your own schema and tables.<br><br>
                Would you like me to try and create the schema and tables ?<br>
                I would create the following :<br><br>
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
                  Create
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
      name: 'Error',
      props:{
        schema:{type:Object},
        errorMessage:{type:String}
      },
      data() {
          return {
            errorMessage2:""
          }
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
