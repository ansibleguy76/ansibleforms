<template>
  <section class="hero has-background-light is-fullheight">
    <div class="hero-body">
      <div class="container">
        <div class="columns is-centered">
          <div class="column is-5-tablet is-6-desktop is-6-widescreen">
            <div class="notification has-background-warning-light box content" v-if="errorMessage!=''">
              <strong v-html="errorMessageHtml"></strong><br><br>
              This is the end of the line I'm afraid.<br>
              You'll need to fix a few things, here are some hints:<br>
              <ul>
                <li>Make sure you have a valid forms.yaml file</li>
                <li>Check your environment variables</li>
                <li>Make sure you have a MySQL database running</li>
                <li>If the AnsibleForms schema is not present, <br>
                  provide root access so I can create it</li>
                <li>Double check firewalls, hostname, username and password</li>
              </ul>
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
      name: 'Error',
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
