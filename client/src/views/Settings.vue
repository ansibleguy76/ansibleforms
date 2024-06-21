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
            <BulmaInput icon="globe" v-model="settings.url" help="" label="Public Root Url" placeholder="https://ansibleforms:8443" :required="true" :hasError="$v.settings.url.$invalid" :errors="[]" />
          </div>
          <div class="box" v-if="settings.enableFormsYamlInDatabase">
            <p class="mb-2">
              In case you want the main forms.yaml file in the database instead of loaded from the filesystem. 
              <strong class="ml-3">Note that the designer will be disabled.</strong>
            </p>
            <div class="level">
              <div class="level-left">
                <p class="level-item has-text-weight-bold">
                  Forms YAML
                </p>
              </div>
              <div class="level-right">
                <p class="level-item"><BulmaButton icon="file-import" label="Import from file" @click="importYamlFile()"></BulmaButton></p>
              </div>
            </div>
            
            <VueCodeEditor
                  v-model="settings.forms_yaml"
                  @init="editorInit"
                  lang="yaml"
                  theme="monokai"
                  width="100%"
                  height="40vh"
                  tabindex=0
                  :lazymodel="true"
                  @dirty="formDirty=true"
                  :options="{
                      enableBasicAutocompletion: true,
                      enableLiveAutocompletion: false,
                      fontSize: 14,
                      highlightActiveLine: true,
                      enableSnippets: false,
                      showLineNumbers: true,
                      tabSize: 2,
                      wrap:false,
                      showPrintMargin: false,
                      showGutter: true
                  }"
                />
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
  import VueCodeEditor from './../components/VueCodeEditor';
  import BulmaSettingsMenu from '../components/BulmaSettingsMenu.vue'
  import TokenStorage from './../lib/TokenStorage'
  import { required, email, minValue,maxValue,minLength,maxLength,helpers,requiredIf,sameAs } from 'vuelidate/lib/validators'

  Vue.use(Vuelidate)

  export default{
    name: "AfSettings",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{BulmaButton,BulmaInput,VueCodeEditor,BulmaSettingsMenu},
    data(){
      return  {
          settings:{
            url:"",
            forms_yaml:"",
          },
          env:[]

        }
    },
    computed:{
    },
    methods:{
      importYamlFile(){
        var ref= this;
        axios.put(`${process.env.BASE_URL}api/v1/settings/importFormsFileFromYaml`,{},TokenStorage.getAuthentication())
          .then((result)=>{
            if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                ref.$toast.success(result.data.message);
                ref.loadSettings();
              }
          }),function(err){
            ref.$toast.error(err.toString());
          };
      },
      loadSettings(){
        var ref= this;
        axios.get(`${process.env.BASE_URL}api/v1/settings/`,TokenStorage.getAuthentication())
          .then((result)=>{
            ref.settings=result.data.data.output;
          }),function(err){
            ref.$toast.error(err.toString());
          };
        axios.get(`${process.env.BASE_URL}api/v1/config/env`,TokenStorage.getAuthentication())
          .then((result)=>{
            ref.env=result.data.data.output;
          }),function(err){
            ref.$toast.error(err.toString())
          }
      },updateSettings(){
        var ref= this;
        if (!this.$v.settings.$invalid) {
          axios.put(`${process.env.BASE_URL}api/v1/settings/`,this.settings,TokenStorage.getAuthentication())
            .then((result)=>{
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                ref.$toast.success("Settings are updated");
                ref.loadSettings();
              }
            }),function(err){
              ref.$toast.error(err.toString());
            };
        }else{
          this.$toast.warning("Invalid form data")
        }
      },
      editorInit: function () {
          // vue2-code-editor/node_modules/
          require('brace/ext/language_tools') //language extension prerequsite...
          require('brace/mode/yaml')
          require('brace/theme/monokai')
      }      
    },
    validations: {
      settings:{
        url:{
          required,
          regex : helpers.withParams(
              {description: "Must be a valid public url",type:"regex"},
              (value) => !helpers.req(value) || (new RegExp("^https?:\/\/[^\/]+$").test(value)) // eslint-disable-line
          )                
        },
        forms_yaml:{
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
