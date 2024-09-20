<template>
  <section v-if="isAdmin" class="section">
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="key" /> SSH Key</h1>
      <div class="columns">
        <div class="column is-narrow">
          <BulmaSettingsMenu />
        </div>
        <div class="column">        
          <BulmaTextArea v-if="update" v-model="ssh.key" label="Private Key" placeholder="-----BEGIN RSA PRIVATE KEY-----" :hasError="v$.ssh.key.$invalid" :errors="[{if:v$.ssh.key.$invalid,label:'Enter a valid private key followed by a new line'}]" />
          <div class="field"  v-if="!update">
            <label class="label">Private Key</label>
            <p @click="update=true"  class="box is-clickable is-family-monospace enable-line-break is-size-7">{{ ssh.art }}</p>
          </div>
          <div class="field">
            <label class="label">Public Key</label>
            <p class="box  is-clickable  is-family-monospace is-text-overflow is-size-7" @click="clip(ssh.publicKey,true)">
              {{ ssh.publicKey }}
            </p>
          </div>
          <BulmaButton v-if="update" icon="save" label="Update Ssh" @click="updateSsh()"></BulmaButton>
        </div>
      </div>
    </div>
  </section>
</template>
<script>
  import axios from 'axios'
  import Copy from 'copy-to-clipboard'
  import BulmaButton from './../components/BulmaButton.vue'
  import BulmaTextArea from './../components/BulmaTextArea.vue'
  import BulmaSettingsMenu from '../components/BulmaSettingsMenu.vue'
  import TokenStorage from './../lib/TokenStorage'
  import { useVuelidate } from '@vuelidate/core'
  import { required, helpers } from '@vuelidate/validators'
  
  export default{
    name: "AfSshkey",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{BulmaButton,BulmaTextArea,BulmaSettingsMenu},
    setup(){
      return { v$: useVuelidate() }
    },
    data(){
      return  {
          update:false,
          ssh:{
            key:"",
            art:"",
            publicKey:""
          }
        }
    },
    methods:{
      clip(v,doNotStringify=false){
        try{
          if(doNotStringify){
            Copy(v)
          }else{
            Copy(JSON.stringify(v))
          }
          this.$toast.success("Copied to clipboard")
        }catch(err){
          this.$toast.error("Error copying to clipboard : \n" + err.toString())
        }
      },
      loadSsh(){
        var ref= this;
        axios.get(`${process.env.BASE_URL}api/v1/sshkey/`,TokenStorage.getAuthentication())
          .then((result)=>{
            ref.ssh=result.data.data.output;
          }),function(err){
            ref.$toast.error(err.toString());
          };
      },updateSsh(){
        var ref= this;
        if (!this.v$.ssh.$invalid) {
          axios.put(`${process.env.BASE_URL}api/v1/sshkey/`,this.ssh,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                ref.$toast.success("Sshkey is updated");
                ref.ssh.key="";
                ref.update=false;
                ref.loadSsh();
              }
            }),function(err){
              ref.$toast.error(err.toString());
            };
        }else{
          this.$toast.warning("Invalid form data")
        }
      }
    },
    validations() {
      return {
        ssh: {
          key: {
            required,
            privatekey: helpers.regex(/^-----BEGIN ([A-Z ]+ PRIVATE KEY)-----\r?\n([^-]+)\r?\n-----END \1-----\r?\n$/gm)
          }
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
  .is-text-overflow {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
  }
  .enable-line-break {
      white-space: pre-wrap;
  }
</style>
