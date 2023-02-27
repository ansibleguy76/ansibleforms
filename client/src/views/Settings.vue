<template>
  <section v-if="isAdmin" class="section">
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="cogs" /> Settings</h1>
      <div class="columns">
        <div class="column is-narrow">
          <BulmaSettingsMenu />
        </div>
        <div class="column">
          <nav class="level">
            <!-- Left side -->
            <div class="level-left">
              <p class="level-item"><BulmaButton icon="save" label="Update" @click="updateSettings()"></BulmaButton></p>
            </div>
          </nav>
          <div class="box">
            <BulmaInput icon="globe" v-model="settings.url" type="url" label="AnsibleForms Url" placeholder="https://ansibleforms:8443" :required="true" :hasError="$v.settings.url.$invalid" :errors="[]" />
          </div>  

            <table class="table is-bordered is-striped is-fullwidth">
              <thead>
                <tr>
                  <th>Environment Variable</th><th>Set</th><th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="e in env" :key="e.name">
                  <td>{{ e.name }}</td>
                  <td><font-awesome-icon :icon="(e.set)?'check':'times'" :class="{'has-text-success':e.set,'has-text-danger':!e.set}" /></td>
                  <td>{{ e.value }}</td>
                </tr>
              </tbody>
            </table>
              
        </div>
      </div>

    </div>
  </section>
</template>
<script>
  import Vue from 'vue'
  import axios from 'axios'
  import Vuelidate from 'vuelidate'
  import BulmaButton from './../components/BulmaButton.vue'
  import BulmaInput from './../components/BulmaInput.vue'
  import BulmaSettingsMenu from '../components/BulmaSettingsMenu.vue'
  import TokenStorage from './../lib/TokenStorage'
  import { required, email, minValue,maxValue,minLength,maxLength,helpers,requiredIf,sameAs } from 'vuelidate/lib/validators'

  Vue.use(Vuelidate)

  export default{
    name: "Settings",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{BulmaButton,BulmaInput,BulmaSettingsMenu},
    data(){
      return  {
          settings:{
            url:""
          },
          env:[]

        }
    },
    methods:{
      loadSettings(){
        var ref= this;
        axios.get('/api/v1/settings/',TokenStorage.getAuthentication())
          .then((result)=>{
            ref.settings=result.data.data.output;
          }),function(error){
            ref.$toast.error(error.message);
          };
        axios.get('/api/v1/config/env',TokenStorage.getAuthentication())
          .then((result)=>{
            ref.env=result.data.data.output;
          }),function(error){
            ref.$toast.error(error.message)
          }
      },updateSettings(){
        var ref= this;
        if (!this.$v.settings.$invalid) {
          axios.put('/api/v1/settings/',this.settings,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                ref.$toast.success("Settings are updated");
                ref.loadSettings();
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
      settings:{
        url:{
          required
        }
      }
    },
    mounted() { // when the Vue app is booted up, this is run automatically.
        this.loadSettings();
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
