<template>
  <section v-if="isAdmin && loaded" class="section" @keydown.ctrl.83.prevent.stop="save()" @keypress="formDirty=true" @keyup.delete="formDirty=true">
    <BulmaQuickView v-if="warnings && showWarnings" title="Form warnings" footer="" @close="showWarnings=false">
        <p v-for="w,i in warnings" :key="'warning'+i" class="mb-3" v-html="w"></p>
    </BulmaQuickView>
    <BulmaModal v-if="showDelete" title="Comfirm" action="Delete" @click="deleteThisForm();showDelete=false" @close="showDelete=false" @cancel="showDelete=false">Are you sure you want to delete form '{{ currentFormName}}'</BulmaModal>
    <BulmaModal
      v-if="showDirty"
      title="Unsaved Changes"
      action="Close without saving"
      actionSuccess="Save and Close"
      @click="showDirty=false;next(true)"
      @clickSuccess="showDirty=false;save(true)"
      @close="showDirty=false;next(false)"
      @cancel="showDirty=false;next(false)">
        Are you sure you want to leave the designer ?<br>You have unsaved changes.
    </BulmaModal>
    <div class="container">
      <div class="is-pulled-right">
        <button v-if="warnings.length>0" @click="showWarnings=!showWarnings" class="button is-outlined is-warning mr-3">
          <span class="icon">
            <font-awesome-icon icon="exclamation-triangle" />
          </span>
          <span class="mr-1">{{(showWarnings)?'Hide':'This design has'}} Warnings </span>
        </button>
        <button class="button is-info mr-3" :disabled="warnings.length>0 || !formConfig || !formDirty" @click="validate()">
          <span class="icon"><font-awesome-icon icon="check" /></span>
          <span>Validate</span>
        </button>
        <button class="button is-success" :disabled="warnings.length>0 || !formConfig || !formDirty" @click="save()">
          <span class="icon"><font-awesome-icon icon="save" /></span>
          <span>Save</span>
        </button>
      </div>
      <div>
        <h1 class="title has-text-info"><font-awesome-icon icon="edit" /> Designer</h1>
      </div>

      <div class="tabs mt-5">
        <ul>
          <li v-for="(tab,index) in tabs" :key="'tab'+index" :class="{'is-active':tab==currentTab}"><a @click="currentTab=tab">{{ tab }}</a></li>
        </ul>
      </div>
      <div v-if="currentTab=='Categories'">
        <VueCodeEditor
            v-model="categories"
            @init="editorInit"
            lang="yaml"
            theme="monokai"
            width="100%"
            height="60vh"
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
              showGutter: true,
            }"
          />
      </div>
      <div v-if="currentTab=='Roles'">
        <VueCodeEditor
            v-model="roles"
            @init="editorInit"
            lang="yaml"
            theme="monokai"
            width="100%"
            height="60vh"
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
              showGutter: true,
            }"
          />
      </div>
      <div v-if="currentTab=='Forms'">
        <div class="columns">
          <div class="column">
            <VueCodeEditor
                v-model="forms[currentForm]"
                @init="editorInit"
                lang="yaml"
                theme="monokai"
                width="100%"
                height="60vh"
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
                    showGutter: true,
                }"
              />
          </div>
          <div class="column is-one-third">
            <aside class="menu">
              <template v-for="f in files">
                <p :key="'file'+f" class="menu-label">
                  <span>{{f||"Base file"}}</span>
                  <span class="icon is-pulled-right has-text-success mr-3 is-clickable" @click="addForm(f)"><font-awesome-icon icon="plus" /></span>
                </p>
                <ul :key="'form'+f" class="menu-list">
                  <li v-for="n in formnames(f)" :key="n.id">
                    <a class="is-not-clickable" @click="currentForm=n.id" :class="{'is-active':currentForm==n.id}">
                      <span>{{ n.name }}</span>
                      <span class="icon is-pulled-right has-text-danger" @click="deleteForm(n.id)"><font-awesome-icon icon="times" /></span>
                    </a>
                  </li>
                </ul>
              </template>
            </aside>
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
  import TokenStorage from './../lib/TokenStorage'
  import VueCodeEditor from 'vue2-code-editor';
  import BulmaQuickView from './../components/BulmaQuickView.vue'
  import BulmaModal from './../components/BulmaModal.vue'
  import Form from './../lib/Form'

  export default{
    name: "Designer",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{VueCodeEditor,BulmaModal,BulmaQuickView},
    computed:{
      formsObj(){
        return Object.keys(this.forms).map(x => {
          try{
            var result=YAML.parse(this.forms[x])
            if(result.name){
              return result
            }else {
              throw "parsing issue"
            }
          }catch{
            return {name:x,source:"Parsing issues"}
          }
        })
      },
      formConfig(){
        try{
          return YAML.stringify({categories: YAML.parse(this.categories),roles: YAML.parse(this.roles),forms: this.formsObj})
        }catch{
          return ""
        }
      },
      files(){
        return this.formsObj.map(x => x.source).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a.localeCompare(b, undefined, {sensitivity: 'base'}))
      },
      idmapping(){
        // a map from "form_x" => form.name & form.source
        return Object.keys(this.forms).map(x => {
          try{
            var tmp = YAML.parse(this.forms[x])
            if(tmp && tmp.name){
              return { id:x,source:tmp.source,name:tmp.name}
            }else {
              throw "A form must have a few basic properties, like 'name'"
            }
          }catch(e){
            return { id:x,source:"Parsing issues",name:x,issue:e}
          }

        })
      },
      currentFormName(){
        var f= this.idmapping.filter(x => x.id===this.currentForm)
        if(f){
          return f[0].name
        }else{
          return undefined
        }
      },
      warnings(){
        var warnings=[]
        var names = this.idmapping.map(x => x.name)
        var dups=names.filter((item, index) => names.indexOf(item) !== index)
        var empties=this.idmapping.filter((item, index) => !item.name)
        var parsing=this.idmapping.filter((item) => item.source=="Parsing issues")
        var badsource=this.idmapping.filter((item) => (item.source && (!(item.source.endsWith('.yaml')||item.source.endsWith('.yml'))||item.source.includes('/'))))
        warnings=warnings.concat(dups.map(x => `<span class="has-text-warning">Form '${x}' has duplicates</span><br><span>Each form must have a unique name</span>`))
        warnings=warnings.concat(empties.map(x => `<span class="has-text-warning">Empty Formname</span><br><span>Each form must have a unique name</span>`))
        warnings=warnings.concat(parsing.map(x => `<span class="has-text-warning">Form '${x.name}' has bad YAML and cannot be parsed</span><br><span>${x.issue}</span>`))
        warnings=warnings.concat(badsource.map(x => `<span class="has-text-warning">Form '${x.name}' has a bad 'source' property</span><br><span>A source should be valid a .yaml file.  No deep-paths are allowed.<br>Remove the source to keep it in the base file.</span>`))
        return warnings
      }
    },
    data(){
      return  {
        categories:"",
        roles:"",
        forms:{},
        currentTab:"Forms",
        formDirty:false,
        currentForm:undefined,
        tabs:["Categories","Roles","Forms"],
        loaded:false,
        showDelete: false,
        showWarnings: false,
        showDirty:false,
        next:undefined,
        formtemplate:{
          name: "New Form",
          type: "ansible",
          playbook: "dummy.yaml",
          description: "",
          roles: ["public"],
          categories: [],
          tileClass: "has-background-info-light",
          icon: "bullseye",
          fields: [{
            name: "field1",
            type: "text",
            label: "field1"
          }]
        }
      }
    },
    methods:{
      selectfirst(){
        if(Object.keys(this.forms).length>0){
          this.currentForm=Object.keys(this.forms)[0]
        }
      },
      formnames(file){
        return this.idmapping.filter(x => x.source===file).sort((a, b) => (a.name||"").toLowerCase() > (b.name||"").toLowerCase() && 1 || -1)
      },
      formExists(name){
        var result=false
        result= (this.idmapping.filter(x => x.name===name)).length>0
        if(result){
          this.$toast.warning(`There is already a form named '${name}'`)
        }
        return result
      },
      addForm(file=undefined){
        if(!this.formExists("New Form")){
          var newform=this.formtemplate
          var formid="form_"+(Math.max(...Object.keys(this.forms).map(x => parseInt(x.replace('form_',''))))+1)
          if(file){
            newform.source=file
          }
          Vue.set(this.forms,formid,YAML.stringify(newform))
          this.currentForm=formid
        }
      },
      deleteForm(formid){
        this.currentForm=formid
        this.showDelete=true
      },
      deleteThisForm(){
        Vue.delete(this.forms,this.currentForm)
        this.selectfirst()
      },
      loadForms(){
        var ref= this;
        Form.load(function(formConfig){
          ref.categories=YAML.stringify(formConfig.categories);
          ref.roles=YAML.stringify(formConfig.roles);
          formConfig.forms.forEach((item, i) => {
            Vue.set(ref.forms,"form_"+i,YAML.stringify(item))
          });
          ref.selectfirst()
          ref.loaded=true
        },function(err){
          ref.$toast.error(err)
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
      save(close=false) {
       var ref= this;

       axios.post('/api/v1/config/',{forms:this.formConfig},TokenStorage.getAuthentication())
         .then((result)=>{
           if(result.data.status=="error"){
             ref.$toast.error(result.data.data.error);
           }else{
             ref.$toast.success(result.data.message);
             ref.formDirty=false
             if(close){
               this.next(true)
             }
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
        this.loadForms();
    },
    beforeRouteLeave (to, from , next) {
      if(this.formDirty){
        this.next=next
        this.showDirty=true
      }else{
        next(true)
      }
    },
    beforeMount() {
      window.addEventListener("beforeunload", event => {
        if (!this.formDirty) return
        event.preventDefault()
        event.returnValue = ""
      })
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
  .is-not-clickable{
    cursor:normal!important;
  }
</style>
