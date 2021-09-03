<template>
  <section class="section has-background-light">
    <div class="container" v-if="formIsReady">
      <div class="columns">
        <div class="column">
          <h1 class="title">{{ currentForm.name }}</h1>
          <button @click="generateJsonOutput();showJson=true" class="button is-info is-small">
            <span class="icon">
              <i class="fas fa-brackets-curly"></i>
            </span>
            <span>Show json output</span>
          </button>
          <div :key="group" v-for="group in fieldgroups" class="mt-4">
            <div :class="{'box':checkGroupDependencies(group)}">
              <h3 class="title is-3" v-if="checkGroupDependencies(group)">{{group}}</h3>
              <div :key="field.name" v-for="field in filterfieldsByGroup(group)">
                <transition name="slide">
                  <div class="field" v-if="checkDependencies(field,true)">
                    <label v-if="!field.hide" class="label">{{ field.label }} <span v-if="field.required" class="has-text-danger">*</span></label>
                    <label v-if="field.type=='checkbox'" class="checkbox">
                      <input :checked="field.default" :class="{'is-danger':$v.form[field.name].$invalid}" v-model="$v.form[field.name].$model" :required="field.required" :name="field.name" type="checkbox">
                      {{ field.placeholder }}
                    </label>
                    <div v-if="field.type=='radio'" >
                      <label class="radio" :key="radiovalue" v-for="radiovalue in field.values">
                        <input type="radio" :class="{'is-danger':$v.form[field.name].$invalid}" v-model="$v.form[field.name].$model" :checked="field.default===radiovalue" :value="radiovalue" :name="field.name">
                        {{ radiovalue }}
                      </label>
                    </div>
                    <div :class="{'has-icons-left':!!field.icon}" class="control has-icons-right">
                      <input v-if="field.type=='expression'" :type="(field.hide) ? 'hidden' : 'text'" :class="{'is-danger':$v.form[field.name].$invalid,'is-loading':dynamicFieldStatus[field.name]==undefined || dynamicFieldStatus[field.name]=='running'}" v-model="$v.form[field.name].$model" class="input" :name="field.name" readonly :required="field.required" :value="field.default" :placeholder="field.placeholder">
                      <input v-if="field.type=='text'" :class="{'is-danger':$v.form[field.name].$invalid}" v-model="$v.form[field.name].$model" class="input" :name="field.name" v-bind="field.attrs" :required="field.required" type="text" :placeholder="field.placeholder" @change="evaluateDynamicFields">
                      <input v-if="field.type=='password'" :class="{'is-danger':$v.form[field.name].$invalid}" v-model="$v.form[field.name].$model" class="input" :name="field.name" v-bind="field.attrs" :required="field.required" type="password" :placeholder="field.placeholder" @change="evaluateDynamicFields">
                      <input v-if="field.type=='number'" :class="{'is-danger':$v.form[field.name].$invalid}" v-model="$v.form[field.name].$model" class="input" :name="field.name" v-bind="field.attrs" :required="field.required" type="number" :placeholder="field.placeholder" @change="evaluateDynamicFields">
                      <div v-if="field.type=='enum' && !field.multiple" class="select">
                        <select :name="field.name" :class="{'is-danger':$v.form[field.name].$invalid}" v-model="$v.form[field.name].$model" @change="evaluateDynamicFields">
                          <option v-if="!field.required" value=""></option>
                          <option v-for="option in field.values" :key="option" :selected="field.default==option" :value="option">{{ option }}</option>
                        </select>
                      </div>
                      <div v-if="field.type=='enum' && field.multiple==true" class="select is-multiple">
                        <select :name="field.name" :class="{'is-danger':$v.form[field.name].$invalid}" v-model="$v.form[field.name].$model" multiple :size="field.size">
                          <option v-if="!field.required" value=""></option>
                          <option v-for="option in field.values" :key="option" :selected="field.default.includes(option)" :value="option">{{ option }}</option>
                        </select>
                      </div>
                      <div v-if="field.type=='query'" class="select" :class="{'is-loading':dynamicFieldStatus[field.name]==undefined || dynamicFieldStatus[field.name]=='running'}">
                        <select  :class="{'is-danger':$v.form[field.name].$invalid}" v-model="$v.form[field.name].$model" :disabled="dynamicFieldStatus[field.name]==undefined || dynamicFieldStatus[field.name]=='running'" :name="field.name" @change="evaluateDynamicFields">
                          <option v-if="!field.required" value=""></option>
                          <option v-for="option in queryresults[field.name]" :key="option.name" :selected="field.default==option.name" :value="option.name">{{ option.name }}</option>
                        </select>
                      </div>
                      <span v-if="!!field.icon" class="icon is-small is-left">
                        <i class="fas" :class="field.icon"></i>
                      </span>
                      <p class="help" v-if="!!field.help">{{ field.help}}</p>
                      <p class="has-text-danger" v-if="!$v.form[field.name].required">This field is required</p>
                      <p class="has-text-danger" v-if="'minLength' in $v.form[field.name] && !$v.form[field.name].minLength">Must be at least {{$v.form[field.name].$params.minLength.min}} characters long</p>
                      <p class="has-text-danger" v-if="'maxLength' in $v.form[field.name] && !$v.form[field.name].maxLength">Can not be more than {{$v.form[field.name].$params.maxLength.max}} characters long</p>
                      <p class="has-text-danger" v-if="'minValue' in $v.form[field.name] && !$v.form[field.name].minValue">Value cannot be lower than {{$v.form[field.name].$params.minValue.min}}</p>
                      <p class="has-text-danger" v-if="'maxValue' in $v.form[field.name] && !$v.form[field.name].maxValue">Value cannot be higher than {{$v.form[field.name].$params.maxValue.max}}</p>
                      <p class="has-text-danger" v-if="'regex' in $v.form[field.name] && !$v.form[field.name].regex">{{$v.form[field.name].$params.regex.description}}</p>
                      <p class="has-text-danger" v-if="'sameAs' in $v.form[field.name] && !$v.form[field.name].sameAs">Field must be identical to '{{$v.form[field.name].$params.sameAs.eq}}'</p>
                    </div>
                  </div>
                </transition>
              </div>
            </div>
          </div>

          <hr v-if="!!currentForm" />
          <button v-if="!!currentForm && !ansibleResult.message" class="button is-primary is-fullwidth" @click="executeForm"><span class="icon"><i class="fas fa-play"></i></span><span>Run</span></button>
          <button v-if="!!ansibleResult.message" class="button is-fullwidth" @click="resetResult()" :class="{ 'has-background-success' : ansibleResult.status=='success', 'has-background-danger' : ansibleResult.status=='error','has-background-info cursor-progress' : ansibleResult.status=='info' }">
            <span class="icon" v-if="ansibleResult.status=='info'"><i class="fas fa-spinner fa-pulse"></i></span>
            <span class="icon" v-if="ansibleResult.status!='info'"><i class="fas fa-times"></i></span>
            <span>{{ ansibleResult.message }}</span>
          </button>
          <div v-if="!!ansibleResult.data.output" class="box mt-3">
            <pre v-if="currentForm.type=='ansible'" v-text="ansibleResult.data.output"></pre>
            <pre v-if="currentForm.type=='ansible' && ansibleResult.data.error" class="has-text-danger" v-text="ansibleResult.data.error"></pre>
            <pre v-if="currentForm.type=='awx'" v-html="ansibleResult.data.output"></pre>
          </div>
        </div>
        <div v-if="showJson" class="column">
          <h1 class="title">Json output, sent as extravars</h1>
          <button @click="showJson=false" class="button is-danger is-small">
            <span class="icon">
              <i class="fas fa-times"></i>
            </span>
            <span>Close</span>
          </button>
          <button @click="generateJsonOutput()" class="ml-2 button is-info is-small">
            <span class="icon">
              <i class="fas fa-sync"></i>
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
  import 'vue-json-pretty/lib/styles.css';
  import { required, minValue,maxValue,minLength,maxLength,helpers,requiredIf,sameAs } from 'vuelidate/lib/validators'

  Vue.use(Vuelidate)

  export default{
    name:"Form",
    components:{VueJsonPretty},
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
          fieldDependencies:{}, // holds internal dependencies of fields to know if the form needs re-eval if these are dirty
          dynamicFieldStatus:{},    // holds the status of dynamics fields (running=currently being evaluated, variable=depends on others, fixed=only need 1-time lookup)
          queryresults:{},      // holds the results of dynamic dropdown boxes
          form:{                // the form data mapped to the form
          },
          visibility:{

          },
          validationsLoaded:false,
          timeout:undefined     // determines how long we should show the result of run
        }
    },
    validations() {     // a dynamic assignment of vuelidate validations, based on the form json

      var obj = {
        form:{}
      }
      this.currentForm.fields.forEach((ff, i) => {
        var attrs = {}
        attrs.required=requiredIf(function(form){
          return !!ff.required
        })
        if("minValue" in ff){ attrs.minValue=minValue(ff.minValue)}
        if("maxValue" in ff){ attrs.maxValue=maxValue(ff.maxValue)}
        if("minLength" in ff){ attrs.minLength=minLength(ff.minLength)}
        if("maxLength" in ff){ attrs.maxLength=maxLength(ff.maxLength)}
        if("regex" in ff){
          var regexObj = new RegExp(ff.regex)
          var description = (ff.regexDescription!==undefined)?ff.regexDescription:"The value must match regular expression : " + ff.regex
          attrs.regex = helpers.withParams(
              {description: description,type:"regex"},
              (value) => !helpers.req(value) || regexObj.test(value)
          )
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
      filterfieldsByGroup(group){                   // creates a list of field per group
        return this.currentForm.fields.filter(function (el) {
          return ("group" in el &&
                 el.group === group) || (!("group" in el) && (group==""))
        });
      },
      checkDependencies(field,reset){
        var ref = this                              // checks if a field can be show, based on the value of other fields
        var result = true
        if("dependencies" in field){
          field.dependencies.forEach((item, i) => {
            if(!item.values.includes(ref.form[item.name])){
              if(reset){
                Vue.set(ref.form,field.name,field.default)
                Vue.set(ref.visibility,field.name,false)
                //console.log("Resetting field " + field.name)
              }
              result=false
            }else{
              if(reset){
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
        var result = false
        this.filterfieldsByGroup(group).forEach((item, i) => {
          result = ref.checkDependencies(item,false)
        });
        return result
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
        var foundfield=false
        var fieldvalue=""
        var targetflag=undefined
        var hasPlaceholders = false;
        var newValue = item                                                     // make a copy of our item
        matches=item.matchAll(testRegex);

        for(match of matches){
            foundmatch = match[0];                                              // found $(xxx)
            foundfield = match[1];                                              // found xxx
            fieldvalue = ""
            targetflag = undefined
            // mark the field as a dependent field
            if(foundfield in ref.form){                                         // does field xxx exist in our form ?
              ref.fieldDependencies[foundfield]=true;                           // mark xxx as dependency
              fieldvalue = ref.form[foundfield];                                // get value of xxx
              targetflag = ref.dynamicFieldStatus[foundfield];                  // and what is the currect status of xxx, in case it's also dyanmic ?
            }

            // if the variable is viable and not being changed, replace it
            if(targetflag!="running" && fieldvalue!==undefined){                // valid value ?
                newValue=newValue.replace(foundmatch,fieldvalue);               // replace the placeholder with the value
            }else{
                newValue=undefined                                              // cannot evaluate yet
                // we have a placeholder but it's value is not ready yet... will be for next loop
                // console.log("dependency ("+foundfield+") is not ready (" + targetflag + " : " + fieldvalue + ")")
            }
            hasPlaceholders=true;
        }
        if(retestRegex.test(newValue)){                                         // still placeholders found ?
            newValue=undefined                                                  // cannot evaluate yet
        }
        return {"hasPlaceholders":hasPlaceholders,"value":newValue}          // return the result
      },
      stopLoop(){
        console.log("Stopping loop")
        clearInterval(this.interval);
      },
      //----------------------------------------------------------------
      // starts the evaluation of dynamic fields (expression or query)
      //----------------------------------------------------------------
      startDynamicFieldsLoop() {
        // console.log("invoking field expressions and queries")
        var ref=this;                                                           // a reference to 'this'
        var watchdog=0;                                                         // a counter how many times we retry to find a value
        var hasUnevaluatedFields=false;                                         // a flag to check whether a have unevaluated fields
        clearInterval(this.interval);                                           // before we start the loop, we stop previous loops
        // does the eval every x seconds ; this.interval
        // this is is sequential, however, with async lookup, this can overlap
        // however, since we flag fields as 'running' during async lookups
        // this should not cause issues.
        this.interval = setInterval(function() {
          //console.log("enter loop");
          watchdog++;                                                           // increase watchdog
          hasUnevaluatedFields=false;                                           // reset flag
          // console.log("-------------------------------")
          ref.currentForm.fields.forEach(
            function(item,index){
              // if expression and not processed yet or needs to be reprocessed
              var flag = ref.dynamicFieldStatus[item.name];                     // current field status (running/fixed/variable)
              var placeholderCheck=undefined;                                   // result for a placeholder check
              if(item.type=="expression" && flag==undefined){                // if expression and not evaluated yet
                // console.log("eval expression " + item.name)
                // set flag running
                hasUnevaluatedFields=true                                       // set the un-eval flag
                Vue.set(ref.dynamicFieldStatus,item.name,"running");            // set as running
                placeholderCheck = ref.replacePlaceholders(item.expression)     // check and replace placeholders
                if(placeholderCheck.value!=undefined){                       // expression is clean ?
                    // console.log("Triggering expression : " + newValue + " - reg : " + reg + " - still vars? : " + stillvars)

                    axios.post("/api/v1/expression",{expression:placeholderCheck.value},TokenStorage.getAuthentication())
                      .then((result)=>{
                        var restresult = result.data
                        if(restresult.status=="error"){
                          // console.log(restresult.data.error)
                          Vue.set(ref.dynamicFieldStatus,item.name,undefined);
                        }
                        if(restresult.status=="success"){
                          // console.log("expression for "+item.name+" triggered : result found -> "+ restresult.data.output);
                          Vue.set(ref.form, item.name, restresult.data.output);
                          if(placeholderCheck.hasPlaceholders){                 // if placeholders were found we set this a variable dynamic field.
                            // set flag as viable variable query
                            // console.log("Expression found with variables")
                            Vue.set(ref.dynamicFieldStatus,item.name,"variable");
                          }else{
                            // set flag as viable fixed query
                            Vue.set(ref.dynamicFieldStatus,item.name,"fixed");  // if this dynamic field was a 1 time evaluation, set as fixed
                          }
                        }

                      }).catch(function (error) {
                            // console.log('Error ' + error.message)
                            try{
                              Vue.set(ref.dynamicFieldStatus,item.name,undefined);
                            }catch(err){
                              ref.stopLoop()
                            }
                      })


                }else{
                  // console.log(item.name + " is not evaluated yet");
                  Vue.set(ref.dynamicFieldStatus,item.name,undefined);
                }
              } else if(item.type=="query" && flag==undefined){
                // console.log("eval query : " + item.name)
                // set flag running
                hasUnevaluatedFields=true
                Vue.set(ref.dynamicFieldStatus,item.name,"running");
                placeholderCheck = ref.replacePlaceholders(item.query)     // check and replace placeholders
                if(placeholderCheck.value!=undefined){                       // expression is clean ?
                  // console.log(newquery);
                  // execute query

                  axios.post("/api/v1/query",{query:placeholderCheck.value,config:item.dbConfig},TokenStorage.getAuthentication())
                    .then((result)=>{
                      var restresult = result.data
                      if(restresult.status=="error"){
                        // console.log(restresult.data.error)
                        Vue.set(ref.dynamicFieldStatus,item.name,undefined);
                      }
                      if(restresult.status=="success"){
                        // console.log("query "+item.name+" triggered : items found -> "+ restresult.data.output.length);
                        Vue.set(ref.queryresults, item.name, restresult.data.output);
                        if(placeholderCheck.hasPlaceholders){
                          // set flag as viable variable query
                          Vue.set(ref.dynamicFieldStatus,item.name,"variable");
                        }else{
                          // set flag as viable fixed query
                          Vue.set(ref.dynamicFieldStatus,item.name,"fixed");
                        }
                      }

                    }).catch(function (err) {
                        // console.log('Error ' + err.message)
                        try{
                          Vue.set(ref.dynamicFieldStatus,item.name,undefined);
                        }catch(err){
                          ref.stopLoop()
                        }

                    })


                }else{
                  //console.log(item.name + " is not evaluated yet");
                  try{
                    Vue.set(ref.dynamicFieldStatus,item.name,undefined);
                  }catch(err){
                    ref.stopLoop()
                  }

                }
              }
            } // end loop function
          ) // end field loop
          if(watchdog>15){
            clearInterval(ref.interval);
            ref.$toast.warning("Stopping interval ; too many loops")
          }
          if(!hasUnevaluatedFields){
            clearInterval(ref.interval);
            ref.$toast.info("All fields are found")
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
      evaluateDynamicFields(event) {
          var ref=this;
          var thiselement = event.target.name;
          // if this field is dependency
          if(ref.fieldDependencies[thiselement]){
            // stop interval
            clearInterval(this.interval);
            // set all variable ones to dirty
            for (var key in this.dynamicFieldStatus){
              // only reset the ones with variables, the fixed ones can keep their value
              if(ref.dynamicFieldStatus[key]=="variable"){
                Vue.set(ref.dynamicFieldStatus,key,undefined);
              }
            }
            // start interval
            this.startDynamicFieldsLoop();
          }
      },
      getAwxJob(id){
        var ref = this;
        axios.get("/api/v1/awx/" + id,TokenStorage.getAuthentication())
          .then((result)=>{
              // if we have decent data
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
                if(this.ansibleResult.status!="success" && this.ansibleResult.status!="error"){
                  // this.$toast.info(result.data.message)
                  setTimeout(function(){ ref.getAwxJob(id) }, 2000);
                }else{
                  // if final, remove output after 15s
                  if(this.ansibleResult.status=="success"){
                    this.$toast.success(result.data.message)
                  }else{
                    this.$toast.error(result.data.message)
                  }
                  clearTimeout(this.timeout)
                  this.timeout = setTimeout(function(){ ref.resetResult() }, 15000);
                }
              }else{
                // no data ? check again after 2s
                setTimeout(function(){ ref.getAwxJob(id) }, 1000);
              }
          })
          .catch(function(err){
            ref.$toast.error("Failed to get awx job");
            if(err.response.status!=401){
              ref.ansibleResult.message="Error in axios call to get awx job\n\n" + err
              ref.ansibleResult.status="error";
            }
          })
      },
      generateJsonOutput(){
        var ref=this
        this.formdata={}
        this.currentForm.fields.forEach((item, i) => {
          if(this.visibility[item.name]){
            var fieldmodel = item.model
            if(fieldmodel=="" || fieldmodel===undefined){
              // if no model is given, we assign to the root
              this.formdata[item.name]=this.form[item.name]
            }else{
              // convert fieldmodel for actual object
              // svm.lif.name => svm["lif"].name = formvalue
              // using reduce, which is a recursive function
              fieldmodel.split(/\s*\.\s*/).reduce((master,obj, level,arr) => {
                // if last
                if (level === (arr.length - 1)){
                    // the last piece we assign the value to
                    master[obj]=ref.form[item.name]
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
      executeForm(){
        // make sure, no delayed stuff is started.
        clearInterval(this.interval)
        clearTimeout(this.timeout)
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
            return
        }else{
          this.generateJsonOutput()
          // local ansible
          if(this.currentForm.type=="ansible"){
            this.formdata.ansibleInventory = this.currentForm.inventory;
            this.formdata.ansiblePlaybook = this.currentForm.playbook;
            this.formdata.ansibleTags = this.currentForm.tags;
            this.ansibleResult.message= "Connecting with ansible ";
            this.ansibleResult.status="info";
            axios.post("/api/v1/ansible",this.formdata,TokenStorage.getAuthentication())
              .then((result)=>{
                  // show result for 15s
                  if(result){
                    this.ansibleResult=result.data;
                    if(result.data.data.error!=""){
                      ref.$toast.error(result.data.data.error)
                    }
                    clearTimeout(this.timeout)
                    this.timeout = setTimeout(function(){ ref.resetResult() }, 15000);
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
            this.formdata.awxInventory = this.currentForm.inventory;
            this.formdata.awxJobTemplate = this.currentForm.template;
            this.formdata.awxJobTags = this.currentForm.tags;
            this.ansibleResult.message= "Connecting with awx ";
            this.ansibleResult.status="info";

            axios.post("/api/v1/awx",this.formdata,TokenStorage.getAuthentication())
              .then((result)=>{
                  if(result){
                    this.ansibleResult=result.data;
                    if(result.data.data.error!=""){
                      ref.$toast.error(result.data.data.error)
                    }                    
                    // get the jobid
                    var jobid =  this.ansibleResult.data.output.id
                    // don't show the whole json part
                    this.ansibleResult.data.output = ""
                    // wait for 2 seconds, and get the output of the job
                    setTimeout(function(){ ref.getAwxJob(jobid) }, 2000);
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
      // initialize defaults
      this.currentForm.fields.forEach((item, i) => {
        Vue.set(ref.form,item.name,item.default)
        Vue.set(ref.visibility,item.name,true)
      });
      this.$v.form.$reset();
      this.startDynamicFieldsLoop();
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
