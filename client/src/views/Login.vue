<template>
  <section v-if="!loading" class="hero has-background-light is-fullheight">
    <div class="hero-body">
      <div class="container">
        <div class="columns is-centered">
          <div class="column is-5-tablet is-4-desktop is-3-widescreen">
            <div class="box">
              <BulmaInput icon="user" focus="true" v-model="user.username" label="Username" placeholder="Username" :required="true" :hasError="$v.user.username.$invalid" :errors="[]" />
              <BulmaInput icon="lock" v-model="user.password" @enterClicked="login()" label="Password" type="password" placeholder="***********" :required="true" :hasError="$v.user.password.$invalid" :errors="[]" />
              <div class="field">
                <button class="button is-light mr-1" @click="login()">
                  <span class="icon has-text-info"><font-awesome-icon icon="right-to-bracket" /></span><span>Login</span>
                </button>
                <a v-if="azureAdEnabled" class="button is-light" href="/api/v1/auth/azureadoauth2">
                  <span class="icon has-text-link"><font-awesome-icon icon="arrow-right-to-bracket" /></span><span>Azure AD</span>
                </a>                
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
  import Vue from 'vue'
  import Vuelidate from 'vuelidate'
  import BulmaInput from './../components/BulmaInput.vue'
  import TokenStorage from './../lib/TokenStorage'
  import { required, email, minValue,maxValue,minLength,maxLength,helpers,requiredIf,sameAs } from 'vuelidate/lib/validators'
  import axios from 'axios'
  Vue.use(Vuelidate)

  export default {
      components:{BulmaInput},
      name: 'Login',
      data() {
          return {
              loading:false,
              user: {
                  username: "",
                  password: ""
              },
              azureAdEnabled:false,
              azureGraphUrl:"https://graph.microsoft.com"
          }
      },
      methods: {
        getSettings(azuretoken){
          var ref=this
          axios.get("/api/v1/auth/settings")
          .then((result)=>{
            if(result.data?.status=='success'){
              this.azureAdEnabled=!!result.data.data.output.azureAdEnabled
              this.azureGraphUrl=result.data.data.output.azureGraphUrl
              if(azuretoken){
                this.getGroupsAndLogin(azuretoken)
              }
            }else{
              // this.$toast.error(result.data.data.error)
            }
          })
          .catch((err)=>{
            this.$toast.error("Failed to get settings")
          })
        },
        getGroupsAndLogin(azuretoken){

          const config = {
              headers: { 
                Authorization: `Bearer ${azuretoken}`
              }
          };
          axios.get(`${this.azureGraphUrl}/v1.0/me/transitiveMemberOf`,config)
          .then((res) => {
            const groups = res.data.value.map(x=>('azuread/'+x.displayName))
            axios.post('/api/v1/auth/azureadoauth2/login',{azuretoken,groups})
            .then((result)=>{
              if(result.data.token){
                TokenStorage.storeToken(result.data.token)
                TokenStorage.storeRefreshToken(result.data.refreshtoken)
                this.$emit("authenticated", result.data.token);   
              }else{
                this.$toast.error("Azure AD Login failed, no token found")
              }
            })
            .catch((err)=>{
              console.log(err)
              this.$toast.error("Azure AD Login failed")
            })            
          })
          .catch((err)=>{
            this.$toast.error("Failed to get groupmembership")
          })
        },
        login() {

          if (!this.$v.user.$invalid) {
            console.log("Logging in")
            var basicAuth = 'Basic ' + btoa(this.user.username + ':' + this.user.password);
            var postconfig={
              headers:{'Authorization':basicAuth}
            }
            axios.post("/api/v1/auth/login",{},postconfig)
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

        if(this.$route.query.azuretoken){
          this.loading=true
          this.getSettings(this.$route.query.azuretoken)
        }else{
          this.getSettings()
        }
        if(this.$route.query.error){
          this.$toast.error(this.$route.query.error)
        }
      }
  }
</script>
