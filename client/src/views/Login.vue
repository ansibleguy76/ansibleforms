<template>
  <section class="hero has-background-light is-fullheight">
    <div class="hero-body">
      <div class="container">
        <div class="columns is-centered">
          <div class="column is-5-tablet is-4-desktop is-3-widescreen">
            <div class="notification is-danger" v-if="errorMessage!=''">
              {{ errorMessage}}
            </div>
            <div class="box">
              <BulmaInput icon="fa-user" focus="true" v-model="user.username" label="Username" placeholder="Username" :required="true" :hasError="$v.user.username.$invalid" :errors="[]" />
              <BulmaInput icon="fa-lock" v-model="user.password" @enterClicked="login()" label="Password" type="password" placeholder="***********" :required="true" :hasError="$v.user.password.$invalid" :errors="[]" />
              <div class="field">
                <button class="button is-success" @click="login()">
                  Login
                </button>
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
              user: {
                  username: "",
                  password: ""
              },
              errorMessage:""
          }
      },
      methods: {
          login() {

              if (!this.$v.user.$invalid) {
                console.log("Logging in")
                axios.post("/api/v1/auth/login",this.user)
                  .then((result)=>{
                    if(result.data.token){
                      console.log("Login success, storing tokens")
                      TokenStorage.storeToken(result.data.token)
                      TokenStorage.storeRefreshToken(result.data.refreshtoken)
                      this.errorMessage=""
                      this.$emit("authenticated", result.data.token);
                    }else{
                      TokenStorage.clear()
                      this.errorMessage=result.data.message
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
  }
</script>
