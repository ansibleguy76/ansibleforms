<template>
    <div>
        <BulmaModal v-if="showEdit" title="Edit" action="Save" @click="saveItem()" @close="showEdit=false" @cancel="showEdit=false">
          <div v-for="field,index in tableFields" :key="field.name" class="field">

              <!-- add field label -->
              <label class="label">{{ field.label }} <span v-if="field.required" class="has-text-danger">*</span></label>
              <!-- type = checkbox -->
              <label v-if="field.type=='checkbox'" class="checkbox">
                <input v-if="field.type=='checkbox'" :autofocus="index==0" :checked="editedItem[field.name]" v-model="editedItem[field.name]" :name="field.name" type="checkbox">
                {{ field.placeholder }}
              </label>
              <p :class="{'has-icons-left':!!field.icon}" class="control">
                <input v-if="field.type=='text'" :autofocus="index==0" :class="{'is-danger':$v.editedItem[field.name].$invalid}" class="input" type="text" v-model="$v.editedItem[field.name].$model" :placeholder="field.placeholder" :name="field.name">
                <input v-if="field.type=='number'" :autofocus="index==0" class="input" type="number" v-model="editedItem[field.name]" :placeholder="field.placeholder" :name="field.name">

                <!-- add left icon, but not for query, because that's a component with icon builtin -->
                <span v-if="!!field.icon && field.type!='query'" class="icon is-small is-left">
                  <font-awesome-icon :icon="field.icon" />
                </span>
              </p>

              <p class="has-text-danger" v-if="!$v.editedItem[field.name].required">This field is required</p>
              <p class="has-text-danger" v-if="'minLength' in $v.editedItem[field.name] && !$v.editedItem[field.name].minLength">Must be at least {{$v.editedItem[field.name].$params.minLength.min}} characters long</p>
              <p class="has-text-danger" v-if="'maxLength' in $v.editedItem[field.name] && !$v.editedItem[field.name].maxLength">Can not be more than {{$v.editedItem[field.name].$params.maxLength.max}} characters long</p>
              <p class="has-text-danger" v-if="'minValue' in $v.editedItem[field.name] && !$v.editedItem[field.name].minValue">Value cannot be lower than {{$v.editedItem[field.name].$params.minValue.min}}</p>
              <p class="has-text-danger" v-if="'maxValue' in $v.editedItem[field.name] && !$v.editedItem[field.name].maxValue">Value cannot be higher than {{$v.editedItem[field.name].$params.maxValue.max}}</p>
              <p class="has-text-danger" v-if="'regex' in $v.editedItem[field.name] && !$v.editedItem[field.name].regex">{{$v.editedItem[field.name].$params.regex.description}}</p>

          </div>
        </BulmaModal>
        <table :class="tableClass">
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
                <tr v-for="row,index in showedRows" :key="'table-row-' + index" @click="rowClick(row)">
                    <td>
                      <span class="icon is-clickable has-text-success" @click="addItem(index)"><font-awesome-icon icon="plus-square" /></span>
                      <span class="icon is-clickable has-text-warning" @click="editItem(index)"><font-awesome-icon icon="pencil-alt" /></span>
                      <span class="icon is-clickable has-text-danger" @click="removeItem(index)"><font-awesome-icon icon="times" /></span>
                    </td>
                    <slot name="table-body" :row="row">
                        <template v-for="field in tableFields">
                          <td v-if="field.type!='checkbox'" :key="'table-cell-' + field.name + '-' + index" :class="field.bodyClass"> {{ row[field.name] }} </td>
                          <td v-else :key="'table-cell-' + field.name + '-' + index" :class="field.bodyClass"><font-awesome-icon :icon="(row[field.name])?['far','check-square']:['far','square']" /></td>
                        </template>
                    </slot>
                </tr>
                <tr>
                    <td><span class="icon is-clickable has-text-success" @click="addItem(-1)"><font-awesome-icon icon="plus-square" /></span></td>
                    <slot name="table-body">
                        <template v-for="field in tableFields">
                          <td class="has-background-grey-lighter" :key="'table-cell-' + field.name"></td>
                        </template>
                    </slot>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script>
    import Vue from 'vue'
    import BulmaModal from './BulmaModal.vue'
    import Vuelidate from 'vuelidate'
    import { required,minValue,maxValue,minLength,maxLength, helpers,requiredIf } from 'vuelidate/lib/validators'

    Vue.use(Vuelidate)
    export default{
        name:'BulmaEditTable',
        components:{BulmaModal},
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
            }
        },
        data: function(){
            return {
                sort: {
                    field: '',
                    desc: true
                },
                rows: [],
                filters: [],
                showedRows: [],
                editedItem:{},
                showEdit:false,
                action:"",
                editIndex:-1
            }
        },
        validations() {     // a dynamic assignment of vuelidate validations, based on the form json

          var obj = {
            editedItem:{}
          }
          this.tableFields.forEach((ff, i) => {
            var attrs = {}
            attrs.required=requiredIf(function(){
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
            obj.editedItem[ff.name]=attrs
          });
          // Vue.set(this,"validationsLoaded",true)
          return obj
        },
        watch: {
            rows: function(){
                this.showedRows = JSON.parse(JSON.stringify(this.rows));
            }
        },
        mounted: function () {
            this.showedRows = JSON.parse(JSON.stringify(this.rows));
        },
        computed: {
            filterRow: function () {
                return this.tableFields.findIndex( (e) => e.filterable ) >= 0;
            }
        },
        methods:{

            addItem: function(index){
              var ref=this
              this.editedItem={};
              this.tableFields.forEach((item, i) => {
                Vue.set(ref.editedItem,item.name,item.default)
              });
              this.action="add";
              this.editIndex=index;
              this.showEdit=true;
            },
            editItem: function(index){
              var ref=this
              this.editedItem=this.rows[index];
              this.action="edit";
              this.editIndex=index;
              this.showEdit=true;
            },
            removeItem: function(index){
              this.rows.splice(index,1)
              this.$emit('input', this.rows)
            },
            saveItem:function(){
              if(!this.$v.editedItem.$invalid){
                if(this.action=="add"){
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
