<template>
  <div>
    <p v-if="values.length==0">No data</p>
    <div v-if="values.length>0" class="table-container">
      <table class="table is-hoverable is-narrow">
        <thead v-if="labels.length>1">
          <tr :class="sizeClass">
            <th v-if="multiple" class="is-first">
              <font-awesome-icon v-if="checkAll" @click="multicheck()" :icon="['far','check-square']" />
              <font-awesome-icon v-else  @click="multicheck()" :icon="['far','square']" />
            </th>
            <th :key="l" v-for="l in labels">{{ l }}</th>
          </tr>
        </thead>
        <thead v-if="labels.length==1 && multiple">
          <tr :class="sizeClass">
            <th v-if="multiple" class="is-first">
              <font-awesome-icon v-if="checkAll" @click="multicheck()" :icon="['far','check-square']" />
              <font-awesome-icon v-else  @click="multicheck()" :icon="['far','square']" />
            </th>
            <th>Name</th>
          </tr>
        </thead>
        <tbody>
          <tr :class="{'has-background-info':selected[i],'has-text-white':selected[i],sizeClass:sizeClass}" :key="i" v-for="v,i in values" @click="select(i)">
            <td v-if="multiple" class="is-first">
              <font-awesome-icon v-if="selected[i]" :icon="['far','check-square']" />
              <font-awesome-icon v-else :icon="['far','square']" /> <span class="has-text-grey-lighter">{{i}}</span>
            </td>
            <template  v-for="l in labels">
            <td v-if="isPctColumn(l)" :key="l" v-html="getProgressHtml(v[l])"></td>
            <td v-else v-text="v[l]" :key="l"></td>
            </template>
            <td v-if="labels.length==0">{{ v }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
<script>
  import Vue from 'vue'
  export default{
    name:"BulmaAdvancedTable",
    props: {
      values: {
        type: Array,
        required: true,
      },
      multiple:{type:Boolean},
      required:{type:Boolean},
      name:{type:String,required:true},
      defaultValue:{type:[String,Array]},
      status:{type:String},
      sizeClass:{type:String},
      columns:{type:Array},
      previewColumn:{type:String},
      valueColumn:{type:String},
      pctColumns:{type:Array}
    },
    data () {
      return {
        selected:{},
        checkAll:false,
        labels:[],
        valueLabel:"",
        previewLabel:"",
        preview:"",
        focus:"",
        isLoading:true
      }
    },
    computed: {
    },
    watch: {                    // we watch the values prop for changes... each time we reset the data and grab the labels
      values: {
         handler(val){
           this.reset()
           this.getLabels()
         },
         deep: true
      }
    },
    methods:{
      // close(){
      //   this.isActive=false
      // },
      // toggle(){
      //   var ref=this
      //   this.isActive=!this.isActive
      //   if(this.isActive){
      //     this.$nextTick(()=>{ref.focus="content"})
      //   }
      // },
      isPctColumn(label){
        return this.pctColumns.includes(label)
      },
      getProgressHtml(value){
        var rounded
        if(!isNaN(value) ){
          rounded = Math.round(parseInt(value))
          if(rounded<0) rounded=0
          if(rounded>100) rounded=100
          return `<progress class="progress is-warning mt-1" value="${rounded}" max="100">${rounded}%</progress>`
        }else{
          return value
        }

      },
      select(i){
        if(this.multiple){
          this.selected[i]=!this.selected[i];
        }else{
          var temp = !this.selected[i]  // if single just clear and invert selection
          this.selected=[]
          this.selected[i]=temp;
          // this.isActive=false;
          // this.$refs.input.focus({ preventScroll: true })
        }
        this.recalc()
      },
      recalc(){
        var ref=this
        var result = this.values.filter((v,i) => this.selected[i]) // normal, return array of objects
        this.$emit('ischanged')
        var first = result.slice(0,3)
        if(result.length>0){
          if(result.length>3){
            this.preview = first.map(i => {return ((i)?i[ref.previewLabel]||i:"undefined")}).join(', ') + ", ... ("+result.length+" items selected)"
          }else{
            this.preview = first.map(i => {return ((i)?i[ref.previewLabel]||i:"undefined")}).join(', ')
          }
        }else{
          this.preview = ""
        }
        this.checkAll=(result.length==this.values.length)
        if(this.multiple){ // multiple and outputObject, return simple array
            this.$emit('input', {values:result,preview:this.preview})
        }else{
            if(result.length>0)
              this.$emit('input', {values:result[0],preview:this.preview})
            else{
              this.$emit('input', {values:undefined,preview:this.preview})
            }
        }
      },
      multicheck(){
        var ref=this
        if(!this.checkAll){
          this.checkAll=true
          ref.values.forEach((item,i) => {Vue.set(ref.selected,i,true)})
        }else{
          ref.reset()
        }
        this.recalc()
      },
      reset(){
        var ref=this
        this.values.forEach((item,i) => {
          Vue.set(ref.selected,i,false)
        })

      },
      getLabels(){
        var ref=this
        var previewLabels=[]
        var valueLabels=[]
        this.preview=""
        this.previewLabel=""
        this.valueLabel=""
        if(this.values.length>0){
          if(typeof this.values[0]!=="object"){
            this.labels = []
          }else{
            // get all labels
            this.labels = Object.keys(this.values[0])
            if(this.labels.length>0)
              ref.valueLabel=this.labels[0]
            // filter preview label
            previewLabels = this.labels.filter((item) => item==ref.previewColumn)
            valueLabels = this.labels.filter((item) => item==ref.valueColumn)
          }
          // reduct labels to the ones we want to show
          if(this.columns.length>0){ // limit labels to provided columnslist
            this.labels = this.columns.filter((item) => ref.labels.includes(item))
          }
          // if we found a preview label, use it
          if(previewLabels.length>0){ // if we have a specific value column
              this.previewLabel=previewLabels[0]  // set it
          }else if(this.labels.length>0){  // if we didn't find a preview label, use the first visible label
            this.previewLabel = this.labels[0]
          }
          // if we found a value label, use it
          if(valueLabels.length>0){ // if we have a specific value column
              this.valueLabel=valueLabels[0]  // set it
          }
          if(this.defaultValue=="__auto__" && this.values.length>0){
            this.select(0) // if __auto__ select the first
          }else if(this.defaultValue=="__all__"){ // if a regular default is set, we select it
            this.values.forEach((item,i) => {
              this.select(i)
            })
          }else if(this.defaultValue!="__none__" && this.defaultValue!=undefined){ // if a regular default is set, we select it
            this.values.forEach((item,i) => {

                if(item && ref.default==(item[ref.valueLabel]||item)){
                  this.select(i)
                }
                if(ref.multiple && Array.isArray(ref.default)){
                  if(item && ref.default.includes(item[ref.valueLabel]||item||false)){
                    this.select(i)
                  }
                }
            })
          }else{
            this.recalc()
          }
        }
        // this.$refs.input.blur()
        // this.$refs.content.blur()
      }
    },
    mounted(){
    }
  }
</script>
<style scoped>
.table td{
  white-space: nowrap;
}
table tbody {
  display: block;
  max-height: 300px;
  overflow-y: scroll;
}
table thead, table tbody tr {
  display: table;
  width: calc(100% - 17px);
  table-layout: fixed;
}
table tbody tr {
  display: table;
  width: 100%!important;
  table-layout: fixed;
  cursor:pointer;
}
table thead th.is-first,table tbody td.is-first{
  width:4em;
}
</style>
