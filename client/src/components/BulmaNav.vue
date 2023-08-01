<template>
  <nav class="navbar is-primary is-spaced has-shadow" role="navigation" aria-label="main navigation">
      <div class="container">
          <div class="navbar-brand">
          <a class="navbar-item" href="/">
              <img src="/assets/img/logo_ansible_forms_full_white.svg" />
          </a>

          <a role="button" class="navbar-burger burger" aria-label="menu" aria-expanded="false" data-target="navbarAnsibleForms" v-on:click="showNav = !showNav" v-bind:class="{ 'is-active' : showNav }">
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
          </a>
          </div>

          <div id="navbarAnsibleForms" class="navbar-menu" v-bind:class="{ 'is-active' : showNav }">
              <div class="navbar-end">
                <router-link class="navbar-item" to="/jobs" v-if="authenticated">
                  <span class="icon"><font-awesome-icon icon="history" /></span><span>Job log </span><span v-if="approvals" class="ml-1 is-warning tag">{{approvals}} {{(approvals==1)?"approval":"approvals"}} waiting</span>
                </router-link>
                <router-link class="navbar-item" :to="'/designer?form='+($route.query.form||'')" v-if="isAdmin && authenticated">
                  <span class="icon"><font-awesome-icon icon="edit" /></span><span>Designer</span>
                </router-link>
                <router-link class="navbar-item" to="/settings" v-if="isAdmin && authenticated">
                      <span class="icon"><font-awesome-icon icon="cog" /></span><span>Settings</span>
                </router-link>
                <div class="navbar-item has-dropdown is-hoverable" v-if="authenticated" >
                  <a class="navbar-link"><span class="icon"><font-awesome-icon icon="question-circle" /></span></a>
                  <div class="navbar-dropdown">
                    <router-link class="navbar-item" v-if="isAdmin && authenticated" to="/logs">
                      <span class="icon"><font-awesome-icon icon="file-lines" /></span><span>Logs</span>
                    </router-link>
                    <a class="navbar-item" href="https://www.ansibleforms.com/" target="_blank">
                      <span class="icon"><font-awesome-icon icon="globe" /></span><span>Documentation</span>
                    </a>
                    <router-link class="navbar-item" to="/reference-guide/forms">
                      <span class="icon"><font-awesome-icon icon="question-circle" /></span><span>Reference Guide</span>
                    </router-link>
                    <a class="navbar-item" href="/api-docs" target="_blank">
                      <span class="icon"><font-awesome-icon icon="code" /></span><span>Api docs</span>
                    </a>
                    <hr class="navbar-divider">
                    <a class="navbar-item" @click="$emit('about')">
                      <span class="icon"><font-awesome-icon icon="code-branch" /></span><span>About v{{version}}</span>
                    </a>
                  </div>
                </div>
                <div class="navbar-item has-dropdown is-hoverable" v-if="authenticated">
                  <a class="navbar-link"><span class="icon"><font-awesome-icon icon="user" /></span> <span>{{ profile.username }}</span></a>
                  <div class="navbar-dropdown">
                    <router-link class="navbar-item" to="/profile" v-if="authenticated && profile.type=='local' && profile.id">
                      <span class="icon"><font-awesome-icon icon="key" /></span><span>Change password</span>
                    </router-link>
                    <router-link class="navbar-item" to="/login" v-on:click.native="logout()" replace>
                      <span class="icon"><font-awesome-icon icon="sign-out-alt" /></span><span>Logout</span>
                    </router-link>
                    <a href="javascript:void" @click="$emit('profile')" class="navbar-item">
                      <span class="icon"><font-awesome-icon icon="address-card" /></span> <span>About me</span>
                    </a>
                  </div>
                </div>
              </div>
          </div>
      </div>
  </nav>
</template>
<script>
  import Vue from 'vue'
  import TokenStorage from '../lib/TokenStorage'
  export default{
    name:"BulmaNav",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean},
      profile:{type:Object},
      version:{type:String},
      approvals:{type:Number}
    },
    data(){
      return  {
          showNav: false
      }
    },methods:{
      logout(){
        this.$emit("logout");
      }
    },mounted(){
    }
  }
</script>
<style scoped>
  .navbar{
    z-index:90000!important;
  }

</style>
