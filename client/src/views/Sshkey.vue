<template>
  <section v-if="isAdmin" class="section">
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="key" /> Sshkey</h1>
      <BulmaTextArea v-model="ssh.key" label="Private Key" placeholder="-----BEGIN CERTIFICATE-----" :hasError="$v.ssh.key.$invalid" :errors="[]" />
      <BulmaTextArea v-model="ssh.publicKey" readonly label="Public Key" :hasError="false" :errors="[]" />
      <BulmaButton icon="save" label="Update Ssh" @click="updateSsh()"></BulmaButton>
    </div>
  </section>
</template>
<script>
  import Vue from 'vue'
  import axios from 'axios'
  import Vuelidate from 'vuelidate'
  import BulmaButton from './../components/BulmaButton.vue'
  import BulmaTextArea from './../components/BulmaTextArea.vue'
  import TokenStorage from './../lib/TokenStorage'
  import { required, email, minValue,maxValue,minLength,maxLength,helpers,requiredIf,sameAs } from 'vuelidate/lib/validators'

  Vue.use(Vuelidate)

  export default{
    name: "Sshkey",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{BulmaButton,BulmaTextArea},
    data(){
      return  {
          ssh:{
            key:"",
            publicKey:""
          }
        }
    },
    methods:{
      loadSsh(){
        var ref= this;
        axios.get('/api/v1/sshkey/',TokenStorage.getAuthentication())
          .then((result)=>{
            ref.ssh=result.data.data.output;
          }),function(error){
            ref.$toast.error(error.message);
          };
      },updateSsh(){
        var ref= this;
        if (!this.$v.ssh.$invalid) {
          axios.put('/api/v1/sshkey/',this.ssh,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                ref.$toast.success("Sshkey is updated");
                ref.loadSsh();
              }
            }),function(error){
              ref.$toast.error(error.message);
            };
        }else{
          this.$toast.warning("Invalid form data")
        }
      }
    },
    validations: {
      ssh:{
        key: {
          required
        }
      }
    },
    mounted() { // when the Vue app is booted up, this is run automatically.
        this.loadSsh();
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
