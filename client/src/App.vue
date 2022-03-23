<template>
  <div id="app">
    <BulmaModal v-if="showAbout" title="About" href="https://github.com/ansibleguy76/ansibleforms" action="View on Github" :icon="['fab','github']" @close="showAbout=false;showEasterEgg=false" @cancel="showAbout=false;showEasterEgg=false">
        <div class="field is-grouped is-grouped-multiline">
          <div class="control">
            <h1 class="title"><strong>AnsibleForms</strong></h1>
          </div>
          <div class="control">
            <div class="tags has-addons">
              <span class="tag is-dark">build</span>
              <span class="tag is-link">v{{version}}</span>
            </div>
          </div>
        </div>
        <p class="is-size-7 is-unselectable">
          Copyright © 2021 AnsibleGuy<br>
          <br>
          This program is free software: you can redistribute it and/or modify
          it under the terms of the <strong>GNU General Public License</strong> as published by
          the Free Software Foundation, either version 3 of the License, or
          (at your option) any later version.<br>
          <br>
          This program is distributed in the hope that it will be useful,
          but WITHOUT ANY WARRANTY; without even the implied warranty of
          MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
          GNU General Public License for more details.<br>

          <br>You can find the GNU General Public License at
          <a target="_blank" href="http://www.gnu.org/licenses/">http://www.gnu.org/licenses/</a><br>
          <br>
        </p>
        <span  v-if="!showEasterEgg" class="icon is-pulled-right has-text-grey-lighter"><font-awesome-icon @dblclick="showEasterEgg=true" icon="egg" /></span>
        <div v-if="showEasterEgg" class="tags has-addons is-unselectable">
          <span class="tag is-dark">Special thanks to</span>
          <span class="tag is-warning">{{ thanks.join(', ')}}</span>
        </div>
    </BulmaModal>
    <BulmaNav :isAdmin="isAdmin" @about="showAbout=true" :authenticated="authenticated" :profile="profile" @logout="logout()" :version="version" />
    <router-view :isAdmin="isAdmin" :profile="profile" :authenticated="authenticated" :errorMessage="errorMessage" :errorData="errorData" @authenticated="login()" @logout="logout()" />
  </div>
</template>
<script>
  import BulmaNav from './components/BulmaNav.vue'
  import BulmaModal from './components/BulmaModal.vue'
  import axios from 'axios'
  import TokenStorage from './lib/TokenStorage'
  export default{
    components:{BulmaNav,BulmaModal},
    name:"AnsibleForms",
    data(){
      return{
        formConfig:undefined,
        errorMessage:"",
        errorData:{success:[],failed:[]},
        profile:{},
        authenticated:false,
        isAdmin:false,
        version:"unknown",
        showAbout:false,
        showEasterEgg:false,
        thanks:[
          "A. Bronder",
          "H. Marko",
          "S. Mer",
          "J. Szkudlarek",
          "J. Burkle",
          "A. Mikhaylov"
        ]
      }
    },
    computed: {
    },
    beforeMount() {
      this.loadVersion()
      this.checkDatabase()
    },
    methods: {
        refreshAuthenticated(){
          this.authenticated = TokenStorage.isAuthenticated()
          // console.log("checking if is admin")
          var payload = TokenStorage.getPayload()
          if(payload.user && payload.user.roles){
            this.isAdmin=payload.user.roles.includes("admin")
          }
        },
        loadVersion(){
          var ref=this;

          axios.get('/api/v1/version')                               // check database
            .then((result)=>{
              if(result.data.status=="success"){
                ref.version=result.data.message
              }
            })
            .catch(function(err){
              // silent fail
            });
        },
        checkDatabase(){
          var ref=this;

          axios.get('/api/v1/schema')                               // check database
            .then((result)=>{
              if(result.data.status=="error"){
                ref.errorMessage=result.data.message;
                ref.errorData=result.data.data;
                if(!ref.errorMessage)ref.errorMessage="Unknown error"
                if(typeof ref.errorMessage=="object"){ref.errorMessage=ref.errorMessage.message}
                if(ref.errorMessage.startsWith("ERROR")){ // actual error, send to error page
                  ref.errorMessage="Failed to check AnsibleForms database schema\n\n" + ref.errorMessage;
                  ref.$router.replace({name:"Error"}).catch(err => {});
                }else{ // not a real error, send to schema page
                  ref.$router.replace({name:"Schema"}).catch(err => {});
                }
              }else{
                this.login()
              }

            })
            .catch(function(err){
              ref.$toast.error("Failed to check AnsibleForms database schema");
              ref.errorMessage="Failed to check AnsibleForms database schema\n\n" + err
              ref.$router.replace({name:"Error"}).catch(err => {});
            });

        },
        loadProfile(){
          var ref=this;
          var payload = TokenStorage.getPayload()
          ref.profile = payload.user
        },
        resetProfile(){
          this.profile={}
        },
        login(){
          var ref= this;
          if(!TokenStorage.isAuthenticated()){
            //this.$toast.error("You need to authenticate")
            if(this.$route.name!="Login"){
              this.$router.replace({ name: "Login", query: {from: this.$route.fullPath} }).catch(err => {});         // no token found, logout
            }
          }else{
            if(this.$route.query.from){
              this.$router.push({path:this.$route.query.from}).catch(err => {});
            }else{
              if(this.$route.name){
                if(this.$route.name=="Login"){
                  this.$router.push({name:"Home"}).catch(err => {});
                }else{
                  this.$router.push({name:this.$route.name}).catch(err => {});
                }

              }else{
                this.$router.push({name:"Home"}).catch(err => {});
              }
            }
            this.refreshAuthenticated()
            this.loadProfile()
          }
        },
        logout() {
            TokenStorage.clear()
            this.formConfig=undefined
            this.$router.replace({ name: "Login" }).catch(err => {});
            this.refreshAuthenticated()
            this.resetProfile()
        }
    }
  }
</script>
