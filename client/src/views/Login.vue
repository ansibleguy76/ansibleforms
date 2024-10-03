<template>
  <section v-if="!loading" class="hero">
    <div class="hero-body">
      <div class="container">
        <div class="columns is-centered is-vcentered vh-90">
          <div class="column is-6-tablet is-6-desktop is-4-widescreen">
            <div class="box">
              <BulmaInput icon="user" focus="true" v-model="user.username" label="Username" placeholder="Username" :required="true" :hasError="v$.user.username.$invalid" :errors="[]" />
              <BulmaInput icon="lock" v-model="user.password" @enterClicked="login()" label="Password" type="password" placeholder="***********" :required="true" :hasError="v$.user.password.$invalid" :errors="[]" />
              <div class="field">
                <button class="button is-light mr-1" @click="login()">
                  <span class="icon has-text-info"><font-awesome-icon icon="right-to-bracket" /></span><span>Login</span>
                </button>
          
              </div>
            </div>
            <div class="box" v-if="azureAdEnabled || oidcEnabled">
              <button v-if="azureAdEnabled" title="Azure" class="button is-light mr-3">
                <span class="icon" @click="authAzureAd"><img src="/assets/img/azure.svg" alt="Azure" /></span>
              </button>
              <button v-if="oidcEnabled" title="OIDC" class="button is-light mr-3">
                <span class="icon" @click="authOidc"><img src="/assets/img/openid.svg" alt="OIDC" /></span>
              </button>              
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
  import BulmaInput from './../components/BulmaInput.vue'
  import TokenStorage from './../lib/TokenStorage'
  import { useVuelidate } from '@vuelidate/core'
  import { required } from '@vuelidate/validators'
  import axios from 'axios'
  import jwt from 'jsonwebtoken'
  
  export default {
      components:{BulmaInput},
      name: 'AfLogin',
      setup(){
        return { v$: useVuelidate() }
      },
      data() {
          return {
              loading:false,
              user: {
                  username: "",
                  password: ""
              },
              baseUrl:"/",
              azureAdEnabled:false,
              azureGroupfilter:"",
              azureGraphUrl:"https://graph.microsoft.com",
              oidcEnabled:false,
              oidcGroupfilter:"",
              oidcIssuer:""
          }
      },
      methods: {
        authAzureAd(){
          localStorage.setItem("authIssuer", "azuread");  // set cookie to azuread
          window.location.replace(`${this.baseUrl}api/v1/auth/azureadoauth2`) // redirect to azuread
        },
        authOidc(){
          localStorage.setItem("authIssuer", "oidc");   // set cookie to oidc
          window.location.replace(`${this.baseUrl}api/v1/auth/oidc`) // redirect to oidc
        },
        getSettings(token){
          var ref=this
          axios.get(`${ref.baseUrl}api/v1/auth/settings`)
          .then((result)=>{
            if(result.data?.status=='success'){
              this.azureAdEnabled=!!result.data.data.output.azureAdEnabled
              this.azureGroupfilter=result.data.data.output.azureGroupfilter
              this.azureGraphUrl=result.data.data.output.azureGraphUrl

              this.oidcEnabled=!!result.data.data.output.oidcEnabled
              this.oidcGroupfilter=result.data.data.output.oidcGroupfilter
              this.oidcIssuer=result.data.data.output.oidcIssuer
              
              if(token && this.azureAdEnabled){
                if(localStorage.getItem("authIssuer")=="azuread") // get cookie and see if we issued azuread
                  this.getGroupsAndLogin(token)
              } 
              if (token && this.oidcEnabled) { // get cookie ans see if we issued oidc
                if(localStorage.getItem("authIssuer")=="oidc")
                  this.getGroupsAndLogin(token, `${this.oidcIssuer}/protocol/openid-connect/userinfo`, 'oidc')
              }
            }else{
              this.$toast.error(result.data.data.error)
            }
          })
          .catch((err)=>{
            this.$toast.error(`Failed to get settings: ${err}`)
          })
        },
        getGroupsAndLogin(token, url = `${this.azureGraphUrl}/v1.0/me/transitiveMemberOf`, type='azuread', allGroups = []) {
          if (type === 'azuread') {
            const config = {
              headers: {
                Authorization: `Bearer ${token}`
              }
            };

            axios.get(url, config)
                .then((res) => {
                  const groups = res.data.value.filter(x => x.displayName).map(x => (`azuread/` + x.displayName));
                  allGroups = allGroups.concat(groups);

                  if (res.data['@odata.nextLink']) {
                    // If there's a nextLink, make a recursive call to get the next page of data
                    this.getGroupsAndLogin(token, res.data['@odata.nextLink'], type, allGroups); 
                  } else {
                    // No more nextLink, you have all the groups
                    this.tokenLogin(token, allGroups)
                  }
                })
                .catch((err) => {
                  this.$toast.error("Failed to get group membership");
                });
          }
          else if (type === 'oidc') {
            const payload = jwt.decode(token, {complete: true}).payload
            this.tokenLogin(token, payload.groups || [], 'oidc')
          }else{
            this.$toast.error("Invalid Identity Provider type, contact developer")
          }
        },
        tokenLogin(token, allGroups, type='azuread') {
          var validRegex=true
          var regex
          var groupfilter
          if(type === 'azuread'){
            groupfilter = this.azureGroupfilter
          }else if(type === 'oidc'){
            groupfilter = this.oidcGroupfilter
          }else{
            this.$toast.error("Invalid Identity Provider type, contact developer")
            return false
          }
          try{
            regex = new RegExp(groupfilter, 'g');
          }catch(e){
            console.error("Identity Provider Group filter is not a valid regular expression")
            validRegex=false
          }
          if(validRegex && groupfilter){
            allGroups = allGroups.filter(x => x.match(regex))
          }
          const loginProvider = type === 'azuread' ? 'azureadoauth2' : 'oidc'

          axios.post(`${this.baseUrl}api/v1/auth/${loginProvider}/login`, { token:token, groups:allGroups })
          .then((result) => {
            if (result.data.token) {
              TokenStorage.storeToken(result.data.token);
              TokenStorage.storeRefreshToken(result.data.refreshtoken);
              this.$emit("authenticated", result.data.token);
            } else {
              this.$toast.error("Identity Provider Login failed, no token found");
            }
          })
          .catch((err) => {
            console.log(err);
            this.$toast.error("Identity Provider Login failed");
          });
        },
        login() {
          var ref=this
          localStorage.removeItem("authIssuer") // remove cookie, regular login
          if (!this.v$.user.$invalid) {
            console.log("Logging in")
            var basicAuth = 'Basic ' + new Buffer(this.user.username + ':' + this.user.password).toString('base64')
            var postconfig={
              headers:{'Authorization':basicAuth}
            }
            axios.post(`${ref.baseUrl}api/v1/auth/login`,{},postconfig)
              .then((result)=>{
                if(result.data.token){
                  console.log("Login success, storing tokens")
                  TokenStorage.storeToken(result.data.token)
                  TokenStorage.storeRefreshToken(result.data.refreshtoken)
                  this.$emit("authenticated", result.data.token);
                }else{
                  TokenStorage.clear()
                  this.$toast.error(result.data.message)
                }

              }).catch(function (error) {
                  TokenStorage.clear()
              })
          }
        }
      },
      validations: {
        user:{
          username: {
            required
          },
          password: {
            required
          }
        }

      },
      mounted(){
        this.baseUrl = process.env.BASE_URL
        if(this.$route.query.token){
          this.loading=true
          this.getSettings(this.$route.query.token)
        }
        else{
          this.getSettings()
        }
        if(this.$route.query.error){
          this.$toast.error(this.$route.query.error)
        }
      }
  }
</script>
<style scoped>
  .hero{
    background: url(/assets/img/bg.jpg) no-repeat center center fixed; 
    -webkit-background-size: cover;
    -moz-background-size: cover;
    -o-background-size: cover;
    background-size: cover;
  }
  .box{
    background-color:rgba(255, 255, 255, 0.91)!important;
  }
  .vh-90{
    height:calc(100vh - 150px);
  }
</style>