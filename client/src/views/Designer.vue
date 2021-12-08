<template>
  <section v-if="isAdmin" class="section">
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon icon="edit" /> Designer</h1>
      <div class="columns">
        <div class="column">
          <div>
            <VueCodeEditor
                v-model="formConfig"
                @init="editorInit"
                lang="yaml"
                theme="monokai"
                width="100%"
                height="600px"
                :options="{
                    enableBasicAutocompletion: true,
                    enableLiveAutocompletion: true,
                    fontSize: 14,
                    highlightActiveLine: true,
                    enableSnippets: false,
                    showLineNumbers: true,
                    tabSize: 2,
                    wrap:true,
                    showPrintMargin: false,
                    showGutter: true,
                }"
              />
          </div>
          <div>
            <br>
            <BulmaButton icon="check" label="Validate config" @click="validate()"></BulmaButton>
            <BulmaButton icon="save" label="Save config" @click="save()"></BulmaButton>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
<script>
  import Vue from 'vue'
  import axios from 'axios'
  import YAML from 'yaml'
  import BulmaButton from './../components/BulmaButton.vue'
  import BulmaSelect from './../components/BulmaSelect.vue'
  import BulmaInput from './../components/BulmaInput.vue'
  import BulmaModal from './../components/BulmaModal.vue'
  import TokenStorage from './../lib/TokenStorage'
  import VueCodeEditor from 'vue2-code-editor';

  // Vue.use(Vuelidate)

  export default{
    name: "Designer",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{VueCodeEditor,BulmaButton},
    data(){
      return  {
        formConfig:"",
      }
    },
    methods:{
      loadAll(){
        this.loadForms();


      },loadForms(){
        var ref= this;
        axios.get(`/api/v1/config?timestamp=${new Date().getTime()}`,TokenStorage.getAuthentication())                               // load forms
          .then((result)=>{
            ref.formConfig=YAML.stringify(result.data);
            if(!ref.formConfig.error){
              // ref.$toast.success("Valid forms.yaml loaded")
            }else{
                ref.$toast.error("Invalid forms.yaml")
                ref.errorMessage="Error in forms.yaml file\n\n" + ref.formConfig.error
            }
          })
          .catch(function(err){
            if(err.response && err.response.status!=401){
              ref.errorMessage="Could not get forms.yaml file\n\n" + err
            }else{
              ref.$toast.error("Failed to load forms.yaml file")
            }
          })
      },
      validate() {
       var ref= this;

       axios.post('/api/v1/config/check',{forms:this.formConfig},TokenStorage.getAuthentication())
         .then((result)=>{
           if(result.data.status=="error"){
             ref.$toast.error(result.data.data.error);
           }else{
             ref.$toast.success(result.data.message);
           }
         }),function(error){
           ref.$toast.error(error.message);
         };

      },
      save() {
       var ref= this;

       axios.post('/api/v1/config/',{forms:this.formConfig},TokenStorage.getAuthentication())
         .then((result)=>{
           if(result.data.status=="error"){
             ref.$toast.error(result.data.data.error);
           }else{
             ref.$toast.success(result.data.message);
           }
         }),function(error){
           ref.$toast.error(error.message);
         };

      },
      editorInit: function () {
          // vue2-code-editor/node_modules/
          require('brace/ext/language_tools') //language extension prerequsite...
          require('brace/mode/yaml')
          require('brace/theme/monokai')
      }
    },
    mounted() { // when the Vue app is booted up, this is run automatically.
      if(!this.isAdmin){
        this.$toast.error("You are not an admin user")
      }else{
        this.loadAll();
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
