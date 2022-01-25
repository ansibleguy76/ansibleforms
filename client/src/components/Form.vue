<template>
  <section class="section has-background-light">
    <BulmaQuickView v-if="warnings && showWarnings" title="Form warnings" footer="" @close="showWarnings=false">
        <p v-for="w,i in warnings" :key="'warning'+i" class="mb-3" v-html="w"></p>
    </BulmaQuickView>
    <div class="container" v-if="formIsReady">
      <div class="columns">
        <div class="column">
          <h1 class="title">{{ currentForm.name }} <span v-if="currentForm.help" class="tag is-info is-clickable" @click="showHelp=!showHelp"><span class="icon"><font-awesome-icon icon="question-circle" /></span><span v-if="showHelp">Hide help</span><span v-else>Show help</span></span></h1>
          <article v-if="currentForm.help && showHelp" class="message is-info">
            <div class="message-body content"><VueShowdown :markdown="currentForm.help" flavor="github" :options="{ghCodeBlocks:true}" /></div>
          </article>
          <button @click="generateJsonOutput();showJson=true" class="button is-info is-small mr-3">
            <span class="icon">
              <font-awesome-icon icon="eye" />
            </span>
            <span>Show Extravars</span>
          </button>
          <button v-if="warnings.length>0" @click="showWarnings=!showWarnings" class="button is-small is-outlined is-warning">
            <span class="icon">
              <font-awesome-icon icon="exclamation-triangle" />
            </span>
            <span class="mr-1">{{(showWarnings)?'Hide':'This form has'}} Warnings </span>
          </button>
          <div :key="group" v-for="group in fieldgroups" class="mt-4">
            <div :class="{'box':checkGroupDependencies(group)}">
              <h3 class="title is-3" v-if="checkGroupDependencies(group)">{{group}}</h3>
                <div :key="field.name" v-for="field in filterfieldsByGroup(group)">
                  <transition name="slide">
                    <div class="field mt-3" v-if="visibility[field.name]">
                      <!-- add field label -->
                      <label class="label has-text-primary">{{ field.label }} <span v-if="field.required" class="has-text-danger">*</span>
                        <span
                          class="icon is-clickable has-text-success"
                          @click="setExpressionFieldEditable(field.name,true)"
                          v-if="field.editable && field.type=='expression' && !fieldOptions[field.name].editable"
                        >
                          <font-awesome-icon icon="pencil-alt" />
                        </span>
                        <span
                          class="icon is-clickable has-text-danger"
                          @click="setExpressionFieldEditable(field.name,false)"
                          v-if="field.editable && field.type=='expression' && fieldOptions[field.name].editable"
                        >
                          <font-awesome-icon icon="times" />
                        </span>
                      </label>
                      <!-- type = checkbox -->
                      <div v-if="field.type=='checkbox'">
                        <BulmaCheckRadio checktype="checkbox" v-model="$v.form[field.name].$model" :name="field.name" :type="{'is-danger is-block':$v.form[field.name].$invalid}" :label="field.placeholder" @change="evaluateDynamicFields(field.name)" />
                      </div>
                      <!-- type = query -->
                      <BulmaAdvancedSelect
                        v-if="field.type=='query'"
                        :defaultValue="field.default"
                        :required="field.required||false"
                        :multiple="field.multiple||false"
                        :name="field.name"
                        :placeholder="field.placeholder||'Select...'"
                        :values="queryresults[field.name]||[]"
                        :hasError="$v.form[field.name].$invalid"
                        :isLoading="!['fixed','variable'].includes(dynamicFieldStatus[field.name])"
                        v-model="$v.form[field.name].$model"
                        :icon="field.icon"
                        :columns="field.columns||[]"
                        :pctColumns="field.pctColumns||[]"
                        :previewColumn="field.previewColumn||''"
                        :valueColumn="field.valueColumn||''"
                        @ischanged="evaluateDynamicFields(field.name)"
                        :sticky="field.sticky||false"
                        >
                      </BulmaAdvancedSelect>
                      <!-- type = radio -->
                      <div v-if="field.type=='radio'" >
                        <BulmaCheckRadio :val="radiovalue" checktype="radio" v-for="radiovalue in field.values" :key="field.name+'_'+radiovalue" v-model="$v.form[field.name].$model" :name="field.name" :type="{'is-danger is-block':$v.form[field.name].$invalid}" :label="radiovalue"  @change="evaluateDynamicFields(field.name)" />
                      </div>
                      <BulmaEditTable v-if="field.type=='table'" :tableFields="field.tableFields" :click="false" tableClass="table is-striped is-bordered is-narrow" v-model="$v.form[field.name].$model" />
                      <div :class="{'has-icons-left':!!field.icon && field.type!='query'}" class="control">
                        <!-- type = expression -->
                        <div v-if="field.type=='expression'" :class="{'is-loading':(dynamicFieldStatus[field.name]==undefined || dynamicFieldStatus[field.name]=='running') &! fieldOptions[field.name].editable}" class="control">
                          <input type="text"
                            @focus="inputFocus"
                            :class="{'is-danger':$v.form[field.name].$invalid,'has-text-info':!fieldOptions[field.name].editable}"
                            v-model="$v.form[field.name].$model"
                            class="input"
                            :readonly="!fieldOptions[field.name].editable"
                            :name="field.name"
                            :required="field.required"
                            @change="evaluateDynamicFields(field.name)"
                            >
                        </div>
                        <!-- type = text or password-->
                        <input v-if="field.type=='text' || field.type=='password'"
                          @focus="inputFocus"
                          :class="{'is-danger':$v.form[field.name].$invalid}"
                          v-model="$v.form[field.name].$model"
                          class="input" :name="field.name"
                          v-bind="field.attrs"
                          :required="field.required"
                          :type="field.type"
                          :placeholder="field.placeholder"
                          @keydown="(field.keydown)?evaluateDynamicFields(field.name):null"
                          @change="evaluateDynamicFields(field.name)">
                        <!-- type = number -->
                        <input v-if="field.type=='number'"
                          @focus="inputFocus"
                          :class="{'is-danger':$v.form[field.name].$invalid}"
                          v-model="$v.form[field.name].$model"
                          class="input"
                          :name="field.name"
                          v-bind="field.attrs"
                          :required="field.required"
                          type="number"
                          :placeholder="field.placeholder"
                          @change="evaluateDynamicFields(field.name)">
                        <!-- type = enum -->
                        <div v-if="field.type=='enum' && !field.multiple" class="select">
                          <select
                            :name="field.name"
                            @focus="inputFocus"
                            :class="{'is-danger':$v.form[field.name].$invalid}"
                            v-model="$v.form[field.name].$model"
                            @change="evaluateDynamicFields(field.name)">
                            <option v-if="!field.required" value=""></option>
                            <option v-for="option in field.values" :key="option" :selected="field.default==option" :value="option">{{ option }}</option>
                          </select>
                        </div>
                        <!-- type = multiple enum -->
                        <div v-if="field.type=='enum' && (field.multiple||false)==true" class="select is-multiple">
                          <select
                            :name="field.name"
                            @focus="inputFocus"
                            :class="{'is-danger':$v.form[field.name].$invalid}"
                            v-model="$v.form[field.name].$model"
                            multiple
                            :size="field.size">
                            <option v-if="!field.required" value=""></option>
                            <option v-for="option in field.values" :key="option" :selected="field.default.includes(option)" :value="option">{{ option }}</option>
                          </select>
                        </div>

                        <!-- add left icon, but not for query, because that's a component with icon builtin -->
                        <span v-if="!!field.icon && field.type!='query'" class="icon is-small is-left">
                          <font-awesome-icon :icon="field.icon" />
                        </span>
                      </div>
                      <!-- add help and alerts -->
                      <p class="help" v-if="!!field.help">{{ field.help}}</p>
                      <p class="has-text-danger" v-if="$v.form[field.name].required==false">This field is required</p>
                      <p class="has-text-danger" v-if="'minLength' in $v.form[field.name] && !$v.form[field.name].minLength">Must be at least {{$v.form[field.name].$params.minLength.min}} characters long</p>
                      <p class="has-text-danger" v-if="'maxLength' in $v.form[field.name] && !$v.form[field.name].maxLength">Can not be more than {{$v.form[field.name].$params.maxLength.max}} characters long</p>
                      <p class="has-text-danger" v-if="'minValue' in $v.form[field.name] && !$v.form[field.name].minValue">Value cannot be lower than {{$v.form[field.name].$params.minValue.min}}</p>
                      <p class="has-text-danger" v-if="'maxValue' in $v.form[field.name] && !$v.form[field.name].maxValue">Value cannot be higher than {{$v.form[field.name].$params.maxValue.max}}</p>
                      <p class="has-text-danger" v-if="'regex' in $v.form[field.name] && !$v.form[field.name].regex">{{$v.form[field.name].$params.regex.description}}</p>
                      <p class="has-text-danger" v-if="'notIn' in $v.form[field.name] && !$v.form[field.name].notIn">{{$v.form[field.name].$params.notIn.description}}</p>
                      <p class="has-text-danger" v-if="'in' in $v.form[field.name] && !$v.form[field.name].in">{{$v.form[field.name].$params.in.description}}</p>
                      <p class="has-text-danger" v-if="'sameAs' in $v.form[field.name] && !$v.form[field.name].sameAs">Field must be identical to '{{$v.form[field.name].$params.sameAs.eq}}'</p>

                    </div>
                  </transition>
                </div>
            </div>
          </div>

          <hr v-if="!!currentForm" />
          <button v-if="!!currentForm && !ansibleResult.message" class="button is-primary is-fullwidth" @click="ansibleResult.message='initializing'"><span class="icon"><font-awesome-icon icon="play" /></span><span>Run</span></button>
          <div class="columns">
            <div class="column">
              <button v-if="!!ansibleResult.message" class="button is-fullwidth" @click="resetResult()" :class="{ 'has-background-success' : ansibleResult.status=='success', 'has-background-warning' : ansibleResult.status=='warning', 'has-background-danger' : ansibleResult.status=='error','has-background-info has-text-light cursor-progress' : ansibleResult.status=='info' }">
                <span class="icon" v-if="ansibleResult.status=='info'"><font-awesome-icon icon="spinner" spin /></span>
                <span class="icon" v-if="ansibleResult.status!='info'"><font-awesome-icon icon="times" /></span>
                <span>{{ ansibleResult.message }}</span>
              </button>
            </div>
            <div class="column" v-if="currentForm.type=='ansible' && ansibleResult.status=='info' && !abortTriggered">
              <button  class="button is-fullwidth has-background-warning" @click="abortAnsibleJob(ansibleJobId)">
                <span class="icon"><font-awesome-icon icon="times" /></span>
                <span>Abort Job</span>
              </button>
            </div>
            <div class="column" v-if="currentForm.type=='awx' && ansibleResult.status=='info' && !abortTriggered">
              <button  class="button is-fullwidth has-background-warning" @click="abortAwxJob(awxJobId)">
                <span class="icon"><font-awesome-icon icon="times" /></span>
                <span>Abort Job</span>
              </button>
            </div>
          </div>

          <div v-if="!!ansibleResult.data.output" class="box mt-3">
            <pre v-if="currentForm.type=='ansible'" v-html="ansibleResult.data.output"></pre>
            <pre v-if="currentForm.type=='awx'" v-html="ansibleResult.data.output"></pre>
          </div>
          <button v-if="!!ansibleResult.data.output" class="button has-background-danger has-text-light" @click="resetResult()">
            <span class="icon"><font-awesome-icon icon="times" /></span>
            <span>Close output</span>
          </button>
        </div>
        <div v-if="showJson" class="column">
          <h1 class="title">Extravars</h1>
          <button @click="showJson=false" class="button is-danger is-small">
            <span class="icon">
              <font-awesome-icon icon="times" />
            </span>
            <span>Close</span>
          </button>
          <button @click="generateJsonOutput()" class="ml-2 button is-info is-small">
            <span class="icon">
              <font-awesome-icon icon="sync" />
            </span>
            <span>Refresh</span>
          </button>
          <div class="box mt-4">
            <vue-json-pretty :data="formdata"></vue-json-pretty>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
<script>
  import Vue from 'vue'
  import axios from 'axios'
  import Vuelidate from 'vuelidate'
  import TokenStorage from './../lib/TokenStorage'
  import VueJsonPretty from 'vue-json-pretty';
  import BulmaAdvancedSelect from './BulmaAdvancedSelect.vue'
  import BulmaQuickView from './BulmaQuickView.vue'
  import BulmaCheckRadio from './BulmaCheckRadio.vue'
  import BulmaEditTable from './BulmaEditTable.vue'
  import 'vue-json-pretty/lib/styles.css';
  import VueShowdown from 'vue-showdown';
  import { required, minValue,maxValue,minLength,maxLength,helpers,requiredIf,sameAs } from 'vuelidate/lib/validators'

  Vue.use(Vuelidate)
  Vue.use(VueShowdown)

  export default{
    name:"Form",
    components:{VueJsonPretty,BulmaAdvancedSelect,BulmaEditTable,BulmaCheckRadio,BulmaQuickView},
    props:{
      currentForm:{type:Object}
    },
    data(){
      return  {
          formdata:{},          // the eventual object sent to the api in the correct hierarchy
          interval:undefined,   // interval how fast fields need to be re-evaluated and refreshed
          showNav: false,
          showJson: false,
          ansibleResult:{       // holds the output of an execution
            status:"",
            message:"",
            data:{
              output:"",
              error:""
            }
          },
          dynamicFieldDependencies:{},      // which fields need to be re-evaluated if other fields change
          dynamicFieldDependentOf:{},
          defaults:{},
          dynamicFieldStatus:{},    // holds the status of dynamics fields (running=currently being evaluated, variable=depends on others, fixed=only need 1-time lookup)
          queryresults:{},      // holds the results of dynamic dropdown boxes
          fieldOptions:{},      // holds a couple of fieldoptions for fast access (valueColumn,ignoreIncomplete, ...)
          warnings:[],          // holds form warnings.
          showWarnings:false,
          form:{                // the form data mapped to the form
          },
          visibility:{

          },
          canSubmit:false,
          validationsLoaded:false,
          timeout:undefined,     // determines how long we should show the result of run
          showHelp:false,
          ansibleJobId:undefined,
          awxJobId:undefined,
          abortTriggered:false
        }
    },
    validations() {     // a dynamic assignment of vuelidate validations, based on the form json
      var self=this
      var obj = {
        form:{}
      }
      this.currentForm.fields.forEach((ff, i) => {
        var attrs = {}
        var field
        var regexObj
        var description
        if(ff.type!='checkbox'){
          attrs.required=requiredIf(function(){
            return !!ff.required
          })
        }
        if(ff.type=='checkbox' && ff.required){
          attrs.required=helpers.withParams(
              {description: "This field is required"},
              (value) => (!helpers.req(value) || value==true)
          )
        }
        if("minValue" in ff){ attrs.minValue=minValue(ff.minValue)}
        if("maxValue" in ff){ attrs.maxValue=maxValue(ff.maxValue)}
        if("minLength" in ff){ attrs.minLength=minLength(ff.minLength)}
        if("maxLength" in ff){ attrs.maxLength=maxLength(ff.maxLength)}
        if("regex" in ff){
          if(typeof ff.regex == 'object'){
            regexObj = new RegExp(ff.regex.expression)
            description = (ff.regex.description!==undefined)?ff.regex.description:"The value must match regular expression : " + ff.regex.expression
            attrs.regex = helpers.withParams(
                {description: description,type:"regex"},
                (value) => !helpers.req(value) || regexObj.test(value)
            )
          }else{
            regexObj = new RegExp(ff.regex)
            description = (ff.regexDescription!==undefined)?ff.regexDescription:"The value must match regular expression : " + ff.regex
            attrs.regex = helpers.withParams(
                {description: description,type:"regex"},
                (value) => !helpers.req(value) || regexObj.test(value)
            )
          }
        }
        if("notIn" in ff){
          field = self.form[ff.notIn.field]
          if(field!=undefined && Array.isArray(field)){
            description = (ff.notIn.description!==undefined)?ff.notIn.description:"The value must not be in field '" + ff.notIn.field + "'"
            attrs.notIn = helpers.withParams(
                {description: description,type:"notIn"},
                (value) => !helpers.req(value) || !field.includes(value)
            )
          }
        }
        if("in" in ff){
          field = self.form[ff.in.field]
          if(field!=undefined && Array.isArray(field)){
            description = (ff.in.description!==undefined)?ff.in.description:"The value must not be in field '" + ff.in.field + "'"
            attrs.in = helpers.withParams(
                {description: description,type:"notIn"},
                (value) => !helpers.req(value) || field.includes(value)
            )
          }
        }
        if("sameAs" in ff){ attrs.sameAs=sameAs(ff.sameAs)}
        obj.form[ff.name]=attrs
      });
      Vue.set(this,"validationsLoaded",true)
      return obj
    },
    computed: {
      formIsReady(){
        return this.validationsLoaded && this.currentForm
      },
      fieldgroups(){      // computed list of the field-groups (to generate fieldform-sections)
        // make groupname array with empty at start
        if(this.currentForm.fields){
          return this.currentForm.fields.reduce(function(pV,cV,cI){
            if("group" in cV){
              return [...pV, cV.group];
            }else{
              return pV;
            }
          },[""]).filter((v, i, a) => a.indexOf(v) === i);
        }else{
          return []
        }

      }
    },
    methods:{
      inputFocus(e){
        e.preventDefault();
      },
      setExpressionFieldEditable(fieldname,value){
        if(typeof this.$v.form[fieldname].$model=='string' || typeof this.$v.form[fieldname].$model=='number' || this.$v.form[fieldname].$model==undefined){
          Vue.set(this.fieldOptions[fieldname],'editable',value)   // flag editable
        }else{
          this.$toast.warning("You can only edit string or number expression fields.")
        }
        if(!value){
          this.resetField(fieldname)
        }
      },
      filterfieldsByGroup(group){                   // creates a list of field per group
        return this.currentForm.fields.filter(function (el) {
          return (
            (("group" in el && el.group === group)
              || !("group" in el) && (group==""))
            && el.hide!==true)
        });
      },
      checkDependencies(field){
        var ref = this
        var result=true                          // checks if a field can be show, based on the value of other fields
        if("dependencies" in field){
          field.dependencies.forEach((item, i) => {
            if(!item.values.includes(ref.form[item.name])){
              if(ref.visibility[field.name]){
                Vue.set(ref.visibility,field.name,false)
              }
              result =false
            }else{
              if(!ref.visibility[field.name]){
                Vue.set(ref.visibility,field.name,true)
              }
            }
          });
        }
        return result
      },
      //----------------------------------------------------------------
      // check if an entire group can be shown, based on field depencies
      // hide a group if all fields inside are hidden
      //----------------------------------------------------------------
      checkGroupDependencies(group){
        var ref=this
        var result=false
        this.filterfieldsByGroup(group).forEach((item, i) => {
          if(ref.visibility[item.name]){
            result=true
          }
        });
        return result
      },
      resetField(fieldname){
        // reset to default value
        // reset this field status
        // console.log(`[${fieldname}] reset`)
        this.setFieldStatus(fieldname,undefined)
        Vue.set(this.form,fieldname,this.defaults[fieldname])
      },
      defaultField(fieldname){
        // reset to default value
        // console.log(`[${fieldname}] default`)
        if(this.defaults[fieldname]!=undefined){
          this.setFieldStatus(fieldname,"default")
        }
        else{
          this.setFieldStatus(fieldname,undefined)
        }
        Vue.set(this.form,fieldname,this.defaults[fieldname])
      },
      setFieldStatus(fieldname,status,reeval=true){
        // console.log(`[${fieldname}] ----> ${status}`)
        var prevState=this.dynamicFieldStatus[fieldname]
        Vue.set(this.dynamicFieldStatus,fieldname,status)
        if(reeval && (prevState!=status)){
          this.evaluateDynamicFields(fieldname)
        }
      },
      hasDefaultDependencies(fieldname){
        var ref=this
        var result=false
        if(this.dynamicFieldDependentOf[fieldname] && this.dynamicFieldStatus[fieldname]=="default"){
          this.dynamicFieldDependentOf[fieldname].forEach((item,i)=>{
             if((ref.defaults[item]!=undefined) && ref.dynamicFieldStatus[item]=="default"){
                 result=true
             }
          })
        }
        return result
      },
      findDuplicates(arry){
        return arry.filter((item, index) => arry.indexOf(item) !== index)
      },
      // Find variable devDependencies
      findVariableDependencies(){
        var ref=this
        var watchdog=0
        var temp={}
        var finishedFlag=false
        var foundmatch,foundfield
        var fields=[]
        // create a list of the fields
        this.currentForm.fields.forEach((item,i) => {
          fields.push(item.name)
          ref.defaults[item.name]=item.default
        })
        var dups = this.findDuplicates(fields)
        dups.forEach((item,i)=>{
          ref.warnings.push(`<span class="has-text-warning">'${item}' has duplicates</span><br><span>Each field must have a unique name</span>`)
          ref.$toast.error("You have duplicates for field '"+item+"'")
        })
        this.currentForm.fields.forEach((item,i) => {
          if(["expression","query"].includes(item.type)){
            var testRegex = /\$\(([^)]+)\)/g;
            var matches=(item.expression || item.query).matchAll(testRegex);
            for(var match of matches){
              foundmatch = match[0];                                              // found $(xxx)
              foundfield = match[1];                                              // found xxx
              var columnRegex = /(.+)\.(.+)/g;                                        // detect a "." in the field
              var tmpArr=columnRegex.exec(foundfield)                             // found aaa.bbb
              if(tmpArr && tmpArr.length>0){
                // console.log("found puntje in " + foundfield + " in " + item.name)
                foundfield = tmpArr[1]                                            // aaa
              }else{
                // console.log("found geen puntje in " + foundfield + " in " + item.name)
              }
              if(fields.includes(foundfield)){                         // does field xxx exist in our form ?
                // console.log(foundfield + " is a real field")
                if(foundfield in ref.dynamicFieldDependencies){															 // did we declare it before ?
                  if(ref.dynamicFieldDependencies[foundfield].indexOf(item.name) === -1) {  // allready in there ?
                      ref.dynamicFieldDependencies[foundfield].push(item.name);												 // push it
                      if(foundfield==item.name){
                        ref.warnings.push(`<span class="has-text-warning">'${foundfield}' has a self reference</span><br><span>This will cause a racing condition</span>`)
                        ref.$toast.error("You defined a self reference on field '"+foundfield+"'")
                      }
                  }
                }else{
                  ref.dynamicFieldDependencies[foundfield]=[item.name]
                  if(foundfield==item.name){
                    ref.warnings.push(`<span class="has-text-warning">'${foundfield}' has a self reference</span><br><span>This will cause a racing condition</span>`)
                    ref.$toast.error("You defined a self reference on field '"+foundfield+"'")
                  }
                }

              }
            }
          }
        })
        while(!finishedFlag){
          finishedFlag=true
          temp = JSON.parse(JSON.stringify(ref.dynamicFieldDependencies));   // copy dependencies to temp
          for (const [key, value] of Object.entries(temp)) {
             // loop all found dependenies and dig deeper
             value.forEach((item,i) => {
               if(item in temp){   // can we go deeper ?
                 temp[item].forEach((item2,j) => {
                    if(ref.dynamicFieldDependencies[key].indexOf(item2) === -1) {  // allready in there ?
                      ref.dynamicFieldDependencies[key].push(item2);												 // push it
                      if(key==item2){
                        ref.warnings.push(`<span class="has-text-warning">'${key}' has a self reference</span><br><span>This will cause a racing condition</span>`)
                        ref.$toast.error("You defined a self reference on field '"+key+"'")
                      }
                      finishedFlag=false
                    }
                 })
               }
             })
          }
        }
      },
      findVariableDependentOf(){
        var ref=this
        var watchdog=0
        var foundDependentDefaults=false
        var temp={}
        var finishedFlag=false
        var foundmatch,foundfield
        var fields=[]
        // create a list of the fields
        this.currentForm.fields.forEach((item,i) => {
          fields.push(item.name)
        })
        this.currentForm.fields.forEach((item,i) => {
          if(["expression"].includes(item.type)){
            var testRegex = /\$\(([^)]+)\)/g;
            var matches=(item.expression || item.query).matchAll(testRegex);
            for(var match of matches){
              foundmatch = match[0];                                              // found $(xxx)
              foundfield = match[1];                                              // found xxx
              var columnRegex = /(.+)\.(.+)/g;                                        // detect a "." in the field
              var tmpArr=columnRegex.exec(foundfield)                             // found aaa.bbb
              if(tmpArr && tmpArr.length>0){
                // console.log("found puntje in " + foundfield + " in " + item.name)
                foundfield = tmpArr[1]                                            // aaa
              }else{
                // console.log("found geen puntje in " + foundfield + " in " + item.name)
              }
              if(fields.includes(foundfield)){                         // does field xxx exist in our form ?
                // console.log(foundfield + " is a real field")
                if(item.name in ref.dynamicFieldDependentOf){															 // did we declare it before ?
                  if(ref.dynamicFieldDependentOf[item.name].indexOf(foundfield) === -1) {  // allready in there ?
                       ref.dynamicFieldDependentOf[item.name].push(foundfield);												 // push it
                  }
                }else{
                  ref.dynamicFieldDependentOf[item.name]=[foundfield]
                }
                // console.log(`${item.name} - ${foundfield}`)
                if((ref.defaults[item.name]!=undefined) && ref.fieldOptions[foundfield] && (ref.fieldOptions[foundfield].type=="expression") && (ref.defaults[foundfield]!=undefined)){
                  foundDependentDefaults=true
                  ref.warnings.push(`<span class="has-text-warning">'${item.name}' has a default, referencing field '${foundfield}' which also has a default</span><br><span>Try to avoid dependent fields with both a default</span>`)
                }
              }
            }
          }
        })
        if(foundDependentDefaults){
          //ref.$toast.error("You should avoid having dependent expression defaults.\nIt can lead to infinite expression evalutations.")
        }
      },
      replacePlaceholders(item){
        //---------------------------------------
        // replace placeholders if possible
        //---------------------------------------
        var ref = this
        var testRegex = /\$\(([^)]+)\)/g;                                       // a regex to find field placeholders $(xxx)
        var retestRegex = /\$\(([^)]+)\)/g;                                     // the same regex, to retest after, because a regex can only be used once
        var match = undefined
        var matches =undefined
        var foundmatch=false
        var column=""
        var foundfield=false
        var fieldvalue=""
        var keys = undefined
        var targetflag=undefined
        var hasPlaceholders = false;
        var newValue = item.expression || item.query                                                    // make a copy of our item
        // console.log("item = " + newValue)
        matches=(item.expression || item.query).matchAll(testRegex);
        // console.log("matches : " + matches.length)
        for(match of matches){
            // console.log("-> match : " + match[0] + "->" + match[1])
            foundmatch = match[0];                                              // found $(xxx)
            foundfield = match[1];                                              // found xxx
            var columnRegex = /(.+)\.(.+)/g;                                        // detect a "." in the field
            var tmpArr=columnRegex.exec(foundfield)                             // found aaa.bbb
            if(tmpArr && tmpArr.length>0){
              foundfield = tmpArr[1]                                            // aaa
              column=tmpArr[2]                                                  // bbb
            }else{
              if(foundfield in ref.fieldOptions){
                column=ref.fieldOptions[foundfield].placeholderColumn||""        // get placeholder column
              }

            }
            fieldvalue = ""
            targetflag = undefined
            // mark the field as a dependent field
            if(foundfield in ref.form){      // does field xxx exist in our form ?
              if(ref.fieldOptions[foundfield] && ref.fieldOptions[foundfield].type=="expression" && (typeof ref.form[foundfield]=="object")){
                fieldvalue=JSON.stringify(ref.form[foundfield])
              }else{
                fieldvalue = ref.getFieldValue(ref.form[foundfield],column,false);// get value of xxx
              }

              if(foundfield in ref.dynamicFieldStatus){
                targetflag = ref.dynamicFieldStatus[foundfield];                  // and what is the currect status of xxx, in case it's also dyanmic ?
              }else{
                targetflag = "fixed"
              }
            }

            // if the variable is viable and not being changed, replace it
            // console.log(foundfield + "("+fieldvalue+")" + " -> targetflag = " + targetflag)
            // console.log(foundfield + " -> targetflag = " + targetflag)
            if(((targetflag=="variable"||targetflag=="fixed"||targetflag=="default") && fieldvalue!==undefined && newValue!=undefined)||((item.ignoreIncomplete||false) && newValue!=undefined)){                // valid value ?
                if(fieldvalue==undefined){
                  fieldvalue="__undefined__"   // catch undefined values
                }
                fieldvalue=ref.stringifyValue(fieldvalue)
                 // console.log("replacing placeholder")
                newValue=newValue.replace(foundmatch,fieldvalue);               // replace the placeholder with the value
                 // console.log("replaced")
                 // console.log(item.name + " -> " + newValue)
            }else{
                // if(item.alwaysEval){
                //   newValue=newValue.replace(foundmatch,"undefined");               // replace the placeholder with undefined
                // }else{
                  newValue=ref.stringifyValue(item.default)      // cannot evaluate yet
                  // we have a placeholder but it's value is not ready yet... will be for next loop
                  // console.log("dependency ("+foundfield+") is not ready (" + targetflag + " : " + fieldvalue + ")")
                // }
            }
            hasPlaceholders=true;
        }
        if(retestRegex.test(newValue)){                                         // still placeholders found ?
            newValue=ref.stringifyValue(item.default)                           // cannot evaluate yet
        }
        if(newValue!=undefined){
           newValue=newValue.replace("'__undefined__'","undefined")  // replace undefined values
           newValue=newValue.replace("__undefined__","undefined")
        }
        return {"hasPlaceholders":hasPlaceholders,"value":newValue}          // return the result
      },
      stringifyValue(fieldvalue){
        if(typeof fieldvalue==='object' || Array.isArray(fieldvalue)){
          return JSON.stringify(fieldvalue) // if object, we need to stringify it
        }else{
          return fieldvalue
        }
      },
      //----------------------------------------------------------------
      // starts the evaluation of dynamic fields (expression or query)
      //----------------------------------------------------------------
      startDynamicFieldsLoop() {
        // console.log("invoking field expressions and queries")
        var ref=this;                                                           // a reference to 'this'
        var watchdog=0;                                                         // a counter how many times we retry to find a value
        var refreshCounter=0;                                                   // a counter to refresh the json output
        var hasUnevaluatedFields=false;                                         // a flag to check whether a have unevaluated fields
        // does the eval every x seconds ; this.interval
        // this is is sequential, however, with async lookup, this can overlap
        // however, since we flag fields as 'running' during async lookups
        // this should not cause issues.
        this.interval = setInterval(function() {
          //console.log("enter loop");
          hasUnevaluatedFields=false;                                           // reset flag
          // console.log("-------------------------------")
          ref.currentForm.fields.forEach(
            function(item,index){
              ref.checkDependencies(item)
              if(ref.visibility[item.name]){  // only if they are visible
                // if expression and not processed yet or needs to be reprocessed
                var flag = ref.dynamicFieldStatus[item.name];                     // current field status (running/fixed/variable)
                var placeholderCheck=undefined;                                   // result for a placeholder check
                if(((item.type=="expression" && item.expression) || (item.type=="query" && item.expression)) && (flag==undefined || ref.hasDefaultDependencies(item.name) )){                // if expression and not evaluated yet
                  // console.log("eval expression " + item.name)
                  // console.log(`[${item.name}][${flag}] : evaluating`)
                  if(item.required){
                    hasUnevaluatedFields=true                                       // set the un-eval flag if this is required
                  }
                  // set flag running
                  ref.setFieldStatus(item.name,"running",false)
                  placeholderCheck = ref.replacePlaceholders(item)     // check and replace placeholders
                  // console.log(`[${item.name}] 1 : ${placeholderCheck.value}`)
                  if(placeholderCheck.value!=undefined){                       // expression is clean ?
                      // console.log(`[${item.name}] 2 : ${placeholderCheck.value}`)
                      // allow local run in browser
                      if(item.runLocal){
                        //console.log("Running local expression : " + placeholderCheck.value)
                        var result
                        try{
                          result=eval(placeholderCheck.value)
                          Vue.set(ref.form, item.name, result);
                          if(placeholderCheck.hasPlaceholders){                 // if placeholders were found we set this a variable dynamic field.
                            // set flag as viable variable query
                            // console.log("Expression found with variables")
                            ref.setFieldStatus(item.name,"variable")
                            //
                          }else{
                            // set flag as viable fixed query
                            ref.setFieldStatus(item.name,"fixed") // if this dynamic field was a 1 time evaluation, set as fixed
                          }
                        }catch(err){
                          //console.log("Local eval failed : " + err)
                          try{
                            ref.defaultField(item.name)
                          }catch(err){
                            ref.stopLoop()
                          }
                        }

                      }else{
                        axios.post("/api/v1/expression",{expression:placeholderCheck.value},TokenStorage.getAuthentication())
                          .then((result)=>{
                            var restresult = result.data
                            if(restresult.status=="error"){
                              // console.log(restresult.data.error)
                              ref.resetField(item.name)
                            }
                            if(restresult.status=="success"){
                              // console.log("expression for "+item.name+" triggered : result found -> "+ JSON.stringify(restresult.data.output));
                              if(item.type=="expression") Vue.set(ref.form, item.name, restresult.data.output);
                              if(item.type=="query") Vue.set(ref.queryresults, item.name, [].concat(restresult.data.output??[]));

                              // expression returned undefined, so lets set to default if we have one
                              if(restresult.data.output==undefined && (item.default!=undefined)){
                                if(item.type=="expression"){
                                  ref.defaultField(item.name)
                                }else{
                                  ref.resetField(item.name)
                                }

                              }else{
                                if(placeholderCheck.hasPlaceholders){                 // if placeholders were found we set this a variable dynamic field.
                                  // set flag as viable variable query
                                  // console.log(`[${item.name}] : variable`)
                                  ref.setFieldStatus(item.name,"variable")
                                }else{
                                  // set flag as viable fixed query
                                  ref.setFieldStatus(item.name,"fixed")  // if this dynamic field was a 1 time evaluation, set as fixed
                                }
                              }
                            }

                          }).catch(function (error) {
                                // console.log('Error ' + error.message)
                                try{
                                  ref.defaultField(item.name)
                                }catch(err){
                                  ref.stopLoop()
                                }
                          })
                      }



                  }else{
                    // console.log(item.name + " is not evaluated yet");
                    ref.defaultField(item.name)
                  }
                } else if(((item.type=="query" && item.query) || (item.type=="expression" && item.query)) && flag==undefined){
                   // console.log("eval query : " + item.name)
                  // set flag running
                  if(item.required){
                    hasUnevaluatedFields=true
                  }
                  ref.setFieldStatus(item.name,"running",false)
                  placeholderCheck = ref.replacePlaceholders(item)     // check and replace placeholders
                  if(placeholderCheck.value!=undefined){                       // expression is clean ?
                     // console.log(placeholderCheck);
                    // execute query

                    axios.post("/api/v1/query",{query:placeholderCheck.value,config:item.dbConfig},TokenStorage.getAuthentication())
                      .then((result)=>{
                        var restresult = result.data
                        if(restresult.status=="error"){
                           //console.log(restresult.data.error)
                           ref.resetField(item.name)
                        }
                        if(restresult.status=="success"){
                           //console.log("query "+item.name+" triggered : items found -> "+ restresult.data.output.length);
                          if(item.type=="query"){
                            Vue.set(ref.queryresults, item.name, restresult.data.output);
                          }else{
                            Vue.set(ref.form, item.name, restresult.data.output);
                          }
                          if(placeholderCheck.hasPlaceholders){
                            // set flag as viable variable query
                            ref.setFieldStatus(item.name,"variable")

                          }else{
                            // set flag as viable fixed query
                            ref.setFieldStatus(item.name,"fixed")
                          }
                        }

                      }).catch(function (err) {
                          // console.log('Error ' + err.message)
                          try{
                            ref.resetField(item.name)
                          }catch(err){
                            ref.$toast("Cannot reset field status " + item.name)
                          }

                      })


                  }else{
                    //console.log(item.name + " is not evaluated yet");
                    try{
                      ref.resetField(item.name)
                    }catch(err){
                      ref.$toast("Cannot reset field status " + item.name)
                    }
                  }
                }
              }else{  // not visible field
                if(item.type=="expression"){
                  ref.defaultField(item.name)
                }else{
                  ref.resetField(item.name)
                }

              }

            } // end loop function
          ) // end field loop
          if(hasUnevaluatedFields){
            ref.canSubmit=false;
            watchdog++                       // keeps track of how many loop it takes to evaluate all fields
          }

          if(!hasUnevaluatedFields){
            ref.canSubmit=true;
            if(watchdog>0){
              //ref.$toast.info("All fields are found")
            }
            watchdog=0
          }
          if(ref.ansibleResult.message=="initializing"){ // has a request been made to execute ?
            // ref.$toast.info("Requesting execution")
            if(ref.validateForm()){  // form is valid ?
              ref.ansibleResult.message="stabilizing"
              // ref.$toast.info("Waiting for form to stabilize")
              watchdog=0
            }else{
              ref.ansibleResult.message="" // reset status, form not valid
            }
          }
          if(ref.ansibleResult.message=="stabilizing"){ // are we waiting to execute ?
            if(ref.canSubmit){
              ref.ansibleResult.message="triggering execution"
              ref.executeForm()
            }else{
              // continue to stabilize
              if(watchdog>15){  // is it taking too long ?
                ref.ansibleResult.message=""   // stop and reset
                ref.$toast.warning("It is taking too long to evaluate all fields before run")
              }else{
                // ref.$toast.info("Stabalizing form...")
              }
            }
          }
          refreshCounter++;
          if(refreshCounter%10==0){
            ref.generateJsonOutput() // refresh json output
          }
        },100); // end interval
      },
      resetResult(){
        this.ansibleResult={
          status:"",
          message:"",
          data:{
            output:"",
            error:""
          }
        };
      },
      evaluateDynamicFields(fieldname) {
          var ref=this;
          // console.log(`[${fieldname}] eval trigger`)
          // if this field is dependency
          if(fieldname in ref.dynamicFieldDependencies){  // are any fields dependent from this field ?
            ref.canSubmit=false; // after each dependency reset, we block submitting, untill all fields are resolved
            // set all variable ones to dirty
            ref.dynamicFieldDependencies[fieldname].forEach((item,i) => { // loop all dynamic fields and reset them
                // set all variable fields blank and re-evaluate
                if(!ref.fieldOptions[item].editable){
                  ref.resetField(item)
                  // ref.setFieldStatus(item,undefined)
                  // Vue.set(ref.form,item,undefined);                // reset value in the form
                }
            })
          }
      },
      getAwxJob(id,final){
        var ref = this;
        // console.log("=============================")
        // console.log("getting awx job")
        axios.get("/api/v1/awx/job/" + id,TokenStorage.getAuthentication())
          .then((result)=>{
              // if we have decent data
              // console.log("job result - " + JSON.stringify(result))
              if(result.data.data!==undefined){
                // import the data if output returned
                if(result.data.data.output!=""){
                  this.ansibleResult=result.data;
                }else{
                  // else, just import message & status
                  this.ansibleResult.status = result.data.status
                  this.ansibleResult.message = result.data.message
                }
                // if not final status, keep checking after 2s
                if(this.ansibleResult.status!="success" && this.ansibleResult.status!="error" && this.ansibleResult.status!="warning"){
                  // this.$toast.info(result.data.message)
                  setTimeout(function(){ ref.getAwxJob(id) }, 2000);
                }else{
                  if(!final){
                    // 1 final last call for output
                    setTimeout(function(){ ref.getAwxJob(id,true) }, 2000);
                  }else{
                    this.abortTriggered=false
                    if(this.ansibleResult.status=="success"){
                      this.$toast.success(result.data.message)
                    }else if(this.ansibleResult.status=="warning"){
                      this.$toast.warning(result.data.message)
                    }else{
                      this.$toast.error(result.data.message)
                    }
                    clearTimeout(this.timeout)
                  }

                }
              }else{
                // no data ? check again after 2s
                // console.log("geen data")
                setTimeout(function(){ ref.getAwxJob(id) }, 2000);
              }
          })
          .catch(function(err){
            console.log("error getting awx job " + err)
            ref.$toast.error("Failed to get awx job");
            if(err.response.status!=401){
              ref.ansibleResult.message="Error in axios call to get awx job\n\n" + err
              ref.ansibleResult.status="error";
            }
          })
      },
      abortAnsibleJob(id){
        var ref=this
        this.$toast.warning("Aborting job " + id);
        axios.post("/api/v1/ansible/job/" + id + "/abort",{},TokenStorage.getAuthentication())
          .then((result)=>{
            ref.abortTriggered=true
          })
      },
      abortAwxJob(id){
        var ref=this
        this.$toast.warning("Aborting job " + id);
        axios.post("/api/v1/awx/job/" + id + "/abort",{},TokenStorage.getAuthentication())
          .then((result)=>{
            ref.abortTriggered=true
          })
      },
      getAnsibleJob(id,final){
        var ref = this;
        // console.log("=============================")
        // console.log("getting awx job")
        axios.get("/api/v1/ansible/job/" + id,TokenStorage.getAuthentication())
          .then((result)=>{
              // if we have decent data
              // console.log("job result - " + JSON.stringify(result))
              if(result.data.data!==undefined){
                // import the data if output returned
                if(result.data.data.output!=""){
                  this.ansibleResult=result.data;
                }else{
                  // else, just import message & status
                  this.ansibleResult.status = result.data.status
                  this.ansibleResult.message = result.data.message
                }
                // if not final status, keep checking after 2s
                if(this.ansibleResult.status!="success" && this.ansibleResult.status!="error" && this.ansibleResult.status!="warning"){
                  // this.$toast.info(result.data.message)
                  setTimeout(function(){ ref.getAnsibleJob(id) }, 2000);
                }else{
                  if(!final){
                    // 1 final last call for output
                    setTimeout(function(){ ref.getAnsibleJob(id,true) }, 2000);
                  }else{
                    // if final, remove output after 15s
                    this.abortTriggered=false
                    if(this.ansibleResult.status=="success"){
                      this.$toast.success(result.data.message)
                    }else if(this.ansibleResult.status=="warning"){
                      this.$toast.warning(result.data.message)
                    }else{
                      this.$toast.error(result.data.message)
                    }
                    clearTimeout(this.timeout)
                    // this.timeout = setTimeout(function(){ ref.resetResult() }, 15000);
                  }

                }
              }else{
                // no data ? check again after 2s
                // console.log("geen data")
                setTimeout(function(){ ref.getAnsibleJob(id) }, 2000);
              }
          })
          .catch(function(err){
            console.log("error getting ansible job " + err)
            ref.$toast.error("Failed to get ansible job");
            if(err.response.status!=401){
              ref.ansibleResult.message="Error in axios call to get ansible job\n\n" + err
              ref.ansibleResult.status="error";
            }
          })
      },
      getFieldValue(field,column,keepArray){
        var keys=undefined
        var key=undefined
        var wasArray=false
        if(field){
          if(Array.isArray(field)){
            wasArray=true
          }else{
            field = [].concat(field ?? []); // force to array
          }
          if(field.length>0){                    // not emtpy
            if(typeof field[0]==="object"){      // array of objects, analyse first object
              keys = Object.keys(field[0])    // get properties
              if(keys.length>0){
                key = (keys.includes(column))?column:keys[0] // get column, fall back to first
                field=field.map((item,i) => ((item)?(item[key]??item):undefined))  // flatten array
              }else{
                field=(!keepArray)?undefined:field // force undefined if we don't want arrays
              }
            } // no else, array is already flattened
            field=(!wasArray || !keepArray)?field[0]:field // if it wasn't an array, we take first again

          }else{
            field=(!keepArray)?undefined:field // force undefined if we don't want arrays
          }
        }
        return field
      },
      generateJsonOutput(){
        var ref=this
        this.formdata={}
        this.currentForm.fields.forEach((item, i) => {
          // this.checkDependencies(item) // hide field based on dependency
          if(this.visibility[item.name] && !item.noOutput){
            var fieldmodel = item.model
            var outputObject = item.outputObject || item.type=="expression" || item.type=="table" || false
            var outputValue = this.form[item.name]
            // if no model is given, we assign to the root
            if(!outputObject){  // do we need to flatten output ?
              outputValue=this.getFieldValue(outputValue,item.valueColumn || "",true)
            }
            if(fieldmodel=="" || fieldmodel===undefined){
              this.formdata[item.name]=outputValue
            }else{
              // convert fieldmodel for actual object
              // svm.lif.name => svm["lif"].name = formvalue
              // using reduce, which is a recursive function
              fieldmodel.split(/\s*\.\s*/).reduce((master,obj, level,arr) => {
                // if last
                if (level === (arr.length - 1)){
                    // the last piece we assign the value to
                    master[obj]=outputValue
                }else{
                    // initialize first time to object
                    if(master[obj]===undefined){
                      master[obj]={}
                    }
                }
                // return the result for next reduce iteration
                return master[obj]

              },ref.formdata);
            }
          }
        });

      },
      validateForm(){
        var ref=this
        var isValid=true
        // final touch to force validation
        this.$v.form.$touch();
        // loop all fields and check if it valid, skip hidden fields
        this.currentForm.fields.forEach((item, i) => {
          if(this.visibility[item.name] && this.$v.form[item.name].$invalid){
            isValid=false
          }
        })
        if(!isValid){
            ref.$toast.warning("Form contains invalid data")
            return false // do not start if form is invalid
        }else{
          return true
        }
      },
      executeForm(){
        // make sure, no delayed stuff is started.
        //
        var ref=this
        var postdata={}
        if(ref.validateForm){ // final validation

          this.generateJsonOutput()
          // local ansible
          if(this.currentForm.type=="ansible"){
            postdata.ansibleExtraVars = this.formdata
            postdata.formName = this.currentForm.name;
            postdata.ansibleInventory = this.currentForm.inventory;
            postdata.ansibleCheck = this.currentForm.check;
            postdata.ansibleDiff = this.currentForm.diff;
            postdata.ansiblePlaybook = this.currentForm.playbook;
            postdata.ansibleTags = this.currentForm.tags || "";
            postdata.credentials = {}
            this.currentForm.fields
              .filter(f => f.asCredential==true)
              .forEach(f => {
                postdata.credentials[f.name]=this.formdata[f.name]
              })
            this.ansibleResult.message= "Connecting with ansible ";
            this.ansibleResult.status="info";
            axios.post("/api/v1/ansible/launch",postdata,TokenStorage.getAuthentication())
              .then((result)=>{
                if(result){
                  this.ansibleResult=result.data;
                  if(result.data.data.error!=""){
                    ref.$toast.error(result.data.data.error)
                  }
                  // get the jobid
                  var jobid =  this.ansibleResult.data.output.id
                  ref.ansibleJobId=jobid
                  // don't show the whole json part
                  this.ansibleResult.data.output = ""
                  // wait for 2 seconds, and get the output of the job
                  setTimeout(function(){ ref.getAnsibleJob(jobid) }, 2000);
                }else{
                  ref.$toast.error("Failed to invoke ansible")
                  ref.resetResult()
                }
              })
              .catch(function(err){
                ref.$toast.error("Failed to invoke ansible " + err)
                if(err.response.status!=401){
                  ref.resetResult()
                }
              })

          // remote awx
          }else if(this.currentForm.type=="awx"){
            postdata.awxExtraVars = this.formdata
            postdata.awxInventory = this.currentForm.inventory;
            postdata.awxCheck = this.currentForm.check;
            postdata.awxDiff = this.currentForm.diff;
            postdata.awxTemplate = this.currentForm.template;
            postdata.awxTags = this.currentForm.tags;
            this.ansibleResult.message= "Connecting with awx ";
            this.ansibleResult.status="info";
            postdata.credentials = {}
            this.currentForm.fields
              .filter(f => f.asCredential==true)
              .forEach(f => {
                postdata.credentials[f.name]=this.formdata[f.name]
              })
            axios.post("/api/v1/awx/launch/",postdata,TokenStorage.getAuthentication())
              .then((result)=>{
                  if(result){
                    this.ansibleResult=result.data;
                    if(result.data.data.error!=""){
                      ref.$toast.error(result.data.data.error)
                    }else{
                      // get the jobid
                      var jobid =  this.ansibleResult.data.output.id
                      ref.awxJobId=jobid
                      // don't show the whole json part
                      this.ansibleResult.data.output = ""
                      // wait for 2 seconds, and get the output of the job
                      setTimeout(function(){ ref.getAwxJob(jobid) }, 2000);
                    }
                  }else{
                    ref.$toast.error("Failed to invoke AWX")
                    ref.resetResult()
                  }
              })
              .catch(function(err){
                ref.$toast.error("Failed to invoke AWX")
                if(err.response.status!=401){
                  ref.resetResult()
                }
              })
            }
         }
      }
    },
    mounted() { // when the Vue app is booted up, this is run automatically.
      this.resetResult();
      var ref=this
      this.form={}
      // find all variable dependencies
      this.findVariableDependencies()
      // initialize defaults
      this.currentForm.fields.forEach((item, i) => {
        if(["expression","query"].includes(item.type)){
          Vue.set(ref.fieldOptions,item.name,{})                                // storing some easy to find options
          Vue.set(ref.fieldOptions[item.name],"valueColumn",item.valueColumn||"")
          Vue.set(ref.fieldOptions[item.name],"placeholderColumn",item.placeholderColumn||"")
          Vue.set(ref.fieldOptions[item.name],"type",item.type)
          Vue.set(ref.form,item.name,item.default)
        }else if(["checkbox"].includes(item.type)){
          Vue.set(ref.form,item.name,item.default||false)
        }else{
          Vue.set(ref.form,item.name,item.default||"")
        }
        Vue.set(ref.visibility,item.name,true)
      });
      if(this.currentForm.showHelp && this.currentForm.showHelp===true){
        this.showHelp=true
      }
      this.$v.form.$reset();
      this.findVariableDependentOf()
      this.startDynamicFieldsLoop();
    }
  }
</script>
<style scoped>
pre{
  white-space: pre-wrap;       /* Since CSS 2.1 */
  white-space: -moz-pre-wrap;  /* Mozilla, since 1999 */
  white-space: -pre-wrap;      /* Opera 4-6 */
  white-space: -o-pre-wrap;    /* Opera 7 */
  word-wrap: break-word;       /* Internet Explorer 5.5+ */
}
.cursor-progress{
  cursor:progress;
}
.select, .select select{
  width:100%;
}
.fade-enter-active, .fade-leave-active {
  transition: opacity .5s;
}
.fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
  opacity: 0;
}
.bounce-enter-active {
  animation: bounce-in .5s;
}
.bounce-leave-active {
  animation: bounce-in .5s reverse;
}
@keyframes bounce-in {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.5);
  }
  100% {
    transform: scale(1);
  }
}
.slide-enter-active {
   -moz-transition-duration: 0.3s;
   -webkit-transition-duration: 0.3s;
   -o-transition-duration: 0.3s;
   transition-duration: 0.3s;
   -moz-transition-timing-function: ease-in;
   -webkit-transition-timing-function: ease-in;
   -o-transition-timing-function: ease-in;
   transition-timing-function: ease-in;
}

.slide-leave-active {
   -moz-transition-duration: 0.3s;
   -webkit-transition-duration: 0.3s;
   -o-transition-duration: 0.3s;
   transition-duration: 0.3s;
   -moz-transition-timing-function: cubic-bezier(0, 1, 0.5, 1);
   -webkit-transition-timing-function: cubic-bezier(0, 1, 0.5, 1);
   -o-transition-timing-function: cubic-bezier(0, 1, 0.5, 1);
   transition-timing-function: cubic-bezier(0, 1, 0.5, 1);
}

.slide-enter-to, .slide-leave {
   max-height: 100px;
   overflow: hidden;
}

.slide-enter, .slide-leave-to {
   overflow: hidden;
   max-height: 0;
}
pre::v-deep .ansi1 { font-weight: bold; }
pre::v-deep .ansi3 { font-weight: italic; }
pre::v-deep .ansi4 { text-decoration: underline; }
pre::v-deep .ansi9 { text-decoration: line-through; }
pre::v-deep .ansi30 { color: #161b1f; }
pre::v-deep .ansi31 { color: #d9534f; }
pre::v-deep .ansi32 { color: #5cb85c; }
pre::v-deep .ansi33 { color: #f0ad4e; }
pre::v-deep .ansi34 { color: #337ab7; }
pre::v-deep .ansi35 { color: #e1539e; }
pre::v-deep .ansi36 { color: #2dbaba; }
pre::v-deep .ansi37 { color: #ffffff; }
pre::v-deep .ansi40 { background-color: #161b1f; }
pre::v-deep .ansi41 { background-color: #d9534f; }
pre::v-deep .ansi42 { background-color: #5cb85c; }
pre::v-deep .ansi43 { background-color: #f0ad4e; }
pre::v-deep .ansi44 { background-color: #337ab7; }
pre::v-deep .ansi45 { background-color: #e1539e; }
pre::v-deep .ansi46 { background-color: #2dbaba; }
pre::v-deep .ansi47 { background-color: #ffffff; }
</style>
