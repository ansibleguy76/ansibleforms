<template>
  <section v-if="!loading" class="hero">
    <div class="hero-body">
      <div class="container">
        <div class="columns is-centered is-vcentered vh-90">
          <div class="column is-6-tablet is-6-desktop is-4-widescreen">
            <div class="box">
              <BulmaInput icon="user" focus="true" v-model="user.username" label="Username" placeholder="Username" :required="true" :hasError="$v.user.username.$invalid" :errors="[]" />
              <BulmaInput icon="lock" v-model="user.password" @enterClicked="login()" label="Password" type="password" placeholder="***********" :required="true" :hasError="$v.user.password.$invalid" :errors="[]" />
              <div class="field">
                <button class="button is-light mr-1" @click="login()">
                  <span class="icon has-text-info"><font-awesome-icon icon="right-to-bracket" /></span><span>Login</span>
                </button>
          
              </div>
            </div>
            <div class="box" v-if="azureAdEnabled">
              <a v-if="azureAdEnabled" title="Azure" class="button is-light" :href="`${process.env.BASE_URL}api/v1/auth/azureadoauth2`">
                <span class="icon"><img src="/assets/img/azure.svg" alt="Azure" /></span>
              </a>
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
              azureGroupfilter:"",
              azureGraphUrl:"https://graph.microsoft.com"
          }
      },
      methods: {
        getSettings(azuretoken){
          var ref=this
          axios.get(`${process.env.BASE_URL}api/v1/auth/settings`)
          .then((result)=>{
            if(result.data?.status=='success'){
              this.azureAdEnabled=!!result.data.data.output.azureAdEnabled
              this.azureGroupfilter=result.data.data.output.azureGroupfilter
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
        getGroupsAndLogin(azuretoken, url = `${this.azureGraphUrl}/v1.0/me/transitiveMemberOf`, allGroups = []) {
          var ref=this
          const config = {
            headers: {
              Authorization: `Bearer ${azuretoken}`
            }
          };

          axios.get(url, config)
            .then((res) => {
              const groups = res.data.value.filter(x => x.displayName).map(x => ('azuread/' + x.displayName));
              allGroups = allGroups.concat(groups);

              if (res.data['@odata.nextLink']) {
                // If there's a nextLink, make a recursive call to get the next page of data
                this.getGroupsAndLogin(azuretoken, res.data['@odata.nextLink'], allGroups);
              } else {
                var validRegex=true
                var regex
                try{
                  regex = new RegExp(ref.azureGroupfilter, 'g');
                }catch(e){
                  console.error("MS Entra ID Group filter is not a valid regular expression")
                  validRegex=false
                }
                if(validRegex && ref.azureGroupfilter){
                  allGroups = allGroups.filter(x => x.match(regex))
                  console.log("Groups have been filtered")
                }
                // No more nextLink, you have all the groups
                axios.post(`${process.env.BASE_URL}api/v1/auth/azureadoauth2/login`, { azuretoken, groups:allGroups })
                  .then((result) => {
                    if (result.data.token) {
                      TokenStorage.storeToken(result.data.token);
                      TokenStorage.storeRefreshToken(result.data.refreshtoken);
                      this.$emit("authenticated", result.data.token);
                    } else {
                      this.$toast.error("Azure AD Login failed, no token found");
                    }
                  })
                  .catch((err) => {
                    console.log(err);
                    this.$toast.error("Azure AD Login failed");
                  });
              }
            })
            .catch((err) => {
              this.$toast.error("Failed to get group membership");
            });
        },
        login() {

          if (!this.$v.user.$invalid) {
            console.log("Logging in")
            var basicAuth = 'Basic ' + btoa(this.user.username + ':' + this.user.password);
            var postconfig={
              headers:{'Authorization':basicAuth}
            }
            axios.post(`${process.env.BASE_URL}api/v1/auth/login`,{},postconfig)
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