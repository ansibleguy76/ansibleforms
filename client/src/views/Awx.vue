<template>
  <section v-if="isAdmin" class="section">
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="id-card" /> Awx</h1>
      <BulmaInput icon="globe" v-model="awx.uri" label="Uri" placeholder="https://awx.domain.local" :required="true" :hasError="$v.awx.uri.$invalid" :errors="[]" />
      <BulmaInput icon="lock" v-model="awx.token" label="Token" placeholder="Token" :required="true" :hasError="$v.awx.token.$invalid" :errors="[]" />
      <BulmaButton icon="save" label="Update Awx" @click="updateAwx()"></BulmaButton>
      <BulmaButton icon="check" label="Test Awx" @click="testAwx()"></BulmaButton>
    </div>
  </section>
</template>
<script>
  import Vue from 'vue'
  import axios from 'axios'
  import Vuelidate from 'vuelidate'
  import BulmaButton from './../components/BulmaButton.vue'
  import BulmaInput from './../components/BulmaInput.vue'
  import TokenStorage from './../lib/TokenStorage'
  import { required, email, minValue,maxValue,minLength,maxLength,helpers,requiredIf,sameAs } from 'vuelidate/lib/validators'

  Vue.use(Vuelidate)

  export default{
    name: "Awx",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{BulmaButton,BulmaInput},
    data(){
      return  {
          awx:{
            uri:"",
            token:""
          }
        }
    },
    methods:{
      loadAwx(){
        var ref= this;
        axios.get('/api/v1/awx/',TokenStorage.getAuthentication())
          .then((result)=>{
            ref.awx=result.data.data.output;
          }),function(error){
            ref.$toast.error(error.message);
          };
      },updateAwx(){
        var ref= this;
        if (!this.$v.awx.$invalid) {
          axios.put('/api/v1/awx/',this.awx,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                ref.$toast.success("Awx is updated");
                ref.loadAwx();
              }
            }),function(error){
              ref.$toast.error(error.message);
            };
        }else{
          this.$toast.warning("Invalid form data")
        }
      },
      testAwx(){
        var ref= this;
        axios.post('/api/v1/awx/check/',this.awx,TokenStorage.getAuthentication())
          .then((result)=>{
            if(result.data.status=="error"){
              ref.$toast.error(result.data.message + ", " + result.data.data.error);
            }else{
              ref.$toast.success(result.data.message);
            }
          }),function(error){
            ref.$toast.error(error.message);
          };
      }
    },
    validations: {
      awx:{
        uri: {
          required
        },
        token: {
          required
        }
      }
    },
    mounted() { // when the Vue app is booted up, this is run automatically.
      if(!this.isAdmin){
        this.$toast.error("You are not an admin user")
      }else{
        this.loadAwx();
      }
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
