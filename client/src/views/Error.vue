<template>
  <section class="hero has-background-light is-fullheight">
    <div class="hero-body">
      <div class="container">
        <div class="columns is-centered">
          <div class="column is-5-tablet is-6-desktop is-6-widescreen">
            <div class="notification has-background-warning-light box content" >
              <strong v-if="errorMessage!=''" v-html="errorMessageHtml"></strong><br><br>
              This is the end of the line I'm afraid.<br>
              You'll need to fix a few things, here are some steps:<br>
              <ol>
                <li>Make sure you have a MySQL database running. <a class="button is-small is-primary" href="/#/install">Check</a></li>
                <li>If the AnsibleForms schema is not present, provide root access so I can create it</li>
                <li>Login as local admin</li>
                <li>Double check your environment variables. <a class="button is-small" href="/#/settings">Settings</a></li>
                <li>Check the logfiles. <a class="button is-small" href="/#/logs">Logs</a></li>                
                <li>Make sure you have a valid forms.yaml file.<br>
                    Or make a repository to host your forms. <a class="button is-small is-success" href="/#/repos">Create repository</a></li>
                <li>Double check firewalls, hostname, username and password</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
  import Vue from 'vue'

  export default {
      props:{
        errorMessage:{type:String},
        errorData:{type:Object}
      },
      name: 'AfError',
      data() {
          return {
          }
      },
      computed:{
        errorMessageHtml(){
          return this.errorMessage.replaceAll("\n","<br>").replace("Error: ","")
        }
      },
      methods: {

      }
  }
</script>
