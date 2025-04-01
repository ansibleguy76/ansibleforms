<template>
  <nav class="navbar is-primary is-spaced has-shadow" role="navigation" aria-label="main navigation">
      <div class="container">
          <div class="navbar-brand">
            <router-link class="navbar-item" to="/" v-if="authenticated">
              <img src="/assets/img/logo_ansible_forms_full_white.svg" />
            </router-link>
            <router-link class="navbar-item" to="/login" v-else>
              <img src="/assets/img/logo_ansible_forms_full_white.svg" />
            </router-link>            

          <a role="button" class="navbar-burger burger" aria-label="menu" aria-expanded="false" data-target="navbarAnsibleForms" v-on:click="showNav = !showNav" v-bind:class="{ 'is-active' : showNav }">
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
          </a>
          </div>

          <div id="navbarAnsibleForms" class="navbar-menu" v-bind:class="{ 'is-active' : showNav }">
              <div class="navbar-end">
                <router-link class="navbar-item" to="/" v-if="authenticated">
                  <span class="icon"><font-awesome-icon :icon="navHomeIcon" /></span><span>{{ navHomeLabel }}</span>
                </router-link>                
                <router-link class="navbar-item" to="/jobs" v-if="authenticated">
                  <span class="icon"><font-awesome-icon icon="history" /></span><span>Job log </span><span v-if="approvals" class="ml-1 is-warning tag">{{approvals}} {{(approvals==1)?"approval":"approvals"}} waiting</span>
                </router-link>
                <router-link class="navbar-item" :to="'/designer?form='+($route.query.form||'')" v-if="(profile?.options?.showDesigner ?? isAdmin) && authenticated">
                  <span class="icon"><font-awesome-icon icon="edit" /></span><span>Designer</span>
                </router-link>
                <router-link class="navbar-item" to="/settings" v-if="(profile?.options?.showSettings ?? isAdmin) && authenticated">
                      <span class="icon"><font-awesome-icon icon="cog" /></span><span>Settings</span>
                </router-link>
                <div class="navbar-item has-dropdown is-hoverable" v-if="authenticated" >
                  <a class="navbar-link"><span class="icon"><font-awesome-icon icon="question-circle" /></span></a>
                  <div class="navbar-dropdown">
                    <router-link class="navbar-item" v-if="(profile?.options?.showLogs ?? isAdmin) && authenticated" to="/logs">
                      <span class="icon"><font-awesome-icon icon="file-lines" /></span><span>Logs</span>
                    </router-link>
                    <a class="navbar-item" href="https://ansibleforms.com/" target="_blank">
                      <span class="icon"><font-awesome-icon icon="globe" /></span><span>Documentation</span>
                    </a>
                    <router-link class="navbar-item" to="/reference-guide/forms">
                      <span class="icon"><font-awesome-icon icon="question-circle" /></span><span>Reference Guide</span>
                    </router-link>
                    <a class="navbar-item" :href="`${baseUrl}api-docs`" target="_blank">
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
                    <a href="javascript:void" class="navbar-item"  @click="$emit('logout')">
                      <span class="icon"><font-awesome-icon icon="sign-out-alt" /></span><span>Logout</span>
                    </a>
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
          showNav: false,
          baseUrl: "/",
          navHomeLabel:{type:String},
          navHomeIcon:{type:String}
      }
    },
    mounted(){
      this.navHomeLabel = process.env.VUE_APP_NAV_HOME_LABEL || "Forms"
      this.navHomeIcon = process.env.VUE_APP_NAV_HOME_ICON || "rectangle-list"
    }
  }
</script>
<style scoped>
  .navbar{
    z-index:90000!important;
  }

</style>
