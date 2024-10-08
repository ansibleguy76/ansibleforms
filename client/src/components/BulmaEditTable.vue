<template>
    <div>
        <BulmaModal type="large" v-if="showEdit" :title="action" action="Save" @click="saveItem()" @close="showEdit=false" @cancel="showEdit=false">
          <div v-for="field,index in editFields" :key="field.name" class="field mt-3">

              <!-- add field label -->
              <label class="label has-text-dark">{{ field.label }} <span v-if="field.required" class="has-text-danger">*</span></label>
              <!-- type = checkbox -->
              <BulmaCheckRadio v-if="field.type=='checkbox'" checktype="checkbox" :disabled="action=='Edit' && readonlyColumns.includes(field.name)" :type="{'is-danger is-block':v$.editedItem[field.name].$invalid}" v-model="editedItem[field.name]" :name="field.name" :label="field.placeholder"/>
              <!-- <label v-if="field.type=='checkbox'" class="checkbox">
                <input v-if="field.type=='checkbox'" :disabled="readonlyColumns.includes(field.name)" :autofocus="index==0" :checked="editedItem[field.name]" v-model="editedItem[field.name]" :name="field.name" type="checkbox">
                {{ field.placeholder }}
              </label> -->
              <date-picker v-if="field.type=='datetime'"
                :type="field.dateType"
                value-type="format"
                v-model="v$.editedItem[field.name].$model"
              >
                  <template #input>
                    <div :class="{'has-icons-left':!!field.icon}" class="control">
                      <input 
                        :class="{'is-danger':v$.editedItem[field.name].$invalid}"
                        class="input"
                        :name="field.name"
                        v-model="v$.editedItem[field.name].$model"
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
               
              <BulmaAdvancedSelect
                v-if="field.type=='query' || field.type=='enum'"
                :defaultValue="stringify(v$.editedItem[field.name].$model,field)||field.default||''"
                :required="field.required||false"
                :multiple="false"
                :name="field.name"
                :placeholder="field.placeholder||'Select...'"
                :values="field.values||form[field.from]||[]"
                :hasError="v$.editedItem[field.name].$invalid"
                :isLoading="!field.values && !['fixed','variable'].includes(dynamicFieldStatus[field.from])"
                v-model="v$.editedItem[field.name].$model"
                :icon="field.icon"
                :columns="field.columns||[]"
                :pctColumns="field.pctColumns||[]"
                :filterColumns="field.filterColumns||[]"
                :previewColumn="field.previewColumn||''"
                :valueColumn="field.valueColumn||''"
                :sticky="field.sticky||false"
                :horizontal="field.horizontal||false"
                :disabled="action=='Edit' && readonlyColumns.includes(field.name)"
                >
              </BulmaAdvancedSelect>     
                             
              <div v-if="!['datetime','checkbox','query','enum'].includes(field.type)" :class="{'has-icons-left':!!field.icon}" class="control">
                <input v-if="field.type=='text' || field.type=='password'" :disabled="action=='Edit' && readonlyColumns.includes(field.name)" :autofocus="index==0" :class="{'is-danger':v$.editedItem[field.name].$invalid}" class="input" :type="field.type" v-model="v$.editedItem[field.name].$model" :placeholder="field.placeholder" :name="field.name">
                <input v-if="field.type=='number'" :disabled="action=='Edit' && readonlyColumns.includes(field.name)" :autofocus="index==0" class="input" type="number" v-model="editedItem[field.name]" :placeholder="field.placeholder" :name="field.name">

                <!-- add left icon, but not for query, because that's a component with icon builtin -->
                <span v-if="!!field.icon" class="icon is-small is-left">
                  <font-awesome-icon :icon="field.icon" />
                </span>
              </div>

              <p class="has-text-danger" v-if="field.required && v$.editedItem[field.name].required.$invalid && v$.editedItem[field.name].$errors.length>0">This field is required</p>
              <p class="has-text-danger" v-if="'minLength' in v$.editedItem[field.name] && v$.editedItem[field.name].minLength.$invalid">Must be at least {{v$.editedItem[field.name].minLength.$params.min}} characters long</p>
              <p class="has-text-danger" v-if="'maxLength' in v$.editedItem[field.name] && v$.editedItem[field.name].maxLength.$invalid">Can not be more than {{v$.editedItem[field.name].maxLength.$params.max}} characters long</p>
              <p class="has-text-danger" v-if="'minValue' in v$.editedItem[field.name] && v$.editedItem[field.name].minValue.$invalid">Value cannot be lower than {{v$.editedItem[field.name].minValue.$params.min}}</p>
              <p class="has-text-danger" v-if="'maxValue' in v$.editedItem[field.name] && v$.editedItem[field.name].maxValue.$invalid">Value cannot be higher than {{v$.editedItem[field.name].maxValue.$params.max}}</p>
              <p class="has-text-danger" v-if="'regex' in v$.editedItem[field.name] && v$.editedItem[field.name].regex.$invalid">{{v$.editedItem[field.name].regex.$params.description}}</p>
              <p class="has-text-danger" v-if="'notIn' in v$.editedItem[field.name] && v$.editedItem[field.name].notIn.$invalid">{{v$.editedItem[field.name].notIn.$params.description}}</p>
              <p class="has-text-danger" v-if="'in' in v$.editedItem[field.name] && v$.editedItem[field.name].in.$invalid">{{v$.editedItem[field.name].in.$params.description}}</p>

          </div>
        </BulmaModal>
        <div>
          <table :class="getTableClass">
            <thead>
                <tr>
                    <th>Actions</th>
                    <slot v-for="field in tableFields" :name="'table-header-' + field.name" :field="field">
                        <th :class="field.headClass" :key="'table-header-' + field.name" @click="toggleSort(field)" :width="field.width || ''">
                            <div class="field-controls">
                                <span>{{ field.label }}</span>
                                <span class="icon is-small" v-if="field.sortable">
                                    <i v-if="sort.field == field.name && sort.desc" class="fa fa-sort-desc"></i>
                                    <i v-else-if="sort.field == field.name && !sort.desc" class="fa fa-sort-asc"></i>
                                    <i class="fa fa-sort" v-else></i>
                                </span>
                            </div>
                        </th>
                    </slot>
                </tr>
            </thead>
            <tbody>
                <tr v-if="filterRow">
                  <td></td>
                  <template v-for="field in tableFields">
                    <td :key="'table-filter-' + field.name" v-if="field.filterable" :class="field.bodyClass">
                        <input type="text" class="input" :placeholder="'Filter ' + field.label" @input="filterData(field, $event.target.value.toUpperCase())">
                    </td>
                    <td :key="'table-filter-' + field.name" v-else :class="field.bodyClass"></td>
                  </template>
                </tr>
                <template v-if="!isLoading">
                  <tr class="is-unselectable" v-for="row,index in showedRows" :key="'table-row-' + index" @click="rowClick(row)">
                    <template v-if="deleteMarker && row[deleteMarker]">
                      <td>
                        <span class="icon has-text-grey-lighter"><font-awesome-icon icon="plus-square" /></span>
                        <span class="icon has-text-grey-lighter"><font-awesome-icon icon="pencil-alt" /></span>
                        <span class="icon is-clickable has-text-success" @click="undoRemoveItem(index)"><font-awesome-icon icon="undo" /></span>
                      </td>
                      <slot name="table-body" :row="row">
                          <template v-for="field in tableFields">
                            <td class="has-text-grey-lighter" v-if="field.type!='checkbox'" :key="'table-cell-' + field.name + '-' + index" :class="field.bodyClass"> {{ stringify(row[field.name],field) }} </td>
                            <td class="has-text-grey-lighter" v-else :key="'table-cell-' + field.name + '-' + index" :class="field.bodyClass"><font-awesome-icon :icon="(row[field.name])?['far','check-square']:['far','square']" /></td>
                          </template>
                      </slot>
                    </template>
                    <template v-else>
                      <td>
                        <span class="icon is-clickable has-text-success" v-if="allowInsert" @click="addItem(index)"><font-awesome-icon icon="plus-square" /></span>
                        <span class="icon is-clickable has-text-warning" @click="editItem(index)"><font-awesome-icon icon="pencil-alt" /></span>
                        <span class="icon is-clickable has-text-danger" v-if="allowDelete || row[insert_marker]" @click="removeItem(index)"><font-awesome-icon icon="times" /></span>
                        <span class="icon is-clickable has-text-grey-lighter" v-else><font-awesome-icon icon="times" /></span>
                      </td>
                      <slot name="table-body" :row="row">
                          <template v-for="field in tableFields">
                            <td v-if="field.type!='checkbox'" :key="'table-cell-' + field.name + '-' + index" :class="field.bodyClass"> {{ stringify(row[field.name],field) }} </td>
                            <td v-else :key="'table-cell-' + field.name + '-' + index" :class="field.bodyClass"><font-awesome-icon :icon="(row[field.name])?['far','check-square']:['far','square']" /></td>
                          </template>
                      </slot>
                    </template>
                  </tr>
                  <tr v-if="allowInsert">
                      <td>
                        <span class="icon is-clickable has-text-success" @click="addItem(-1)"><font-awesome-icon icon="plus-square" /></span>
                      </td>

                      <slot name="table-body">
                          <template v-for="field in tableFields">
                            <td class="has-background-grey-lighter" :key="'table-cell-' + field.name"></td>
                          </template>
                      </slot>
                  </tr>
                </template>
                <template v-else>
                  <tr>
                      <td class="has-text-grey-lighter"><font-awesome-icon icon="spinner" spin /></td>
                      <slot name="table-body">
                          <template v-for="field in tableFields">
                            <td class="has-background-grey-lighter" :key="'table-cell-' + field.name"></td>
                          </template>
                      </slot>
                  </tr>
                </template>
            </tbody>
        </table>
      </div>
    </div>
</template>

<script>
    import Vue from 'vue'
    import BulmaModal from './BulmaModal.vue'
    import BulmaAdvancedSelect from './BulmaAdvancedSelect'
    import Helpers from './../lib/Helpers.js'
    import BulmaCheckRadio from './BulmaCheckRadio'
    import DatePicker from 'vue2-datepicker';
    import 'vue2-datepicker/index.css';    
    import { useVuelidate } from '@vuelidate/core'
    import { minValue,maxValue,minLength,maxLength, helpers,requiredIf } from '@vuelidate/validators'

    export default{
        name:'BulmaEditTable',
        components:{BulmaModal,BulmaAdvancedSelect,BulmaCheckRadio,DatePicker},
        props:{
            tableFields: {
                type: Array,
                required: true
            },
            tableClass: {
                type: String,
                required: false,
                default: 'table'
            },
            click: {
                required: false,
                type: Boolean,
                default: false
            },
            form:{
              required: true,
              type: Object
            },
            dynamicFieldStatus:{
              required: true,
              type: Object
            },
            values: {},
            isLoading:{type: Boolean},
            allowInsert:{type: Boolean, default: true},
            allowDelete:{type: Boolean, default: true},
            deleteMarker:{type: String, default: ""},
            insertMarker:{type: String, default: ""},
            readonlyColumns:{type: Array},
            insertColumns:{type: Array},
            hasError:{type: Boolean}
        },
        setup(){
          return { v$: useVuelidate() }
        },
        data: function(){
            return {
                sort: {
                    field: '',
                    desc: true
                },
                rows: undefined,
                filters: [],
                showedRows: [],
                editedItem:{},
                showEdit:false,
                action:"",
                editIndex:-1,
                insert_marker:undefined
            }
        },
        validations() {     // a dynamic assignment of vuelidate validations, based on the form json
          var self=this
          var obj = {
            editedItem:{},
          }
          this.tableFields.forEach((ff, i) => {
            var attrs = {}
            var regexObj
            var description
            // required validation for simple fields
            if(ff.type!='checkbox' && ff.type!='enum'){
              attrs.required=requiredIf(function(){
                return !!ff.required
              })
            }
            // required validation for expression field
            if((ff.type=="enum") && ff.required){
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
            if("regex" in ff){
                regexObj = new RegExp(ff.regex.expression)
                description = ff.regex.description
                attrs.regex = helpers.withParams(
                    {description: description,type:"regex"},
                    (value) => !helpers.req(value) || regexObj.test(value)
                )
            }
            // field must not be in array (other field)
            if("notIn" in ff){
              description = ff.notIn.description
              attrs.notIn = helpers.withParams(
                  {description: description,type:"notIn"},
                  (value) => !helpers.req(value) || ((self.form[ff.notIn.field]!=undefined && Array.isArray(self.form[ff.notIn.field]) && !self.form[ff.notIn.field].includes(value)) || !ff.notIn.when?.includes(self.action.toLowerCase()))
              )
            }
            // field must be in array (other field)
            if("in" in ff){
              description = ff.in.description
              attrs.in = helpers.withParams(
                  {description: description,type:"in"},
                  (value) => !helpers.req(value) || ((self.form[ff.in.field]!=undefined && Array.isArray(self.form[ff.in.field]) && self.form[ff.in.field].includes(value)) || !ff.in.when?.includes(self.action.toLowerCase()))
              )
            }
            obj.editedItem[ff.name]=attrs
          });
          // Vue.set(this,"validationsLoaded",true)
          return obj
        },
        watch: {
            rows: function(){
                if(this.rows){
                  this.showedRows = JSON.parse(JSON.stringify(this.rows));
                }else{
                  this.showedRows = undefined
                }
            },
            values: function(){
              Vue.set(this,"rows",this.values)
              if(this.values && this.values.length>0){
                var fields = this.tableFields.map(x => x.name)
                var data = Object.keys(this.values[0])
                var missing = Helpers.findMissing(data,fields)
                if(missing.length>0){
                  this.$emit('warning',missing)
                }
              }
            }
        },
        mounted: function () {
          this.insert_marker=this.insertMarker
          if((this.deleteMarker || !this.allowDelete) && (!this.insert_marker || this.insert_marker.length==0)){
            this.insert_marker="__inserted__"
          }
          Vue.set(this,"rows",this.values)
          if(this.rows){
            this.showedRows = JSON.parse(JSON.stringify(this.rows));
          }else{
            this.showedRows = undefined
          }
          //this.input()
        },
        computed: {
            editFields: function(){
              return this.tableFields.filter(x => (this.action!="Add" || this.insertColumns.length==0 || this.insertColumns.includes(x.name)))
            },
            filterRow: function () {
                return this.tableFields.findIndex( (e) => e.filterable ) >= 0;
            },
            getTableClass(){
                var tmp=this.tableClass
                if(this.hasError){
                  tmp+=" hasError"
                }
                return tmp
            },
        },
        methods:{
            getValueLabel(field){
              if(field){
                if(field.valueColumn){
                  return field.valueColumn
                }
                if(field.columns && field.columns.length>0){
                  return field.columns[0]
                }
                if(Object.keys(this.editedItem[field.name]) && Object.keys(this.editedItem[field.name]).length>0){
                  return Object.keys(this.editedItem[field.name])[0]
                }
                return undefined
              }else{
                return undefined
              }
            },
            stringify(v,field=undefined){
              var valueLabel
              if(v){
                if(Array.isArray(v)){
                  return "[ Array ]"
                }
                if(typeof v=="object"){
                  valueLabel=this.getValueLabel(field)
                  if(valueLabel)
                    return v[valueLabel]
                  return "{ Object }"
                }
                return v.toString()
              }else{
                return v
              }
            },
            addItem: function(index){
              var ref=this
              this.editedItem={};
              this.tableFields.forEach((item, i) => {
                Vue.set(ref.editedItem,item.name,item.default)
              });
              this.action="Add";
              this.editIndex=index;
              this.showEdit=true;
            },
            editItem: function(index){
              var ref=this
              this.editedItem=this.rows[index];
              this.action="Edit";
              this.editIndex=index;
              this.showEdit=true;
            },
            removeItem: function(index){
              if(!this.deleteMarker){
                this.rows.splice(index,1)
              }else{
                var tmp = this.rows[index]
                if(tmp[this.insert_marker]){
                  this.rows.splice(index,1)
                }else{
                  Vue.set(tmp,this.deleteMarker,true)
                  Vue.set(this.rows,index,tmp)
                }
              }
              this.$emit('input', this.rows)
            },
            undoRemoveItem: function(index){
              var tmp = this.rows[index]
              delete tmp[this.deleteMarker]
              Vue.set(this.rows,index,tmp)
              this.$emit('input', this.rows)
            },
            saveItem:function(){
              var ref=this
              this.v$.editedItem.$touch()
              this.tableFields.forEach((item)=>{
                if(item.type=="query" || item.type=="enum"){
                  if(!item.outputObject){
                    console.log(item.name)
                    var valueLabel=this.getValueLabel(item)
                    console.log(valueLabel)
                    // if(valueLabel){
                    //   ref.editedItem[item.name]=ref.editedItem[item.name][valueLabel]
                    // }
                  }
                }
              })
              if(!this.v$.editedItem.$invalid){
                if(this.action=="Add"){
                  if(this.insert_marker){
                    Vue.set(this.editedItem,this.insert_marker,true)
                  }

                  if(this.editIndex<0){
                    this.rows.push(this.editedItem)
                  }else{
                    this.rows.splice(this.editIndex,0,this.editedItem)
                  }
                }else{
                  Vue.set(this.rows,this.editIndex,this.editedItem)
                }
                this.$emit('input', this.rows)
                this.showEdit=false
              }
            },
            rowClick: function (row) {
                if (this.click) this.$emit('row-click', row);
            },
            toggleSort: function(field){
                if(field.sortable){
                    if (field.name === this.sort.field) {
                        this.sort.desc = !this.sort.desc;
                    } else {
                        this.sort.field = field.name;
                        this.sort.desc = true;
                    }
                    this.sortData();
                }
            },
            sortData() {
                this.showedRows = this.showedRows.sort(
                    (a, b) => {
                        if(a[this.sort.field] > b[this.sort.field]){
                            return 1;
                        }
                        else if(a[this.sort.field] < b[this.sort.field]){
                            return -1;
                        }
                        return 0;
                    }
                );

                if (!this.sort.desc) {
                    this.showedRows.reverse();
                }
            },
            filterData(field, query) {
                if (field === undefined || this.rows === undefined || query === undefined) {
                    this.filters = [];
                    this.applyFilters();
                    return;
                }
                let index = this.filters.findIndex( (e) => e.name === field.name );
                if(query === ""){
                    if(index !== -1) this.filters.splice(index, 1);
                }
                else{
                    if(index >= 0 ){
                        this.filters[index].query = query;
                    }
                    else{
                        this.filters.push({field: field.name, query: query});
                    }
                }
                this.applyFilters();
            },
            applyFilters: function () {
                this.showedRows = this.rows;
                if(this.filters.length === 0) return;

                this.filteredRows = [];
                this.filters.forEach(
                    (f) =>{
                        this.filteredRows = [];
                        this.showedRows.forEach( (row) => {
                            let search = f.query.toUpperCase().trim();
                            if (row[f.name].toUpperCase().indexOf(search) !== -1) {
                                this.filteredRows.push(row);
                            }
                        });
                        this.showedRows = this.filteredRows;
                    }
                );
                this.sortData();
            }
        }
    }

</script>
<style scoped>
.select, .select select{
  width:100%;
}
.mx-datepicker,.mx-input-wrapper{
  width:100%;
}
.hasError{
  border:2px solid #ea4141!important;
}

</style>
