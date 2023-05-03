<template>
  <section class="section has-background-light">
    <!-- warnings pane -->
    <BulmaPageloader v-if="!formIsReady">{{ loadMessage }}</BulmaPageloader>
    <BulmaQuickView class="quickview" v-if="(warnings || Object.keys(queryerrors).length>0) && showWarnings" title="Form warnings" footer="" @close="showWarnings=false">
        <p v-for="w,i in warnings" :key="'warning'+i" class="mb-3" v-html="w"></p>
        <p v-for="q,i in Object.keys(queryerrors)" :key="'queryerror'+i" class="mb-3 has-text-danger">
          '{{ q }}' has query errors<br>{{queryerrors[q]}}
        </p>
    </BulmaQuickView>

    <div class="container">
      <div class="columns" v-if="formIsReady">
        <!-- form column -->
        <div ref="container" class="column is-clipped-horizontal">
          <!-- form title -->
          <h1 class="title">{{ currentForm.name }} <span v-if="currentForm.help" class="tag is-light is-clickable" @click="showHelp=!showHelp"><span class="icon has-text-info"><font-awesome-icon icon="question-circle" /></span><span v-if="showHelp">Hide help</span><span v-else>Show help</span></span></h1>
          <!-- help pane -->
          <article v-if="currentForm.help && showHelp" class="message is-light">
            <div class="message-body content"><VueShowdown :markdown="currentForm.help" flavor="github" :options="{ghCodeBlocks:true}" /></div>
          </article>
          <!-- top form buttons -->
          <!-- show extra vars -->
          <button @click="generateJsonOutput();showExtraVars=true" class="button is-white is-small mr-3" v-show="!hideForm">
            <span class="has-text-info icon">
              <font-awesome-icon icon="eye" />
            </span>
            <span>Show Extravars</span>
          </button>
          <!-- debug button - show hidden expressions -->
          <span  v-show="!hideForm" v-if="isAdmin" title="Show hidden fields" class="icon is-clickable is-pulled-right" :class="{'has-text-success':!showHidden,'has-text-danger':showHidden}" @click="showHidden=!showHidden">
              <font-awesome-icon :icon="(showHidden?'search-minus':'search-plus')" />
          </span>
          <span  v-show="!hideForm" title="Copy form link with values" class="icon is-clickable is-pulled-right has-text-link" @click="getFormUrl()">
              <font-awesome-icon icon="link" />
          </span>
          <span class="icon is-pulled-right">
            <font-awesome-icon :icon="loopicon.icon" size="lg" :class="loopicon.color" :spin="loopicon.spin" /> 
          </span>
          <!-- reload button -->
          <button @click="reloadForm" class="button is-white is-small mr-3">
            <span class="has-text-info icon">
              <font-awesome-icon icon="redo" />
            </span>
            <span>Reload This Form</span>
          </button>
          <!-- warnings button -->
          <transition name="pop" appear>
            <button v-if="warnings.length>0 || Object.keys(queryerrors).length>0" @click="showWarnings=!showWarnings" class="button is-small is-light is-warning mr-3">
              <span class="icon">
                <font-awesome-icon icon="exclamation-triangle" />
              </span>
              <span class="mr-1">{{(showWarnings)?'Hide':'This form has'}} Warnings </span>
            </button>
          </transition>
        
          <!-- groups -->
          <div :key="group" v-for="group in fieldgroups" class="mt-4" v-show="!hideForm">
            <div :class="getGroupClass(group)">
              <!-- group title -->
              <h3 class="title is-3" v-if="checkGroupDependencies(group)">{{group}}</h3>
              <div :key="line" v-for="line in fieldlines" class="columns">
                <!-- field loop -->
                <template  v-for="field in filterfieldsByGroupAndLine(group,line)">
                  <transition :key="field.name" name="slide">
                    <div class="column py-0" v-if="visibility[field.name]" :class="field.width">
                    
                      <div class="field mt-3">
                        <!-- field label -->
                        <label class="label" :class="{'has-text-dark':!field.hide,'has-text-grey':field.hide}">{{ field.label || field.name }} <span v-if="field.required" class="has-text-danger">*</span>
                          <!-- field buttons -->
                          <span class="is-pulled-right">
                            <!-- refresh auto -->
                            <span
                              @click="setFieldStatus(field.name,undefined)"
                              v-if="fieldOptions[field.name] && fieldOptions[field.name].refresh"
                              class="tag is-link icon-text is-clickable">
                              <span>{{fieldOptions[field.name].refresh}}</span>
                              <span class="icon"><font-awesome-icon icon="arrow-rotate-right" spin /></span>
                            </span>
                            <!-- refresh manual -->
                            <span v-if="(field.expression!=undefined || field.query!=undefined) && field.refresh &! fieldOptions[field.name].refresh"
                              class="icon is-clickable has-text-link"
                              @click="setFieldStatus(field.name,undefined)"
                            >
                              <font-awesome-icon icon="arrow-rotate-right" />
                            </span>
                            <!-- enable field debug -->
                            <span
                              class="icon is-clickable"
                              :class="{'has-text-success':!fieldOptions[field.name].debug,'has-text-danger':fieldOptions[field.name].debug}"
                              @click="setExpressionFieldDebug(field.name,!fieldOptions[field.name].debug)"
                              v-if="field.expression && isAdmin"
                            >
                              <font-awesome-icon :icon="(fieldOptions[field.name].debug?'search-minus':'search-plus')" />
                            </span>
                            <!-- expression edit buttons -->
                            <span
                              class="icon is-clickable has-text-warning"
                              @click="setExpressionFieldEditable(field.name,true)"
                              v-if="field.editable && field.type=='expression' && !fieldOptions[field.name].editable && !fieldOptions[field.name].viewable"
                            >
                              <font-awesome-icon icon="pencil-alt" />
                            </span>
                            <span
                              class="icon is-clickable has-text-danger"
                              @click="setExpressionFieldEditable(field.name,false)"
                              v-if="field.editable && field.type=='expression' && fieldOptions[field.name].editable && !fieldOptions[field.name].viewable"
                            >
                              <font-awesome-icon icon="times" />
                            </span>
                            <!-- raw content buttons -->
                            <!-- show -->
                            <span
                              class="icon is-clickable has-text-success"
                              @click="setExpressionFieldViewable(field.name,true)"
                              v-if="field.expression && !fieldOptions[field.name].viewable && !fieldOptions[field.name].editable"
                            >
                              <font-awesome-icon icon="eye" />
                            </span>
                            <!-- copy -->
                            <span
                              class="icon is-clickable has-text-info"
                              @click="clip((field.type=='expression')?$v.form[field.name].$model:queryresults[field.name])"
                              v-if="field.expression && fieldOptions[field.name].viewable && !fieldOptions[field.name].editable"
                            >
                              <font-awesome-icon icon="copy" />
                            </span>
                            <!-- close -->
                            <span
                              class="icon is-clickable has-text-danger"
                              @click="setExpressionFieldViewable(field.name,false)"
                              v-if="field.expression && fieldOptions[field.name].viewable && !fieldOptions[field.name].editable"
                            >
                              <font-awesome-icon icon="times" />
                            </span>
                          </span>
                        </label>
                        <!-- debug expression view -->
                        <div class="mb-3"
                          @dblclick="clip(field.expression,true)"
                          v-if="field.expression && fieldOptions[field.name].debug">
                          <highlight-code
                            lang="javascript"
                            :code="field.expression"
                          />
                        </div>
                        <!-- evaluated debug expression view -->
                        <div class="mb-3"
                          @dblclick="clip(fieldOptions[field.name].expressionEval,true)"
                          v-if="field.expression && fieldOptions[field.name].debug && dynamicFieldStatus[field.name]!='fixed'">
                          <highlight-code
                            lang="javascript"
                            :code="fieldOptions[field.name].expressionEval"
                          />
                        </div>
                        <!-- START FIELD BUILD -->
                        <!-- type = checkbox -->
                        <div v-if="field.type=='checkbox'">
                          <BulmaCheckRadio checktype="checkbox" v-model="$v.form[field.name].$model" :name="field.name" :type="{'is-danger is-block':$v.form[field.name].$invalid}" :label="field.placeholder" @change="evaluateDynamicFields(field.name)" />
                        </div>
                        <!-- type = enum/query -->
                        <div v-if="field.type=='query' || field.type=='enum'">
                          <BulmaAdvancedSelect
                            :containerSize="containerSize"
                            v-show="!fieldOptions[field.name].viewable"
                            :defaultValue="defaults[field.name]"
                            :required="field.required||false"
                            :multiple="field.multiple||false"
                            :name="field.name"
                            :placeholder="field.placeholder||'Select...'"
                            :values="field.values||queryresults[field.name]||[]"
                            :hasError="$v.form[field.name].$invalid"
                            :isLoading="!field.values && !['fixed','variable'].includes(dynamicFieldStatus[field.name])"
                            v-model="$v.form[field.name].$model"
                            :icon="field.icon"
                            :columns="field.columns||[]"
                            :pctColumns="field.pctColumns||[]"
                            :filterColumns="field.filterColumns||[]"
                            :previewColumn="field.previewColumn||''"
                            :valueColumn="field.valueColumn||''"
                            @input="evaluateDynamicFields(field.name)"
                            :sticky="field.sticky||false"
                            :horizontal="field.horizontal||false"
                            >
                          </BulmaAdvancedSelect>
                          <!-- raw query data -->
                          <div
                            @dblclick="setExpressionFieldViewable(field.name,false)"
                            v-if="fieldOptions[field.name].viewable"
                            class="box limit-height is-limited mb-3">
                            <vue-json-pretty :data="queryresults[field.name]||[]"></vue-json-pretty>
                          </div>

                        </div>
                        <!-- type = radio -->
                        <div v-if="field.type=='radio'" >
                          <BulmaCheckRadio :val="radiovalue" checktype="radio" v-for="radiovalue in field.values" :key="field.name+'_'+radiovalue" v-model="$v.form[field.name].$model" :name="field.name" :type="{'is-danger is-block':$v.form[field.name].$invalid}" :label="radiovalue"  @change="evaluateDynamicFields(field.name)" />
                        </div>
                        <!-- type = table -->
                        <div v-if="field.type=='table'">
                          <BulmaEditTable
                            v-show="!fieldOptions[field.name].viewable"
                            :dynamicFieldStatus="dynamicFieldStatus"
                            :form="form"
                            :tableFields="field.tableFields"
                            :hasError="$v.form[field.name].$invalid"
                            :click="false"
                            tableClass="table is-striped is-bordered is-narrow"
                            :allowInsert="field.allowInsert && true"
                            :allowDelete="field.allowDelete && true"
                            :deleteMarker="field.deleteMarker || ''"
                            :insertMarker="field.insertMarker || ''"
                            :readonlyColumns="field.readonlyColumns || []"
                            :insertColumns="field.insertColumns || []"
                            :isLoading="!['fixed','variable'].includes(dynamicFieldStatus[field.name]) && (field.expression!=undefined || field.query!=undefined)"
                            :values="form[field.name]||[]"
                            @input="evaluateDynamicFields(field.name)"
                            @warning="addTableWarnings(field.name,...arguments)"
                            v-model="$v.form[field.name].$model" />
                          <!-- raw table data -->
                          <div
                            @dblclick="setExpressionFieldViewable(field.name,false)"
                            v-if="fieldOptions[field.name].viewable"
                            class="box limit-height is-limited mb-3">
                            <vue-json-pretty :data="$v.form[field.name].$model"></vue-json-pretty>
                          </div>
                        </div>
                        <date-picker v-if="field.type=='datetime'"
                            :type="field.dateType"
                            value-type="format"
                            v-model="$v.form[field.name].$model"
                            @change="evaluateDynamicFields(field.name)"
                        >
                              <template #input>
                                <div :class="{'has-icons-left':!!field.icon}" class="control">
                                  <input 
                                    @focus="inputFocus"
                                    :class="{'is-danger':$v.form[field.name].$invalid}"
                                    class="input"
                                    :name="field.name"
                                    v-model="$v.form[field.name].$model"
                                    @change="evaluateDynamicFields(field.name)"
                                    :required="field.required"
                                    type="text"
                                    :placeholder="field.placeholder">
                                    <span v-if="!!field.icon" class="icon is-small is-left">
                                      <font-awesome-icon :icon="field.icon" />
                                    </span>                                  
                                </div>                            
                              </template>
                        </date-picker>  
                        <!-- fields with icons -->
                        <div v-if="!['datetime','table','radio','enum','query','checkbox'].includes(field.type)" :class="{'has-icons-left':!!field.icon && !['query','enum','datetime'].includes(field.type)}" class="control">
                          <!-- type = expression -->
                          <div v-if="field.type=='expression'" :class="{'is-loading':(dynamicFieldStatus[field.name]==undefined || dynamicFieldStatus[field.name]=='running') &! fieldOptions[field.name].editable}" class="control">
                            <div v-if="!fieldOptions[field.name].viewable">
                              <input v-if="fieldOptions[field.name].editable" type="text"
                                @focus="inputFocus"
                                :class="{'is-danger':$v.form[field.name].$invalid,'has-text-info':!fieldOptions[field.name].editable}"
                                v-model="$v.form[field.name].$model"
                                class="input"
                                :name="field.name"
                                :required="field.required"
                                @change="evaluateDynamicFields(field.name)"
                                >
                              <p @dblclick="setExpressionFieldViewable(field.name,true)" v-if="!fieldOptions[field.name].editable && !field.isHtml" class="input has-text-info" :class="{'is-danger':$v.form[field.name].$invalid}" v-text="stringify($v.form[field.name].$model)"></p>
                              <p @dblclick="setExpressionFieldViewable(field.name,true)" v-if="!fieldOptions[field.name].editable && field.isHtml" class="input has-text-info" :class="{'is-danger':$v.form[field.name].$invalid}" v-html="stringify($v.form[field.name].$model)"></p>
                            </div>
                            <!-- expression raw data -->
                            <div
                              @dblclick="setExpressionFieldViewable(field.name,false)"
                              v-else
                              class="box limit-height is-limited mb-3">
                              <vue-json-pretty :data="$v.form[field.name].$model"></vue-json-pretty>
                            </div>
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
                          <!-- type = textarea-->
                          <textarea v-if="field.type=='textarea'"
                            @focus="inputFocus"
                            :class="{'is-danger':$v.form[field.name].$invalid}"
                            v-model="$v.form[field.name].$model"
                            class="textarea" :name="field.name"
                            v-bind="field.attrs"
                            :required="field.required"
                            :placeholder="field.placeholder"
                            @change="evaluateDynamicFields(field.name)">
                          </textarea>                          
                          <!-- type = number -->
                          <input v-if="field.type=='number'"
                            @focus="inputFocus"
                            :class="{'is-danger':$v.form[field.name].$invalid}"
                            v-model.number="$v.form[field.name].$model"
                            class="input"
                            :name="field.name"
                            v-bind="field.attrs"
                            :required="field.required"
                            type="number"
                            :placeholder="field.placeholder"
                            @change="evaluateDynamicFields(field.name)">
                    
                          <!-- add left icon, but not for query, because that's a component with icon builtin -->
                          <span v-if="!!field.icon && !(field.type=='expression' && fieldOptions[field.name].viewable)" class="icon is-small is-left">
                            <font-awesome-icon :icon="field.icon" />
                          </span>
                        </div>
                        <!-- add help and validation alerts -->
                        <p class="help" v-if="!!field.help">{{ field.help}}</p>
                        <p class="has-text-danger" v-if="$v.form[field.name].required==false">This field is required</p>
                        <p class="has-text-danger" v-if="'minLength' in $v.form[field.name] && !$v.form[field.name].minLength">Must be at least {{$v.form[field.name].$params.minLength.min}} characters long</p>
                        <p class="has-text-danger" v-if="'maxLength' in $v.form[field.name] && !$v.form[field.name].maxLength">Can not be more than {{$v.form[field.name].$params.maxLength.max}} characters long</p>
                        <p class="has-text-danger" v-if="'minValue' in $v.form[field.name] && !$v.form[field.name].minValue">Value cannot be lower than {{$v.form[field.name].$params.minValue.min}}</p>
                        <p class="has-text-danger" v-if="'maxValue' in $v.form[field.name] && !$v.form[field.name].maxValue">Value cannot be higher than {{$v.form[field.name].$params.maxValue.max}}</p>
                        <p class="has-text-danger" v-if="'regex' in $v.form[field.name] && !$v.form[field.name].regex">{{$v.form[field.name].$params.regex.description}}</p>
                        <p class="has-text-danger" v-if="'validIf' in $v.form[field.name] && !$v.form[field.name].validIf">{{$v.form[field.name].$params.validIf.description}}</p>
                        <p class="has-text-danger" v-if="'validIfNot' in $v.form[field.name] && !$v.form[field.name].validIfNot">{{$v.form[field.name].$params.validIfNot.description}}</p>
                        <p class="has-text-danger" v-if="'notIn' in $v.form[field.name] && !$v.form[field.name].notIn">{{$v.form[field.name].$params.notIn.description}}</p>
                        <p class="has-text-danger" v-if="'in' in $v.form[field.name] && !$v.form[field.name].in">{{$v.form[field.name].$params.in.description}}</p>
                        <p class="has-text-danger" v-if="'sameAs' in $v.form[field.name] && !$v.form[field.name].sameAs">Field must be identical to '{{$v.form[field.name].$params.sameAs.eq}}'</p>
                      </div>
                    </div>
                  </transition>
                </template>
              </div>
            </div>
          </div>
          <!-- job buttons -->
          <hr v-if="!!currentForm" />
          <!-- play button -->
          <button v-if="!!currentForm && !jobResult.message" class="button is-primary is-fullwidth" @click="jobResult.message='initializing'"><span class="icon"><font-awesome-icon icon="play" /></span><span>Run</span></button>
          <div class="columns">
            <!-- progress/close button -->
            <div class="column">
              <button v-if="!!jobResult.message" class="button is-fullwidth has-text-light" @click="resetResult()" :class="{ 'has-background-success' : jobResult.status=='success', 'has-background-warning' : jobResult.status=='warning', 'has-background-danger' : jobResult.status=='error','has-background-info cursor-progress' : jobResult.status=='info' }">
                <span class="icon" v-if="jobResult.status=='info'"><font-awesome-icon icon="spinner" spin /></span>
                <span class="icon" v-if="jobResult.status!='info'"><font-awesome-icon icon="times" /></span>
                <span>{{ jobResult.message }}</span>
              </button>
            </div>
            <!-- abort job button -->
            <div class="column" v-if="jobResult.status=='info' && !abortTriggered">
              <button  class="button is-fullwidth has-background-warning" @click="abortJob(jobId)">
                <span class="icon"><font-awesome-icon icon="times" /></span>
                <span>Abort Job</span>
              </button>
            </div>
          </div>
          <!-- output result -->
          <div v-if="jobResult.data && !!jobResult.data.output" class="box mt-3">
            <button @click="filterOutput=!filterOutput" v-if="jobId" class="button is-light is-small mb-3">
              <span class="icon has-text-info">
                <font-awesome-icon icon="eye-slash" />
              </span>
              <span v-text="(filterOutput)?'Remove filter':'Apply filter'"></span>
            </button>   
            <div class="columns">
              <div class="column">
                <h3 v-if="jobResult.data.job_type=='multistep' && subjob.data && subjob.data.output" class="subtitle">Main job (jobid {{jobResult.data.id}}) <span class="tag" :class="`is-${jobResult.status}`">{{ jobResult.data.status}}</span></h3>
                <div class="pre" v-html="filteredJobOutput"></div>
              </div>
              <div v-if="jobResult.data.job_type=='multistep' && subjob.data && subjob.data.output && !showExtraVars" class="column">
                <h3 class="subtitle">Current Step (jobid {{subjob.data.id}}) <span class="tag" :class="`is-${subjob.status}`">{{ subjob.data.status}}</span></h3>
                <div class="pre" v-html="filteredSubJobOutput"></div>
              </div>
            </div>
          </div>
          <!-- close output button -->
          <button v-if="jobResult.data && !!jobResult.data.output" class="button has-text-light" :class="{ 'has-background-success' : jobResult.status=='success', 'has-background-warning' : jobResult.status=='warning', 'has-background-danger' : jobResult.status=='error','has-background-info' : jobResult.status=='info'}" @click="resetResult()">
            <span class="icon"><font-awesome-icon icon="times" /></span>
            <span>Close output</span>
          </button>
        </div>
        <!-- extra vars column -->
        <div v-if="showExtraVars" class="column is-clipped-horizontal">
          <h1 class="title">Extravars</h1>
          <!-- close extravar view button -->
          <button @click="showExtraVars=false" class="button is-white is-small">
            <span class="has-text-info icon">
              <font-awesome-icon icon="times" />
            </span>
            <span>Close</span>
          </button>
          <!-- copy extravars button -->
          <button @click="clip(formdata)" class="ml-2 button is-white is-small">
            <span class=" has-text-info icon">
              <font-awesome-icon icon="copy" />
            </span>
            <span>Copy to clipboard</span>
          </button>
          <!-- extravars raw -->
          <div class="box mt-4 is-limited">
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
  import BulmaPageloader from './BulmaPageloader.vue'
  import BulmaCheckRadio from './BulmaCheckRadio.vue'
  import BulmaEditTable from './BulmaEditTable.vue'
  import DatePicker from 'vue2-datepicker';
  import 'vue2-datepicker/index.css';

  // load javascript highlight, for debug view
  import 'highlight.js/styles/monokai-sublime.css'
  import VueHighlightJS from 'vue-highlight.js';
  import javascript from 'highlight.js/lib/languages/javascript';
  import vue from 'vue-highlight.js/lib/languages/vue';
  import Helpers from './../lib/Helpers'
  import Copy from 'copy-to-clipboard'
  import 'vue-json-pretty/lib/styles.css';
  import VueShowdown from 'vue-showdown';
  import { required, minValue,maxValue,minLength,maxLength,helpers,requiredIf,sameAs } from 'vuelidate/lib/validators'

  Vue.use(Vuelidate)
  Vue.use(VueShowdown)
  Vue.use(VueHighlightJS, {
    // Register only languages that you want
      languages: {
        javascript
      }
    });

  export default{
    name:"Form",
    components:{VueJsonPretty,BulmaAdvancedSelect,BulmaEditTable,BulmaCheckRadio,BulmaQuickView,BulmaPageloader,DatePicker},
    props:{
      currentForm:{type:Object},
      constants:{type:Object},
      isAdmin:{type:Boolean}
    },
    data(){
      return  {
          filterOutput:true,
          hideForm:false,       // possible action to hide form onsubmit for example
          formdata:{},          // the eventual object sent to the api in the correct hierarchy
          interval:undefined,   // interval how fast fields need to be re-evaluated and refreshed
          showExtraVars: false, // flag to show/hide extravars
          externalData:{},           // object to hold external data
          jobResult:{       // holds the output of an execution
            status:"",
            message:"",
            data:{
              output:"",
              error:""
            }
          },
          watchdog:0,               // main loop counter 
          loopdelay:100,            // main loop delay
          subjob:{},                // output of last subjob
          dynamicFieldDependencies:{},      // which fields need to be re-evaluated if other fields change
          dynamicFieldDependentOf:{},       // which fields are dependend from others
          defaults:{},              // holds default info per field
          dynamicFieldStatus:{},    // holds the status of dynamics fields (running=currently being evaluated, variable=depends on others, fixed=only need 1-time lookup, default=has defaulted, undefined=trigger eval/query)
          queryresults:{},          // holds the results of dynamic dropdown boxes
          queryerrors:{},           // holds errors of dynamic dropdown boxes
          fieldOptions:{},          // holds a couple of fieldoptions for fast access (valueColumn,ignoreIncomplete, ...), only for expression,query and table
          warnings:[],              // holds form warnings.
          showWarnings:false,       // flag to show/hide warnings
          form:{},                  // the form data mapped to the form -> hold the real data
          visibility:{},            // holds which fields are visiable or not
          canSubmit:false,          // flag must be true to enable submit - allows to finish background queries - has a watchdog in case not possible
          validationsLoaded:false,  // ready flag if field validations are ready, we don't show the form otherwise
          pretasksFinished:false,   // ready flag for form pre tasks (git => git pull)
          loadMessage:"Loading form...",
          timeout:undefined,        // determines how long we should show the result of run
          showHelp:false,           // flag to show/hide form help
          showHidden:false,         // flag to show/hide hidden field / = debug mode
          jobId:undefined,          // holds the current jobid
          abortTriggered:false,     // flag abort is triggered,
          containerSize:{
            x:0,
            width:0
          }          // width of container
        }
    },
    validations() {     // a dynamic assignment of vuelidate validations, based on the form yaml
      var self=this
      var obj = {
        form:{}
      }
      this.currentForm.fields.forEach((ff, i) => {
        var attrs = {}
        var field
        var regexObj
        var description
        // required validation for simple fields
        if(ff.type!='checkbox' && ff.type!='expression' && ff.type!='query' && ff.type!='enum'){
          attrs.required=requiredIf(function(){
            return !!ff.required
          })
        }
        // required validation for expression field
        if(((ff.type=="expression")||(ff.type=="query")||(ff.type=="enum")) && ff.required){
          attrs.required=helpers.withParams(
              {description: "This field is required"},
              (value) => (value!=undefined && value!=null && value!='__auto__' && value!='__none__' && value!='__all__')
          )
        }
        // required validation for checkbox (MUST be true)
        if(ff.type=='checkbox' && ff.required){
          attrs.required=helpers.withParams(
              {description: "This field is required"},
              (value) => (value==true)
          )
        }
        if("minValue" in ff){ attrs.minValue=minValue(ff.minValue)}
        if("maxValue" in ff){ attrs.maxValue=maxValue(ff.maxValue)}
        if("minLength" in ff){ attrs.minLength=minLength(ff.minLength)}
        if("maxLength" in ff){ attrs.maxLength=maxLength(ff.maxLength)}
        // regex validation
        if("regex" in ff){
          regexObj = new RegExp(ff.regex.expression)
          description = ff.regex.description
          attrs.regex = helpers.withParams(
              {description: description,type:"regex"},
              (value) => !helpers.req(value) || regexObj.test(value)
          )
        }
        // validation based on value of another field
        if("validIf" in ff){
          description = ff.validIf.description
          attrs.validIf = helpers.withParams(
              {description: description,type:"validIf"},
              (value) => !helpers.req(value) || !!self.form[ff.validIf.field]
          )
        }
        // validation based on negated value of another field
        if("validIfNot" in ff){
          description = ff.validIfNot.description
          attrs.validIfNot = helpers.withParams(
              {description: description,type:"validIfNot"},
              (value) => !helpers.req(value) || !self.form[ff.validIfNot.field]
          )
        }
        // field must not be in array (other field)
        if("notIn" in ff){
          description = ff.notIn.description
          attrs.notIn = helpers.withParams(
              {description: description,type:"notIn"},
              (value) => !helpers.req(value) || (self.form[ff.notIn.field]!=undefined && Array.isArray(self.form[ff.notIn.field]) && !self.form[ff.notIn.field].includes(value))
          )
        }
        // field must be in array (other field)
        if("in" in ff){
          description = ff.in.description
          attrs.in = helpers.withParams(
              {description: description,type:"in"},
              (value) => !helpers.req(value) || (self.form[ff.in.field]!=undefined && Array.isArray(self.form[ff.in.field]) && self.form[ff.in.field].includes(value))
          )
        }
        // field must be identical as other field
        if("sameAs" in ff){ attrs.sameAs=sameAs(ff.sameAs)}
        obj.form[ff.name]=attrs
      });
      // flag validations are ready
      Vue.set(this,"validationsLoaded",true)

      return obj
    },
    computed: {
      // joboutput
      filteredJobOutput(){
        if(!this.filterOutput) return this.jobResult?.data?.output?.replace(/\r\n/g,"<br>")
        return this.jobResult?.data?.output?.replace(/<span class='low[^<]*<\/span>/g,"").replace(/\r\n/g,"<br>").replace(/(<br>\s*){3,}/ig,"<br><br>") // eslint-disable-line
      },
      filteredSubJobOutput(){
        if(!this.filterOutput) return this.subjob?.output?.replace(/\r\n/g,"<br>")
        return this.subjob?.output?.replace(/<span class='low[^<]*<\/span>/g,"").replace(/\r\n/g,"<br>").replace(/(<br>\s*){3,}/ig,"<br><br>") // eslint-disable-line
      },      
      // form loaded and validation ready
      formIsReady(){
        return this.validationsLoaded && this.currentForm && this.pretasksFinished
      },
      // computed list of the field-groups (to generate fieldform-sections)
      fieldgroups(){
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
      },
      fieldlines(){
        // make groupname array with empty at start
        var ref=this
        if(this.currentForm.fields){
          var linecount=0
          return this.currentForm.fields.reduce(function(pV,cV,cI){
            linecount++
            if("line" in cV){
              return [...pV, cV.line];
            }else{
              ref.currentForm.fields[cI].line=`__line__${linecount}`
              return [...pV, `__line__${linecount}`];
            }
          },[""]).filter((v, i, a) => a.indexOf(v) === i);
        }else{
          return []
        }
      },
      loopicon(){
        if(this.loopdelay==500){
          return {icon:['fa-regular','face-smile'],color:"has-text-success",spin:false}
        }else{
          return {icon:['fa-solid','spinner'],color:"has-text-warning",spin:true}
        }
       
      }    
    },
    methods:{
      // used for enum field, to know the width of the container
      calcContainerSize(){
        var rect=this.$refs["container"]?.getBoundingClientRect()
        if(rect){
          this.containerSize.x=rect.x
          this.containerSize.width=rect.width
        }
      },
      // create a url with current values in embedded /-> experimental !
      getFormUrl(){
        var base64values=btoa(JSON.stringify(this.form))
        var url=`${location.protocol}//${location.host}/#/form/?form=${encodeURIComponent(this.currentForm.name)}&base64values=${base64values}`

        this.clip(url,true)
      },
      // to execute form events
      doAction(a){
        var ref=this
        const action=Object.keys(a)[0]
        const value=a[action]
        var wait=0
        var form=""
        if(typeof value=="string"){
          var tmp=value.split(/,(.*)/s)
          wait=tmp[0]
          form=tmp[1]
        }else{
          wait=parseInt(value)
        }
        // this.$toast.info(`${action} => (${wait})${form}`)
        if(action=="clear"){
          setTimeout(()=>{ref.initForm()},wait*1000)
        }
        if(action=="home"){
          setTimeout(()=>{ref.$router.replace({name:"Home"}).catch(err => {});},wait*1000)
        }
        if(action=="load"){
          setTimeout(()=>{
            ref.reloadForm()
            ref.$router.replace({name:"Form",query:{form:form}}).catch(err => {});
          },wait*1000)
        }
        if(action=="reload"){
          setTimeout(()=>{ref.$router.go()},wait*1000)
        }
        if(action=="hide"){
          setTimeout(()=>{ref.hideForm=true},wait*1000)
        }
        if(action=="show"){
          setTimeout(()=>{ref.hideForm=false},wait*1000)
        }
      },
      // as the parent to rerender the form vue component
      reloadForm(){
        this.$emit('rerender')
      },
      // prevent default focus
      inputFocus(e){
        e.preventDefault();
      },
      // flags expression field as editable
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
      // flags expression raw output view
      setExpressionFieldViewable(fieldname,value){
        Vue.set(this.fieldOptions[fieldname],'viewable',value)   // flag editable
      },
      // flags expression debug view
      setExpressionFieldDebug(fieldname,value){
        Vue.set(this.fieldOptions[fieldname],'debug',value)   // flag editable
      },
      // forces any type to visible string
      // used to visualize expressions
      stringify(v){
        if(v){
          if(Array.isArray(v)){
            return "[ Array ]"
          }
          if(typeof v=="object"){
            return "{ Object }"
          }
          return v.toString()
        }else{
          return v
        }
      },
      // copy to clipboard
      clip(v,doNotStringify=false){
        try{
          if(doNotStringify){
            Copy(v)
          }else{
            Copy(JSON.stringify(v))
          }
          this.$toast.success("Copied to clipboard")
        }catch(e){
          this.$toast.error("Error copying to clipboard : \n" + e)
        }
      },
      // creates a list of fields per group
      filterfieldsByGroup(group){
        var ref=this
        return this.currentForm.fields.filter(function (el) {
          return (
            (("group" in el && el.group === group)
              || !("group" in el) && (group==""))
            && (el.hide!==true || ref.showHidden))
        });
      },
      // creates a list of fields per group & line
      filterfieldsByGroupAndLine(group,line){
        var ref=this
        return this.filterfieldsByGroup(group).filter(function (el) {
          return (
            (("line" in el && el.line === line)
              || !("line" in el) && (line==""))
            && (el.hide!==true || ref.showHidden))
        });
      },      
      // check if a field must be shown based on dependencies
      checkDependencies(field){
        var ref = this
        var dependencyFn=field.dependencyFn || "and"
        var isAnd = (dependencyFn=="and" || dependencyFn=="nand")
        var isOr = (dependencyFn=="or" || dependencyFn=="nor")
        // console.log("fn => " + dependencyFn)
        if("dependencies" in field){
          var result
          if(dependencyFn=="and" || dependencyFn=="nand"){
            result=true // and starts with true
          }else{
            result=false // or starts with false
          }
          for(let i=0;i<field.dependencies.length;i++){
            const item=field.dependencies[i]
            var value=undefined
            var column=""
            var inversed=item.name.startsWith("!")                         // detect ! => inversion
            var fieldname=inversed?item.name.slice(1):item.name
            var columnRegex = /(.+)\.(.+)/g;                               // detect a "." in the field
            var tmpArr=columnRegex.exec(fieldname)                             // found aaa.bbb
            if(tmpArr && tmpArr.length>0){
              fieldname = tmpArr[1]                                        // aaa
              column=tmpArr[2]                                             // bbb
            }else{
              if(fieldname in ref.fieldOptions){
                column=ref.fieldOptions[fieldname].valueColumn||""         // get placeholder column
              }
            }
            if(column){
              value=ref.getFieldValue(ref.form[fieldname],column,false)
            }else{
              value=ref.form[fieldname]
            }
            if(isAnd && ((!inversed && !item.values.includes(value)) || ((inversed && item.values.includes(value)))) ){
               result=false
               // console.log("and not valid")
               break
            }
            if(isOr && ((!inversed && item.values.includes(value)) || (inversed && !item.values.includes(value)))){
               result=true
               // console.log("or valid")
               break
            }
          }
          // console.log("sub => " + result)
          // invert if nand or nor
          if(dependencyFn=="nand" || dependencyFn=="nor"){
            result=!result
            // console.log("inverting")
          }
          // console.log("final => " + result)
          if(result){
            ref.setVisibility(field.name,true)
          }else{
            ref.setVisibility(field.name,false)
          }
        }
      },
      setVisibility(fieldname,status){
        if(this.visibility[fieldname]!=status){
          Vue.set(this.visibility,fieldname,status)
          this.resetField(fieldname)
        }
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
      // get group class
      getGroupClass(group){
        var result=[]
        if(this.checkGroupDependencies(group)){
          result.push('box')
          if(group && this.currentForm.fieldGroupClasses){
            var bg = this.currentForm.fieldGroupClasses[group]
            if(bg)
              result.push(bg)
          }
        }
        // if(result.length==1){
        //   result.push('has-background-light')
        // }
        return result
      },
      // reset value of field - only for expression/query
      resetField(fieldname){
        // reset to default value
        // reset this field status
        // console.log(`[${fieldname}] reset`)
        this.initiateDefaults(fieldname)
        this.setFieldStatus(fieldname,undefined)
        Vue.set(this.form,fieldname,this.defaults[fieldname])
      },
      // reset all fields
      resetFields(){
        this.currentForm.fields.forEach((item, i) => {
          this.resetField(item.name)
        });
      },
      // new in 4.0.5
      // instead of taking the default value, see if it needs to be evaluated
      // allowing dynamic defaults
      getDefaultValue(fieldname,value){
        if(value!=undefined){
          var _value = this.replacePlaceholderInString(value).value
          // console.log(`${fieldname} -> ${value} -> ${_value}`)
          if(this.fieldOptions[fieldname].evalDefault){
            var r=undefined
            try{
              r=eval(_value)
              return r
            }catch(e){
              console.log(`Error evaluating default value : ${e}`)
            }
          }else{
            return _value
          }       
        }else{
          return value
        }
 
      },
      // load default value in field => only for expressions
      setFieldToDefault(fieldname){
        // reset to default value
        // console.log(`defaulting ${fieldname}`)
        try{
          // if there is a default, set "default" status
          if(this.defaults[fieldname]!=undefined){
            this.setFieldStatus(fieldname,"default")
          }
          else{
            // if no default, set to undefined
            var prevState=this.dynamicFieldStatus[fieldname]

            if(prevState=="running"){
              // console.log(`defaulting ${fieldname}`)
              // if the field was running, don't re-eval, we just did that
              this.setFieldStatus(fieldname,undefined,false)
            }else{
              // if the field was something diff, re-eval
              // console.log(`defaulting ${fieldname}`)
              this.setFieldStatus(fieldname,undefined,true)
            }
          }
          // set default value
          Vue.set(this.form,fieldname,this.defaults[fieldname])
         
        }catch(e){
          // this error should not hit, unless we have a bug
          console.log("Error: " + e)
          throw e
        }
      },
      // set dynamic field status, only for expressions,query and table
      setFieldStatus(fieldname,status,reeval=true){
        // console.log(`[${fieldname}] ----> ${status}`)
        if(this.fieldOptions[fieldname]?.isDynamic){
          var prevState=this.dynamicFieldStatus[fieldname]
          Vue.set(this.dynamicFieldStatus,fieldname,status)
          if(reeval && (prevState!=status)){
            // re-evaluate if need
            this.evaluateDynamicFields(fieldname)
          }
        } 
      },
      // if 2 dependend fields (parent-child) both have defaults
      // this can potentially be an issue.
      // parent could fall back to default before the child is evaluated
      // we track this status and loop a continuous loop on the parent
      // if the parent cannot be resolved however, this becomes an infinite loop => we flag this as warning
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
      // new in 4.0.5, we now allow dynamic defaults
      // first time run, load all the default values
      initiateDefaults(fieldname=undefined){
        var ref=this
        this.currentForm.fields.filter(x => !fieldname || fieldname==x.name).forEach((item,i) => {
          if(item.name in ref.externalData){
            ref.defaults[item.name]=ref.externalData[item.name]
          }else{
            // console.log(`defaulting ${item.name} -> ${item.default}`)
            ref.defaults[item.name]=ref.getDefaultValue(item.name,item.default)
          }      
        })
      },
      // add warnings for bad table values
      // a table is expecting a data format
      // we flag a warning if the data provided is missing columns
      addTableWarnings(name,data){
        var c=(data.length>1)?"Columns":"Column"
        var i=(data.length>1)?"are":"is"
        this.warnings.push(`<span class="has-text-warning-dark">Table '${name}' has missing data</span><br><span>${c} '${data}' ${i} missing.</span>`)
      },
      addDynamicFieldDependency(fields,field,foundfield){
        var ref=this
        var columnRegex = /([^.]+)\..+/g;                                    // detect a "." in the field
        var tmpArr=columnRegex.exec(foundfield)                             // found aaa.bbb
        if(tmpArr && tmpArr.length>0){
          // console.log("found dot in " + foundfield + " in " + field)
          foundfield = tmpArr[1]                                            // aaa
          // console.log(tmpArr)
        }else{
          // console.log("found no in " + foundfield + " in " + field)
        }
        foundfield=foundfield.replace(/\[[0-9]*\]/,'') // xxx[y] => xxx
        if(fields.includes(foundfield)){                         // does field xxx exist in our form ?
          //console.log(foundfield + " is a real field")
          if(foundfield in ref.dynamicFieldDependencies){															 // did we declare it before ?
            if(ref.dynamicFieldDependencies[foundfield].indexOf(field) === -1) {  // allready in there ?
                ref.dynamicFieldDependencies[foundfield].push(field);												 // push it
                if(foundfield==field){
                  // we capture self references
                  ref.warnings.push(`<span class="has-text-warning-dark">'${foundfield}' has a self reference</span><br><span>This will cause a racing condition</span>`)
                  ref.$toast.error("You defined a self reference on field '"+foundfield+"'")
                }
            }
          }else{
            ref.dynamicFieldDependencies[foundfield]=[field]
            if(foundfield==field){
              // we capture self references
              ref.warnings.push(`<span class="has-text-warning-dark">'${foundfield}' has a self reference</span><br><span>This will cause a racing condition</span>`)
              ref.$toast.error("You defined a self reference on field '"+foundfield+"'")
            }
          }

        }else{
          // we capture bad references
          if(!Object.keys(ref.form).includes(foundfield))
            ref.warnings.push(`<span class="has-text-warning-dark">'${field}' has a reference to unknown field '${foundfield}'</span><br><span>Your form might not function as expected</span>`)
        }
      },
      getPlaceholderMatches(fields,field,s){
        var ref=this
        var matches=[]
        // console.log(typeof s)
        if(s && typeof s=="string"){
          var testRegex = /\$\(([^)]+)\)/g;
          matches = s.matchAll(testRegex)
        }
        for(var match of matches){
          // foundmatch = match[0];                                              // found $(xxx)
          var foundfield = match[1];                                              // found xxx
          ref.addDynamicFieldDependency(fields,field,foundfield)
        }        
      },
      // Find variable devDependencies
      // we analyse which fields are dependent on others
      // if they change, we then know which other fields to re-evaluate
      findVariableDependencies(){
        var ref=this
        var temp={}
        var finishedFlag=false
        var foundmatch,foundfield
        var fields=[]
        // create a list of the fields
        this.currentForm.fields.forEach((item,i) => {
          fields.push(item.name)
        })
        // whilst checking, we also check if fields are unique
        var dups = Helpers.findDuplicates(fields)
        dups.forEach((item,i)=>{
          ref.warnings.push(`<span class="has-text-warning-dark">'${item}' has duplicates</span><br><span>Each field must have a unique name</span>`)
          ref.$toast.error("You have duplicates for field '"+item+"'")
        })
        // do the analysis
        this.currentForm.fields.forEach((item,i) => {
          // while we are looping, we also check if there are issues
          if(item.dependencies){
            item.dependencies.forEach((dep)=>{
              if(!(fields.includes(dep.name) || ( dep.name.startsWith("!") && fields.includes(dep.name.slice(1))  ))){
                ref.warnings.push(`<span class="has-text-warning-dark">'${item.name}' has bad dependencies</span><br><span>${dep.name} is not a valid field name</span>`)
              }
            })
          }
          if(item.notIn && !fields.includes(item.notIn.field)){
            ref.warnings.push(`<span class="has-text-warning-dark">'${item.name}' has bad 'notIn' validation</span><br><span>${item.notIn.field} is not a valid field name</span>`)
          }
          if(item.in && !fields.includes(item.in.field)){
            ref.warnings.push(`<span class="has-text-warning-dark">'${item.name}' has bad 'in' validation</span><br><span>${item.in.field} is not a valid field name</span>`)
          }
          if(item.sameAs && !fields.includes(item.sameAs)){
            ref.warnings.push(`<span class="has-text-warning-dark">'${item.name}' has bad 'sameAs' validation</span><br><span>${item.sameAs} is not a valid field name</span>`)
          }

          // query type is now deprecated
          if(item.type=='query'){
            ref.warnings.push(`<span class="has-text-warning-dark">'${item.name}' has the deprecated query type</span><br><span>Use enum type instead.</span>`)            
          }

          this.getPlaceholderMatches(fields,item.name,item.expression ?? item.query)
          this.getPlaceholderMatches(fields,item.name,item.default)
 
        })
        // check self references
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
                        // we capture self references
                        ref.warnings.push(`<span class="has-text-warning-dark">'${key}' has a self reference</span><br><span>This will cause a racing condition</span>`)
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
      // search which fields are dependent of others
      findVariableDependentOf(){
        var ref=this
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
                // console.log("found dot in " + foundfield + " in " + item.name)
                foundfield = tmpArr[1]                                            // aaa
              }else{
                // console.log("found no dot in " + foundfield + " in " + item.name)
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
                // track the dependent default => = potentially bad
                if((ref.defaults[item.name]!=undefined) && ref.fieldOptions[foundfield] && (ref.fieldOptions[foundfield].type=="expression") && (ref.defaults[foundfield]!=undefined)){
                  ref.warnings.push(`<span class="has-text-warning-dark">'${item.name}' has a default, referencing field '${foundfield}' which also has a default</span><br><span>Try to avoid dependent fields with both a default</span>`)
                }
              }
            }
          }
        })
      },
      // replace $() placeholders
      replacePlaceholderInString(value,ignoreIncomplete=false){
        //---------------------------------------
        // replace placeholders if possible
        //---------------------------------------
        var ref = this
        var testRegex = /\$\(([^)]+)\)/g                                        // a regex to find field placeholders $(xxx)
        var retestRegex = /\$\(([^)]+)\)/g                                      // the same regex, to retest after, because a regex can only be used once
        var match = undefined
        var matches =undefined
        var foundmatch=false
        var column=""
        var foundfield=false
        var fieldvalue=""
        var keys = undefined
        var targetflag=undefined
        var hasPlaceholders = false;
        if(typeof value!=="string"){
          return {"hasPlaceholders":false,"value":value} 
        }
        // console.log("item = " + value)
        // console.log(typeof value)
        // console.log(testRegex)
        matches=[...value.matchAll(testRegex)] // force match array
        for(match of matches){
            // console.log("-> match : " + match[0] + "->" + match[1])
            foundmatch = match[0];                                              // found $(xxx)
            foundfield = match[1];                                              // found xxx
            var columnRegex = /([^.]+)\.(.+)/g;                                        // detect a "." in the field
            var tmpArr=columnRegex.exec(foundfield)                             // found aaa.bbb
            if(tmpArr && tmpArr.length>0){
              foundfield = tmpArr[1]                                            // aaa
              column=tmpArr[2]                                                  // bbb
            }else{
              if(foundfield in ref.fieldOptions){
                column=ref.fieldOptions[foundfield].placeholderColumn||""        // get placeholder column
              }
            }
            foundfield=foundfield.replace(/\[[0-9]*\]/,'') // make xxx[y] => xxx
            fieldvalue = ""
            targetflag = undefined
            // mark the field as a dependent field
            if(foundfield in ref.form){      // does field xxx exist in our form ?
              // if the field exists
              // and it's from an expression or table
              //   or it's deep link in a column (colum has .)
              // and the reference field is an object
              if(ref.fieldOptions[foundfield] && (["expression","table"].includes(ref.fieldOptions[foundfield].type)||column.includes(".")) && (typeof ref.form[foundfield]=="object")){
                // objects and array should be stringified
                fieldvalue=JSON.stringify(ref.form[foundfield])
                // console.log(Helpers.replacePlaceholders(match[1],ref.form))
                fieldvalue=JSON.stringify(Helpers.replacePlaceholders(match[1],ref.form)) // allow full object reference
                // drop wrapping quotes
                if(typeof fieldvalue=="string"){ // drop quotes if string
                  fieldvalue=fieldvalue.replace(/^\"+/, '').replace(/\"+$/, ''); // eslint-disable-line
                }else{
                  // console.log(typeof fieldvalue)
                }
              // in other cases, it's a classic field.column reference
              }else{
                // other fields, grab a valid value
                fieldvalue = ref.getFieldValue(ref.form[foundfield],column,true);// get value of aaa.bbb
              }
              // get dynamic field status
              if(foundfield in ref.dynamicFieldStatus){
                targetflag = ref.dynamicFieldStatus[foundfield];                  // and what is the currect status of xxx, in case it's also dyanmic ?
              }else{
                // if simple field
                targetflag = "fixed"
              }
            }

            // if the variable is viable and not being changed, replace it
            // console.log(foundfield + "("+fieldvalue+")" + " -> targetflag = " + targetflag)
            // console.log(foundfield + " -> targetflag = " + targetflag)
            if(((targetflag=="variable"||targetflag=="fixed"||targetflag=="default") && fieldvalue!==undefined && value!=undefined)||((ignoreIncomplete||false) && value!=undefined)){                // valid value ?
                if(fieldvalue==undefined){
                  fieldvalue="__undefined__"   // catch undefined values
                }
                fieldvalue=ref.stringifyValue(fieldvalue)
                // console.log("replacing placeholder")
                value=value.replace(foundmatch,fieldvalue);               // replace the placeholder with the value
                 // console.log("replaced")
                 // console.log(item.name + " -> " + value)
            }else{
                value=undefined      // cannot evaluate yet
            }
            hasPlaceholders=true;
        }
        if(retestRegex.test(value)){                     // still placeholders found ?
            value=undefined                           // cannot evaluate yet
        }
        if(value!=undefined){
           value=value.replace("'__undefined__'","undefined")  // replace undefined values
           value=value.replace("__undefined__","undefined")
        }
        return {"hasPlaceholders":hasPlaceholders,"value":value}          // return the result
      },
      replacePlaceholders(item){
        //---------------------------------------
        // replace placeholders if possible
        //---------------------------------------
        var newValue = item.expression || item.query   // make a copy of our item
        return this.replacePlaceholderInString(newValue,item.ignoreIncomplete)

      },
      // stringify value if needed
      stringifyValue(fieldvalue){
        if(typeof fieldvalue==='object' || Array.isArray(fieldvalue)){
          return JSON.stringify(fieldvalue) // if object, we need to stringify it
        }else{
          return fieldvalue
        }
      },
      // any case of unexpected errors (=bugs), stop loop
      stopLoop(error){
        clearInterval(this.interval)
        this.$toast.error("Expression interval stopped !\n"+error)
      },
      //----------------------------------------------------------------
      // starts the evaluation of dynamic fields (expression or query)
      //----------------------------------------------------------------
      startDynamicFieldsLoop() {
        // this.$toast("Start eval")
        function matchRuleShort(str, rule) {
          var escapeRegex = (str) => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1"); // eslint-disable-line
          return new RegExp("^" + rule.split("*").map(escapeRegex).join(".*") + "$").test(str); // eslint-disable-line
        }

        function compareProps(x1,x2,p){
          for(let i=0;i<p.length;i++){
            const x=p[i]

            if(!matchRuleShort(x1[x],x2[x])){
              return false
            }
          }
          return true
        }

        function comparePropsRegex(x1,x2,p){
          for(let i=0;i<p.length;i++){
            const x=p[i]

            if(!x1[x].match(x2[x])){
              return false
            }
          }
          return true
        }

        function dynamicSort(property) {
            var sortOrder = 1;
            if(property[0] === "-") {
                sortOrder = -1;
                property = property.substr(1);
            }
            return function (a,b) {
                /* next line works with strings and numbers,
                 * and you may want to customize it to your needs
                 */
                var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
                return result * sortOrder;
            }
        }

        function dynamicSortMultiple() {
            /*
             * save the arguments object as it will be overwritten
             * note that arguments object is an array-like object
             * consisting of the names of the properties to sort by
             */
            var props = arguments;
            return function (obj1, obj2) {
                var i = 0, result = 0, numberOfProperties = props.length;
                /* try getting a different result from 0 (equal)
                 * as long as we have extra properties to compare
                 */
                while(result === 0 && i < numberOfProperties) {
                    result = dynamicSort(props[i])(obj1, obj2);
                    i++;
                }
                return result;
            }
        }

        class fnArray extends Array {
            sortBy(...args) {
                return this.sort(dynamicSortMultiple(...args));
            }
            distinctBy(...args) {
                return this.filter((a, i) => this.findIndex((s) => compareProps(a,s,args)) === i)
            }
            filterBy(...args) {
              let props=Object.keys(args[0])
              return this.filter((x)=>{
                return compareProps(x,args[0],props)
              })
            }
            regexBy(...args) {
              let props=Object.keys(args[0])
              return this.filter((x)=>{
                return comparePropsRegex(x,args[0],props)
              })
            }
            selectAttr(...args) {
              let props=Object.keys(args[0])

              return this.map((x)=>{
                let o = {}
                for(let i=0;i<props.length;i++){
                  o[props[i]]=x[args[0][props[i]]]
                }
                return o
              })
            }
        }

        // console.log("invoking field expressions and queries")
        var ref=this;                                                           // a reference to 'this'
        ref.watchdog=0                                                          // a counter how many times we retry to find a value
        var refreshCounter=0;                                                   // a counter to refresh the json output
        var hasUnevaluatedFields=false;                                         // a flag to check whether a have unevaluated fields
        // does the eval every x milliseconds ; this.interval
        // this is sequential, however, with async lookup, this can overlap
        // however, since we flag fields as 'running' during async lookups
        // this should not cause issues.
        this.interval = setInterval(function() {
          //console.log("enter loop");
          // ref.$toast("... loop ...")
          hasUnevaluatedFields=false;                                           // reset flag
          // console.log("-------------------------------")
          ref.currentForm.fields.forEach(
            function(item,index){
              ref.checkDependencies(item)
              if(ref.visibility[item.name]){  // only if they are visible
                // if expression and not processed yet or needs to be reprocessed
                var flag = ref.dynamicFieldStatus[item.name];                     // current field status (running/fixed/variable/default)
                var placeholderCheck=undefined;                                   // result for a placeholder check
                if(item.expression && (flag==undefined || ref.hasDefaultDependencies(item.name))){                // if expression and not evaluated yet
                  // console.log("eval expression " + item.name)
                  // console.log(`[${item.name}][${flag}] : evaluating`)
                  if(item.required){
                    hasUnevaluatedFields=true                                       // set the un-eval flag if this is required
                  }
                  // set flag running
                  ref.setFieldStatus(item.name,"running",false)
                  placeholderCheck = ref.replacePlaceholders(item)     // check and replace placeholders
                  Vue.set(ref.fieldOptions[item.name],"expressionEval",placeholderCheck.value||"undefined")
                  // console.log(`[${item.name}] 1 : ${placeholderCheck.value}`)
                  if(placeholderCheck.value!=undefined){                       // expression is clean ?
                      // console.log(`[${item.name}] 2 : ${placeholderCheck.value}`)
                      // allow local run in browser
                      if(item.runLocal){
                        // console.log("Running local expression : " + placeholderCheck.value)

                        var result
                        try{
                          // check if direct object attempt
                          // console.log(placeholderCheck.value)
                          if(placeholderCheck.value.at(0)=="{" && placeholderCheck.value.at(-1)=="}"){
                            result=eval(`Object.assign(${placeholderCheck.value})`)
                          }else{
                            result=eval(placeholderCheck.value)
                          }
                          
                          if(item.type=="expression") Vue.set(ref.form, item.name, result);
                          if((item.type=="query")||(item.type=="enum")) Vue.set(ref.queryresults, item.name, [].concat(result));
                          // table is special.  if external data is passed.  we take that instead of results.
                          if(item.type=="table" && !ref.defaults(item.name)){
                            Vue.set(ref.form, item.name, [].concat(result));
                          }
                          if(item.type=="table" && ref.defaults(item.name)){
                            Vue.set(ref.form, item.name, [].concat(ref.defaults[item.name]));
                          }
                          if(placeholderCheck.hasPlaceholders){                 // if placeholders were found we set this a variable dynamic field.
                            // set flag as viable variable query
                            // console.log("Expression found with variables")
                            ref.setFieldStatus(item.name,"variable")
                            //
                          }else{
                            // set flag as viable fixed query
                            ref.setFieldStatus(item.name,"fixed") // if this dynamic field was a 1 time evaluation, set as fixed
                          }
                          Vue.delete(ref.queryerrors, item.name);
                        }catch(err){
                          // console.log("Local eval failed : " + err)
                          Vue.set(ref.queryerrors, item.name,err);
                          try{
                            ref.setFieldToDefault(item.name)
                          }catch(err){
                            ref.stopLoop("Defaulting " + item.name)
                          }
                        }

                      }else{
                        axios.post("/api/v1/expression?noLog="+(!!item.noLog),{expression:placeholderCheck.value},TokenStorage.getAuthentication())
                          .then((result)=>{
                            var restresult = result.data
                            if(restresult.status=="error"){
                              // console.log(restresult.data.error)
                              ref.resetField(item.name)
                            }
                            if(restresult.data.error){
                              Vue.set(ref.queryerrors, item.name, restresult.data.error)
                            }else{
                              Vue.delete(ref.queryerrors, item.name)
                            }
                            if(restresult.status=="success"){
                              // console.log("expression for "+item.name+" triggered : result found -> "+ JSON.stringify(restresult.data.output));
                              if(item.type=="expression") Vue.set(ref.form, item.name, restresult.data.output);
                              if((item.type=="query")||(item.type=="enum")){
                                if(restresult.data.output==undefined){
                                  Vue.set(ref.queryresults, item.name, [])
                                }else{
                                  Vue.set(ref.queryresults, item.name, [].concat(restresult.data.output??[]))
                                }
                              }
                              // table is special, use external data is passed !
                              if(item.type=="table" && !ref.defaults[item.name]) Vue.set(ref.form, item.name, [].concat(restresult.data.output??[]));
                              if(item.type=="table" && ref.defaults[item.name]) Vue.set(ref.form, item.name, [].concat(ref.defaults[item.name]??[]));

                              // expression returned undefined, so lets set to default if we have one
                              if(restresult.data.output==undefined && (ref.defaults[item.name]!=undefined)){
                                if(item.type=="expression"){
                                  ref.setFieldToDefault(item.name)
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
                                  ref.setFieldToDefault(item.name)
                                }catch(err){
                                  ref.stopLoop("Defaulting " + item.name)
                                }
                          })
                      }



                  }else{
                    // console.log(item.name + " is not evaluated yet");
                    ref.setFieldToDefault(item.name)
                  }
                } else if(item.query && flag==undefined){
                   // console.log("eval query : " + item.name)
                  // set flag running
                  if(item.required){
                    hasUnevaluatedFields=true
                  }
                  ref.setFieldStatus(item.name,"running",false)
                  placeholderCheck = ref.replacePlaceholders(item)     // check and replace placeholders
                  if(placeholderCheck.value!=undefined){                       // expression is clean ?
                    axios.post("/api/v1/query?noLog="+(!!item.noLog),{query:placeholderCheck.value,config:item.dbConfig},TokenStorage.getAuthentication())
                      .then((result)=>{
                        var restresult = result.data
                        if(restresult.data.error){
                          Vue.set(ref.queryerrors, item.name, restresult.data.error)
                        }else{
                          Vue.delete(ref.queryerrors, item.name)
                        }
                        if(restresult.status=="error"){
                           //console.log(restresult.data.error)
                           if(item.type=="expression"){
                             ref.setFieldToDefault(item.name)
                           }else{
                             ref.resetField(item.name)
                           }
                        }
                        if(restresult.status=="success"){
                           //console.log("query "+item.name+" triggered : items found -> "+ restresult.data.output.length);
                          if((item.type=="query")||(item.type=="enum")){
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
                            if(item.type=="expression"){
                              ref.setFieldToDefault(item.name)
                            }else{
                              ref.resetField(item.name)
                            }
                          }catch(err){
                            ref.$toast("Cannot reset field status " + item.name)
                          }

                      })


                  }else{
                    //console.log(item.name + " is not evaluated yet");
                    try{
                      if(item.type=="expression"){
                        ref.setFieldToDefault(item.name)
                      }else{
                        ref.resetField(item.name)
                      }
                    }catch(err){
                      ref.$toast("Cannot reset field status " + item.name)
                    }
                  }
                }
              }else{  // not visible field
                if(item.type=="expression"){
                  ref.setFieldToDefault(item.name)
                }else if(item.type=="query" || item.type=="enum" || item.type=="table"){
                  // console.log("resetting " + item.name)
                  ref.resetField(item.name)
                }
              }

              // see if it is time to refresh
              if(item.refresh && typeof item.refresh=="string"){
                var match=item.refresh.match(/([0-9]+)s/g)
                if(match){
                  var secs=parseInt(match[0])
                  if(refreshCounter%(10*secs)==0){
                    ref.setFieldStatus(item.name,undefined)
                  }
                }
              }

            } // end loop function
          ) // end field loop
          if(hasUnevaluatedFields){
            ref.canSubmit=false;
            ref.watchdog++                       // keeps track of how many loop it takes to evaluate all fields
          }

          if(!hasUnevaluatedFields){
            ref.canSubmit=true;
            if(ref.watchdog>0){
              //ref.$toast.info("All fields are found")
            }
            ref.watchdog=0
          }
          if(ref.jobResult.message=="initializing"){ // has a request been made to execute ?
            // ref.$toast.info("Requesting execution")
            if(ref.validateForm()){  // form is valid ?
              ref.jobResult.message="stabilizing"
              // ref.$toast.info("Waiting for form to stabilize")
              ref.watchdog=0
            }else{
              ref.jobResult.message="" // reset status, form not valid
            }
          }
          if(ref.jobResult.message=="stabilizing"){ // are we waiting to execute ?
            if(ref.canSubmit){
              ref.jobResult.message="triggering execution"
              ref.executeForm()
            }else{
              // continue to stabilize
              if(ref.watchdog>15){  // is it taking too long ?
                ref.jobResult.message=""   // stop and reset
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
          if(ref.watchdog>30 || ref.watchdog==0){
            ref.loopdelay=500
          }else{
            ref.loopdelay=4
          }
        },ref.loopdelay); // end interval
      },
      // reset form status
      resetResult(){
        this.jobResult={
          status:"",
          message:"",
          data:{
            output:"",
            error:""
          }
        };
      },
      // trigger this when a field has changed and we need to see if it has an impact.
      evaluateDynamicFields(fieldname) {
          // console.log(`${fieldname} changed`)
          var ref=this;
          // console.log(`[${fieldname}] eval trigger`)
          // if this field is dependency
          if(fieldname in ref.dynamicFieldDependencies){  // are any fields dependent from this field ?
            ref.canSubmit=false; // after each dependency reset, we block submitting, untill all fields are resolved
            // set all variable ones to dirty
            ref.dynamicFieldDependencies[fieldname].forEach((item,i) => { // loop all dynamic fields and reset them
                // set all variable fields blank and re-evaluate
                if(!ref.fieldOptions[item].editable){
                  // all dependent fields we reset, so they can be re-evaluated
                  ref.resetField(item)
                }
            })
          }
          this.calcContainerSize();
      },
      // trigger a job abort
      abortJob(id){
        var ref=this
        this.$toast.warning("Aborting job " + id);
        axios.post("/api/v1/job/" + id + "/abort",{},TokenStorage.getAuthentication())
          .then((result)=>{
            ref.abortTriggered=true
          })
      },
      // get job output
      getJob(id,final){
        var ref = this;
        // console.log("=============================")
        // console.log("getting awx job")
        axios.get("/api/v1/job/" + id,TokenStorage.getAuthentication())
          .then((result)=>{
              // if we have decent data
              // console.log("job result - " + JSON.stringify(result))
              if(result.data?.data!==undefined){
                // import the data if output returned
                if(result.data?.data?.output!=""){
                  this.jobResult=result.data;
                }else{
                  // else, just import message & status
                  this.jobResult.status = result.data.status
                  this.jobResult.message = result.data.message
                }
                if(this.jobResult.data.job_type=="multistep"){
                  if(this.jobResult.data.subjobs){
                    var lastsubjob = this.jobResult.data.subjobs.split(",").map(x=>parseInt(x)).slice(-1)[0]
                    axios.get("/api/v1/job/" + lastsubjob,TokenStorage.getAuthentication())
                      .then((subjobresult)=>{
                        ref.subjob=subjobresult.data
                      }).catch((e)=>{
                        console.error("Error getting job : " + lastsubjob)
                      })
                  }
                }
                // if not final status, keep checking after 2s
                if(this.jobResult.status!="success" && this.jobResult.status!="error" && this.jobResult.status!="warning"){
                  // this.$toast.info(result.data.message)
                  setTimeout(function(){ ref.getJob(id) }, 2000);
                }else{
                  if(!final){
                    // 1 final last call for output
                    setTimeout(function(){ ref.getJob(id,true) }, 2000);
                  }else{
                    // final result
                    if(ref.currentForm.onFinish){
                      ref.currentForm.onFinish.forEach((action, i) => {
                        ref.doAction(action);
                      });
                    }
                    if(this.jobResult.status=="success" && ref.currentForm.onSuccess){
                      ref.currentForm.onSuccess.forEach((action, i) => {
                        ref.doAction(action);
                      });
                    }
                    if(this.jobResult.status=="error" && ref.currentForm.onFailure){
                      ref.currentForm.onFailure.forEach((action, i) => {
                        ref.doAction(action);
                      });
                    }
                    if(this.jobResult.status=="warning" && ref.currentForm.onAbort){
                      ref.currentForm.onAbort.forEach((action, i) => {
                        ref.doAction(action);
                      });
                    }
                    this.abortTriggered=false
                    if(this.jobResult.status=="success"){
                      this.$toast.success(result.data.message)
                    }else if(this.jobResult.status=="warning"){

                      this.$toast.warning(result.data.message)
                    }else{
                      this.$toast.error(result.data.message)
                    }
                    clearTimeout(this.timeout)
                    this.$emit('refreshApprovals')
                  }

                }
              }else{
                // no data ? check again after 2s
                // console.log("geen data")
                setTimeout(function(){ ref.getJob(id) }, 2000);
              }
          })
          .catch(function(err){
            console.log("error getting job " + err)
            ref.$toast.error("Failed to get job");
            if(err.response.status!=401){
              ref.jobResult.message="Error in axios call to get job\n\n" + err
              ref.jobResult.status="error";
            }
          })
      },
      // get the value of a field
      // can be many things and more complex than you think
      // if a record is selected in a query for example
      // the value can be the valueColumn, ....
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
        if(field=='__auto__'||field=='__none__'||field=='__all__'){
          field=undefined
        }
        return field
      },
      // generate the form json output
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
      // validate form before submit
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
      // execute the form
      executeForm(){
        // make sure, no delayed stuff is started.
        //
        var ref=this
        var postdata={}
        if(ref.validateForm){ // final validation

          this.generateJsonOutput()
          postdata.extravars = this.formdata
          postdata.formName = this.currentForm.name;
          postdata.credentials = {}
          postdata.awxCredentials = {}
          this.currentForm.fields
            .filter(f => f.asCredential==true)
            .forEach(f => {
              postdata.credentials[f.name]=this.formdata[f.name]
            })
          if(this.currentForm.steps)
            this.currentForm.steps
              .forEach(s => {
                if(s.awxCredentials)
                  s.awxCredentials
                    .forEach(f => {
                      if(this.formdata[f]){
                        postdata.awxCredentials[f]=this.formdata[f]
                      }
                    })
              })
          this.jobResult.message= "Connecting with job api ";
          this.jobResult.status="info";
          axios.post("/api/v1/job/",postdata,TokenStorage.getAuthentication())
            .then((result)=>{
                if(result){
                  this.jobResult=result.data;
                  if(result.data.data.error!=""){
                    ref.$toast.error(result.data.data.error)
                  }else{
                    // get the jobid
                    var jobid =  this.jobResult.data.output.id
                    ref.jobId=jobid
                    // don't show the whole json part
                    this.jobResult.data.output = ""
                    if(ref.currentForm.onSubmit){
                      ref.currentForm.onSubmit.forEach((action, i) => {
                        ref.doAction(action);
                      });
                    }
                    // wait for 2 seconds, and get the output of the job
                    setTimeout(function(){ ref.getJob(jobid) }, 2000);
                  }
                }else{
                  ref.$toast.error("Failed to invoke job launch")
                  ref.resetResult()
                }
            })
            .catch(function(err){
              ref.$toast.error("Failed to invoke job launch")
              if(err.response.status!=401){
                ref.resetResult()
              }
            })
         }
      },
      pullGit(repo){
        var postdata={}
        postdata.gitRepo = repo;
        return axios.post("/api/v1/git/pull",postdata,TokenStorage.getAuthentication())
      },
      initForm(){
        var ref=this
        this.pretasksFinished=false
        this.form={}
        this.formdata={}
        this.hideForm=false
        this.interval=undefined
        this.showExtraVars=false
        this.dynamicFieldDependencies={}
        this.dynamicFieldDependentOf={}
        this.defaults={}
        this.dynamicFieldStatus={}
        this.queryresults={}
        this.queryerrors={}
        this.fieldOptions={}
        this.warnings=[]
        this.showWarnings=false
        this.visibility={}
        this.canSubmit=false
        this.pretasksFinished=false
        this.timeout=undefined
        // extract external data
        if(ref.$route.query.base64values){
          try{
            var queryObject=JSON.parse(atob(ref.$route.query.base64values))
            // Vue.set(ref,"form",queryObject)
          }catch(e){
            ref.$toast.error("Couldn't parse your querystring")
          }
          for (const [key, value] of Object.entries(queryObject)) {
            // if(ref.currentForm.fields[key]){
              // console.log("Setting " + key)
              Vue.set(ref.externalData,key,value)
            // }
          }
        }
        // inject user
        this.form["__user__"]=TokenStorage.getPayload().user
        this.fieldOptions["__user__"]={
          type:"expression"
        }
        // initialize defaults
        this.currentForm.fields.forEach((item, i) => {
          // extra query parameters and store in externalData
          if(ref.$route.query[item.name]!=undefined){
            var queryValue=ref.$route.query[item.name]
            if(item.type=="number"){
              try{
                queryValue=parseInt(queryValue)
              }catch(e){
                queryValue=0
              }
            }
            if(item.type=="checkbox"){
              if(queryValue.toLowerCase()==="false"){
                queryValue=false
              }else{
                queryValue=!!queryValue
              }
            }
            Vue.set(ref.externalData,item.name,queryValue)
          }
          Vue.set(ref.fieldOptions,item.name,{})                                // storing some easy to find options
          Vue.set(ref.fieldOptions[item.name],"evalDefault",item.evalDefault??false)
          if(["expression","query","enum","table"].includes(item.type)){
            Vue.set(ref.fieldOptions[item.name],"isDynamic",!!(item.expression??item.query??false))
            Vue.set(ref.fieldOptions[item.name],"valueColumn",item.valueColumn||"")
            Vue.set(ref.fieldOptions[item.name],"placeholderColumn",item.placeholderColumn||"")
            Vue.set(ref.fieldOptions[item.name],"type",item.type)
            // if interval refresh store that for easy access
            if(item.refresh && typeof item.refresh=='string' && /[0-9]+s/.test(item.refresh)){
              Vue.set(ref.fieldOptions[item.name],"refresh",item.refresh)
            }
            Vue.set(ref.form,item.name,ref.externalData[item.name]??this.getDefaultValue(item.name,item.default))
            if(item.type=="table" && !ref.defaults[item.name]){
              Vue.set(ref.form,item.name,[])
            }
            if(item.type=="table" && ref.defaults[item.name]){
              Vue.set(ref.form,item.name,ref.externalData[item.name])
            }
          }else if(["checkbox"].includes(item.type)){
            Vue.set(ref.form,item.name,ref.externalData[item.name]??this.getDefaultValue(item.name,item.default)??false)
          }else{
            Vue.set(ref.form,item.name,ref.externalData[item.name]??this.getDefaultValue(item.name,item.default)??"")
          }
          Vue.set(ref.visibility,item.name,true)
        });

        // initiate the constants
        if(ref.constants){
          Object.keys(ref.constants).forEach((item)=>{
            Vue.set(ref.form,item,ref.constants[item])
          })
        }
        // see if the help should be show initially
        if(this.currentForm.showHelp && this.currentForm.showHelp===true){
          this.showHelp=true
        }
        // reset the form
        this.$v.form.$reset();
        // set all defaults
        this.initiateDefaults()
        // find all variable dependencies (in both ways)
        this.findVariableDependencies()
        this.findVariableDependentOf()

        // set as ready
        // if our type is git, we need to first pull git
        if(!["git","multistep"].includes(this.currentForm.type)){
          this.pretasksFinished=true
          // start dynamic field loop (= infinite)
          this.startDynamicFieldsLoop()
        }else{
          var gitpulls=[]

          if(this.currentForm.type=="git"){
              gitpulls.push(this.pullGit(this.currentForm.repo))
          }else if(this.currentForm.type=="multistep"){
            this.currentForm.steps.forEach((step, i) => {
              if(step.type=="git")
                gitpulls.push(this.pullGit(step.repo))
            });
          }
          // wait for all git pulls
          Promise.all(gitpulls)
          .then(results=>{
            var status=true
            results.forEach((result, i) => {
              if(result){

                if(result.data.status=="error"){
                  ref.$toast.error(result.data.message)
                  status=false
                }

              }else{
                ref.$toast.error("Failed to pull from git")
                status=false
              }

            });
            if(status){
              if(gitpulls.length>0)
                ref.$toast.success("Git was pulled")
            }
            ref.pretasksFinished=true
            // start dynamic field loop (= infinite)
            ref.startDynamicFieldsLoop()
          })
          .catch(function(err){
            ref.$toast.error("Failed to pull from git " + err)
            ref.pretasksFinished=true
            // start dynamic field loop (= infinite)
            ref.startDynamicFieldsLoop()
          })
        }

      },
    },
      // start form app
    mounted() { // when the Vue app is booted up, this is run automatically.
      this.resetResult();
      this.initForm();
      this.calcContainerSize();
      window.addEventListener('resize', this.calcContainerSize);
    },
    unmounted(){
      window.removeEventListener('resize', this.calcContainerSize);
    },
    // before exit, we stop the interval, as it would not stop otherwise
    beforeDestroy(){
      clearInterval(this.interval)
    }
  }
</script>
<style scoped>
.quickview{
  z-index:91000;
}
pre{
  white-space: pre-wrap;       /* Since CSS 2.1 */
  white-space: -moz-pre-wrap;  /* Mozilla, since 1999 */
  white-space: -pre-wrap;      /* Opera 4-6 */
  white-space: -o-pre-wrap;    /* Opera 7 */
  word-wrap: break-word;       /* Internet Explorer 5.5+ */
}
.is-clipped-horizontal{
  overflow-x: clip;
  overflow-y: visible;
}
.is-limited {
  text-overflow: ellipsis;
  width:100%;
  overflow: hidden;
}
.mx-datepicker,.mx-input-wrapper{
  width:100%;
}
.is-nowrap{
  white-space:nowrap;
}
.limit-height{
  max-height:300px;
  overflow-y:scroll;
  overflow-x:clip;
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
.pop-enter-active,
.pop-leave-active {
  transform: scale(1.2);
  transition: all 0.2s ease-in-out;
}
.pop-enter,
.pop-leave-to {
  transform: scale(1);
}
.pre{
    white-space: pre-wrap;       /* Since CSS 2.1 */
    white-space: -moz-pre-wrap;  /* Mozilla, since 1999 */
    white-space: -pre-wrap;      /* Opera 4-6 */
    white-space: -o-pre-wrap;    /* Opera 7 */
    word-wrap: break-word;       /* Internet Explorer 5.5+ */
    font-family: consolas,'Courier New', Courier, monospace;
    font-size: .85rem;
    background-color: #f1f1f1;
    padding:1rem;
    color:#333;

  }

</style>
