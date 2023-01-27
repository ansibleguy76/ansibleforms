<template>
  <section v-if="isAdmin && loaded" class="section">
    <BulmaQuickView v-if="warnings && showWarnings" title="Form warnings" footer="" @close="showWarnings=false">
        <p v-for="w,i in warnings" :key="'warning'+i" class="mb-3" v-html="w"></p>
    </BulmaQuickView>
    <BulmaModal v-if="showDelete" title="Delete" action="Delete" @click="deleteThisForm();showDelete=false" @close="showDelete=false" @cancel="showDelete=false">Are you sure you want to delete form '{{ currentFormName}}'</BulmaModal>
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
    <BulmaModal
      v-if="showForce"
      title="Force Unlock"
      action="Unlock"
      @click="showForce=false;next(true)"
      @close="showForce=false;next(false)"
      @cancel="showForce=false;next(false)">
        Are you sure you want to force the unlock ?<br>
        Whomever has the lock now, will loose all changes<br>
        and will not be able to save them.<br><br>
        Proceed with care and respect.
    </BulmaModal>
    <BulmaModal
      v-if="showRestore"
      title="Restore backup"
      actionSuccess="Restore"
      @clickSuccess="restore"
      @close="showRestore=false"
      @cancel="showRestore=false">
        <BulmaAdvancedSelect
          :required="true"
          :multiple="false"
          name="restore"
          placeholder="Select a backup"
          :values="backups"
          :hasError="!backupToRestore"
          :isLoading="!backups"
          v-model="backupToRestore"
          icon="undo"
          :columns="['file','date']"
          :filterColumns="['file','date']"
          previewColumn="file"
          valueColumn="file"
          :sticky="true"
          >
        </BulmaAdvancedSelect>

        <BulmaCheckRadio checktype="checkbox" v-model="backupBeforeRestore" name="backupBeforeRestore" label="Make a backup before restore ?" />
    </BulmaModal>
    <div class="container">
      <div class="is-pulled-right" v-if="lock && lock.match">
        <transition name="pop" appear>
          <button v-if="warnings.length>0" @click="showWarnings=!showWarnings" class="button is-light is-warning mr-3">
            <span class="icon">
              <font-awesome-icon icon="exclamation-triangle" />
            </span>
            <span class="mr-1">{{(showWarnings)?'Hide':'This design has'}} Warnings </span>
          </button>
        </transition>
        <button class="button is-info mr-3" :disabled="!formConfig" @click="validate()">
          <span class="icon"><font-awesome-icon icon="check" /></span>
          <span>Validate</span>
        </button>
        <button class="button is-success mr-3" ref="saveButton" :disabled="warnings.length>0 || !formConfig || !formDirty" @click="save()">
          <span class="icon"><font-awesome-icon icon="save" /></span>
          <span>Save</span>
        </button>
        <button class="button is-warning" ref="restoreButton" @click="showRestore=true;backupToRestore=undefined">
          <span class="icon"><font-awesome-icon icon="undo" /></span>
          <span>Restore</span>
        </button>
      </div>
      <div class="is-pulled-right" v-if="lock && !lock.match">
        <span class="tag is-medium is-warning">The designer is read-only</span>
      </div>
      <div>
        <h1 class="title has-text-info">
          <span class="mr-3"><font-awesome-icon icon="edit" /> Designer</span>
          <div v-if="lock && lock.lock" class="dropdown is-hoverable">
            <div class="dropdown-trigger">
              <span aria-haspopup="true" aria-controls="dropdown-menu-lock" class="tag is-light is-medium mr-3" :class="{'is-warning':!lock.match,'is-success':lock.match}">
                <span class="icon">
                  <font-awesome-icon icon="lock" size="sm" />
                </span>
                <span v-if="lock && lock.lock && !lock.match" class="mr-1"> Locked by {{ lock.lock.username }}</span>
                <span v-if="lock && lock.lock && lock.match"  class="mr-1"> Locked by me</span>
              </span>
            </div>
            <div class="dropdown-menu" id="dropdown-menu-lock" role="menu">
              <div class="dropdown-content">
                <div class="dropdown-item">
                  <p>User: {{ lock.lock.username}}</p>
                  <p>Type: {{ lock.lock.type}}</p>
                  <p>Created: {{ lockAge }}</p>
                </div>
              </div>
            </div>
          </div>
          <span class="is-clickable tag is-medium is-link mr-3" v-if="lock && lock.free" @click="setLock">
            <span class="icon"><font-awesome-icon icon="unlock" size="sm" /></span>
            <span>Start designer</span>
          </span>
          <span class="is-clickable tag is-medium is-link mr-3" v-if="lock && (!lock.match && !lock.free)" @click="unLock">
            <span class="icon"><font-awesome-icon icon="unlock" size="sm" /></span>
            <span>Force unlock</span>
          </span>
          <span class="is-clickable tag is-medium is-link mr-3" v-if="lock && lock.match" @click="releaseLock">
            <span class="icon"><font-awesome-icon icon="unlock" size="sm" /></span>
            <span>Release lock</span>
          </span>
        </h1>
      </div>
      <template v-if="lock && !lock.free">
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
              :commands="[
                  {
                      name: 'save',
                      bindKey: { win: 'Ctrl-s', mac: 'Command-s' },
                      exec: null,
                      readOnly: true,
                  },
              ]"
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
              :commands="[
                  {
                      name: 'save',
                      bindKey: { win: 'Ctrl-s', mac: 'Command-s' },
                      exec: save,
                      readOnly: true
                  }
              ]"
            />
        </div>
        <div v-if="currentTab=='Constants'">
          <VueCodeEditor
              v-model="constants"
              @init="editorInit"
              lang="yaml"
              theme="monokai"
              width="100%"
              height="60vh"
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
              :commands="[
                  {
                      name: 'save',
                      bindKey: { win: 'Ctrl-s', mac: 'Command-s' },
                      exec: save,
                      readOnly: true
                  }
              ]"
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
                  :commands="[
                      {
                          name: 'save',
                          bindKey: { win: 'Ctrl-s', mac: 'Command-s' },
                          exec: save,
                          readOnly: true,
                      },
                  ]"
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
      </template>
    </div>
  </section>
</template>
<script>
  import Vue from 'vue'
  import axios from 'axios'
  import YAML from 'yaml'
  import TokenStorage from './../lib/TokenStorage'
  import VueCodeEditor from './../components/VueCodeEditor';
  import BulmaQuickView from './../components/BulmaQuickView.vue'
  import BulmaModal from './../components/BulmaModal.vue'
  import BulmaAdvancedSelect from './../components/BulmaAdvancedSelect.vue'
  import BulmaCheckRadio from './../components/BulmaCheckRadio.vue'
  import Helpers from './../lib/Helpers'
  import moment from 'moment'
  import Form from './../lib/Form'

  export default{
    name: "Designer",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{VueCodeEditor,BulmaModal,BulmaQuickView,BulmaAdvancedSelect,BulmaCheckRadio},
    data(){
      return  {
        categories:"",
        roles:"",
        constants:"",
        forms:{},
        currentTab:"Forms",
        formDirty:false,
        currentForm:undefined,
        tabs:["Categories","Roles","Constants","Forms"],
        loaded:false,
        showDelete: false,
        showWarnings: false,
        lock: undefined,
        showDirty:false,
        showForce:false,
        lockInterval:undefined,
        showRestore:false,
        backups:[],
        backupToRestore:undefined,
        backupBeforeRestore:false,
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
    computed:{
      lockAge(){
        if(this.lock?.lock){
          return moment(this.lock.lock.created).from()
        }else{
          return ""
        }
      },
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
      categoriesObj(){
        if(this.categories){
          try{
            var result=YAML.parse(this.categories)
            if(Array.isArray(result) && result.length>0 && result[0].name && result[0].icon){
              return result
            }else {
              throw "parsing issue"
            }
          }catch{
            return undefined
          }
        }else{
          return [{name:'Default',icon:'bars'}]
        }
      },
      rolesObj(){
        if(this.roles){
          try{
            var result=YAML.parse(this.roles)
            if(Array.isArray(result) && result.length>0 && result[0].name && result[0].groups){
              return result
            }else {
              throw "parsing issue"
            }
          }catch{
            return undefined
          }
        }else{
          return [{name:'admin',groups:['local/admins']},{name:'public',groups:[]}]
        }
      },
      constantsObj(){
        if(this.constants){
          try{
            var result=YAML.parse(this.constants)
            return result
          }catch{
            return undefined
          }
        }else{
          return {}
        }
      },
      formConfig(){
        try{
          return YAML.stringify({categories: YAML.parse(this.categories),roles: YAML.parse(this.roles),constants: this.constantsObj,forms: this.formsObj})
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
        var ref=this
        var warnings=[]
        var names = this.idmapping.map(x => x.name)
        var dups=names.filter((item, index) => names.indexOf(item) !== index)
        var empties=this.idmapping.filter((item, index) => !item.name)
        var parsing=this.idmapping.filter((item) => item.source=="Parsing issues")
        var badsource=this.idmapping.filter((item) => (item.source && !item.source=="Parsing issues" && (!(item.source.endsWith('.yaml')||item.source.endsWith('.yml'))||item.source.includes('/'))))
        warnings=warnings.concat(dups.map(x => `<span class="has-text-warning-dark">Form '${x}' has duplicates</span><br><span>Each form must have a unique name</span>`))
        warnings=warnings.concat(empties.map(x => `<span class="has-text-warning-dark">Empty Formname</span><br><span>Each form must have a unique name</span>`))
        warnings=warnings.concat(parsing.map(x => `<span class="has-text-warning-dark">Form '${x.name}' has bad YAML and cannot be parsed</span><br><span>${x.issue}</span>`))
        warnings=warnings.concat(badsource.map(x => `<span class="has-text-warning-dark">Form '${x.name}' has a bad 'source' property</span><br><span>A source should be valid a .yaml file.  No deep-paths are allowed.<br>Remove the source to keep it in the base file.</span>`))
        if(!this.categoriesObj){
          warnings.push(`<span class="has-text-warning-dark">Bad categories</span><span>Unable to parse categories as valid YAML</span>`)
        }
        if(!this.rolesObj){
          warnings.push(`<span class="has-text-warning-dark">Bad roles</span><span>Unable to parse roles as valid YAML</span>`)
        }
        if(!this.constantsObj){
          warnings.push(`<span class="has-text-warning-dark">Bad constants</span><span>Unable to parse constants as valid YAML</span>`)
        }
        // check field dups
        if(this.formsObj){
          this.formsObj.forEach(item=>{
            var fields=[]
            if(item.fields){
              item.fields.forEach(item2 => {
                fields.push(item2.name)
              })
              var dups = Helpers.findDuplicates(fields)
              dups.forEach((item2,i)=>{
                 warnings.push(`<span class="has-text-warning-dark">'${item2}' in form '${item.name}' has duplicates</span><br><span>Each field must have a unique name</span>`)
              })
            }
          })
        }
        return warnings
      }
    },

    methods:{
      selectfirst(){
        this.selectById(0)
      },
      selectById(id){
        if(Object.keys(this.forms).length>0){
          this.currentForm=Object.keys(this.forms)[id]
        }
      },
      selectByName(name){
        var formId=0
        formId = this.idmapping.map((x)=>{return x.name}).indexOf(name)
        if(formId>0){
          this.selectById(formId)
        }else{
          this.selectById(0)
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
          if(formConfig.constants){
            ref.constants=YAML.stringify(formConfig.constants);
          }else{
            ref.constants=""
          }
          formConfig.forms.forEach((item, i) => {
            Vue.set(ref.forms,"form_"+i,YAML.stringify(item))
          });
          if(ref.$route.query.form){
            ref.selectByName(ref.$route.query.form)
          }else{
            ref.selectfirst()
          }
          ref.loaded=true
        },function(err){
          ref.$toast.error(err)
        })
      },
      loadBackups(){
        var ref= this;
        Form.backups(function(backups){
          ref.backups=backups
          ref.loaded=true
        },function(err){
          ref.$toast.error(err)
        })
      },
      restore(){
        var ref= this;
        Form.restore(this.backupToRestore.file,this.backupBeforeRestore,function(result){
          ref.showRestore=false
          ref.$toast.success(result)
          ref.backupToRestore=undefined
          ref.loadForms()
          ref.loadBackups()
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
      getLock(){
        var ref=this
        axios.get('/api/v1/lock',TokenStorage.getAuthentication())
          .then((result)=>{
            if(result.data.status=="error" && result.data.data?.error=="Designer is disabled"){
              ref.$toast.error("The designer has been disabled")
              clearInterval(ref.lockInterval)
            }else if(result.data.status=="error"){
              ref.$toast.error(result.data?.message)
              clearInterval(ref.lockInterval)
            }else{
              ref.lock=result.data.data.output
            }
          }),function(error){
            ref.$toast.error(error.message);
            ref.lock=undefined
          };
      },
      setLock(proceed){
        var ref=this
        if(!proceed)return false
        return axios.post('/api/v1/lock',{},TokenStorage.getAuthentication())
          .then((result)=>{
            if(result.data.status=="error"){
                ref.$toast.error("Failed to set lock");
            }else{
                ref.loadAll()
            }
          }),function(error){
            ref.$toast.error(error.message);
            ref.lock=undefined
          };
      },
      unLock(){
        this.next=this.setLock
        this.showForce=true
      },
      releaseLock(){
        if(this.formDirty){
          this.next=this.deleteLock
          this.showDirty=true
        }else{
          this.deleteLock(true)
        }
      },
      deleteLock(proceed){
        var ref=this
        if(!proceed)return false
        return axios.delete('/api/v1/lock',{},TokenStorage.getAuthentication())
          .then((result)=>{
            if(result.data.status=="error"){
                ref.$toast.error("Failed to remove lock");
                ref.lock=undefined
            }else{
              // ref.$toast.success(result.data.message);
              ref.loadAll()
            }
          }),function(error){
            ref.$toast.error(error.message);
          };
      },
      loadAll(){
        this.loadForms();
        this.loadBackups();
        this.getLock();
      },
      save(close=false) {
       var ref= this;
       this.$refs.saveButton.focus()
       this.$nextTick(()=>{
         if(ref.warnings.length==0 && ref.formConfig && ref.formDirty){
           axios.post('/api/v1/config/',{forms:ref.formConfig},TokenStorage.getAuthentication())
             .then((result)=>{
               if(result.data.status=="error"){
                 ref.$toast.error(result.data.data.error);
               }else{
                 ref.$toast.success(result.data.message);
                 ref.formDirty=false
                 if(close){
                   this.next(true)
                 }else{
                   ref.loadBackups()
                 }
               }
             }),function(error){
               ref.$toast.error(error.message);
             };
         }else{
           if(ref.warnings.length>0 || !ref.formConfig){
             ref.$toast.warning("Fix the warnings first")
           }else{
             ref.$toast.warning("No changes, nothing to save")
           }
         }
       })



      },
      editorInit: function () {
          // vue2-code-editor/node_modules/
          require('brace/ext/language_tools') //language extension prerequsite...
          require('brace/mode/yaml')
          require('brace/theme/monokai')
      }
    },
    mounted() { // when the Vue app is booted up, this is run automatically.
      var ref=this
      this.loadAll();
      this.lockInterval=setInterval(this.getLock,5000) // reload running jobs every 2s
    },
    beforeRouteLeave (to, from , next) {
      if(this.formDirty){
        this.next=next
        this.showDirty=true
      }else{
        next(true)
      }
    },
    beforeDestroy(){
      clearInterval(this.lockInterval)
    },
    beforeMount() {
      var ref=this
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
  .pop-enter-active,
  .pop-leave-active {
    transform: scale(1.2);
    transition: all 0.2s ease-in-out;
  }
  .pop-enter,
  .pop-leave-to {
    transform: scale(1);
  }
</style>
