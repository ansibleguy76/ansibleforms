<template>
  <section class="hero has-background-light is-fullheight">
    <div class="hero-body">
      <div class="container">
        <div class="columns is-centered">
          <div class="column is-5-tablet is-4-desktop is-3-widescreen">
            <div class="box">
              <BulmaInput icon="lock" focus="true" v-model="user.password" @enterClicked="update()" label="Password" type="password" placeholder="***********" :required="true" :hasError="v$.user.password.$invalid" :errors="[{if:v$.user.password.passwordComplexity.$invalid,label:v$.user.password.passwordComplexity.$params.description}]" />
              <BulmaInput icon="lock" type="password" v-model="user.password2" @enterClicked="update()" label="Password Again" placeholder="Password" :required="true" :hasError="v$.user.password2.$invalid" :errors="[{if:v$.user.password2.sameAsPassword.$invalid,label:'Passwords are not the same'}]" />
              <div class="field">
                <button class="button is-light" @click="update()">
                  <span class="icon has-text-info"><font-awesome-icon icon="key" /></span><span>Change Password</span>
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
  import axios from 'axios'
  import BulmaInput from './../components/BulmaInput.vue'
  import TokenStorage from './../lib/TokenStorage'
  import { useVuelidate } from '@vuelidate/core'
  import { required, helpers,sameAs } from '@vuelidate/validators'

  export default{
    name: "AfUsers",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{BulmaInput},
    setup(){
      return { v$: useVuelidate() }
    },
    data(){
      return  {
          user:{
            password:"",
            password2:""
          }
        }
    },
    methods:{
      update(){
        var ref= this;
        if (!this.v$.user.password.$invalid && !this.v$.user.password2.$invalid) {
          axios.put(`${process.env.BASE_URL}api/v1/profile`,this.user,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                  ref.$toast.success("Password is changed");
                  ref.$router.push({name:"Home"}).catch(err => {});
              }
            }),function(err){
              ref.$toast.error(err.toString());
            };
        }else{
          this.$toast.warning("Invalid form data")
        }
      }
    },
    validations(){ 
      return {
        user:{
          password: {
            required,
            minLength:8,
            passwordComplexity : helpers.withParams(
                {description: "Must contain at least 1 numeric, 1 special, 1 upper and 1 lower character",type:"regex"},
                (value) => !helpers.req(value) || (new RegExp("^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\\$%\\^&\\*])").test(value))
            )
          },
          password2:{
            sameAsPassword: sameAs(this.user.password)
          }
        }
      }

    },
    mounted() { // when the Vue app is booted up, this is run automatically.
    }
  }
</script>
<style scoped>
  .cursor-progress{
    cursor:progress;
  }
  .select, .select select{
    width:100%;
  }
</style>
