<template>
    <div>
      <div class="pb-2">
        <p class="control has-icons-left">
          <input class="input is-info" tabindex="0" ref="queryfilter" type="text" placeholder="" v-model="queryfilter">
          <span class="icon is-small is-left">
            <font-awesome-icon icon="search" />
          </span>
        </p>
      </div>
      <div v-if="values.length==0" class="pl-3">No data</div>
      <div v-if="values.length>0 && filtered.length==0" class="pl-3">Filter returns no results</div>
      <div v-if="filtered.length>0" class="table-container">
        <table class="table is-hoverable is-bordered">
          <thead v-if="labels.length>1">
            <tr :class="sizeClass">
              <th :key="l" v-for="l in labels">{{ l }}</th>
            </tr>
          </thead>
          <thead v-if="labels.length==1">
            <tr :class="sizeClass">
               <th>Name</th>
            </tr>
          </thead>
          <tbody>
            <tr :class="{'has-background-info':selected[v.index],'has-text-white':selected[v.index],sizeClass:sizeClass}" :key="v.index" v-for="v in filtered" @click="select(v.index)">
              <td v-for="l in labels" v-html="highlightFilter(v.value[l],l)" :key="l"></td>
              <td v-if="labels.length==0" v-html="highlightFilter(v.value)"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
</template>
<script>
  import Vue from 'vue'
  import h from '../lib/Helpers'
  export default{
    name:"BulmaAdvancedTable2",
    props: {
      values: {
        type: Array,
        required: true,
      },
      required:{type:Boolean},
      status:{type:String},
      sizeClass:{type:String},
      columns:{type:Array},
      previewColumn:{type:String},
      valueColumn:{type:String},
      filterColumns:{type:Array},
      focus:{type:String}
    },
    data () {
      return {
        selected:{},
        labels:[],
        valueLabel:"",
        previewLabel:"",
        preview:"",
        isLoading:true,
        queryfilter:"",
        foo:""
      }
    },
    computed: {
      selectedItems(){
        return this.values.filter((v,i) => this.selected[i])
      },
      test(){
        return this.selected[0]
      },
      checkAll(){
        var ref=this
        var all=true
        var BreakException = {};
        try{
          this.filtered.forEach((item)=>{
            if(!ref.selected[item.index]){
              all=false
            }
          })
        }catch (e) {
          if (e !== BreakException) throw e;
        }
        return all
      },
      filtered(){
        var ref=this
        return this.values.reduce(function(filtered, item,i) {
          var found=false
          if(ref.queryfilter){
            var cols=[]
            // if filtercolumns, use them

            if(ref.filterColumns.length>0){
              cols=ref.filterColumns
            }else{
              // if not, take the previewLabel
              if(ref.previewLabel){
                cols.push(ref.previewLabel)
              }
            }
            // if the item exists
            if(item){
              // go over all filterColumns
              if(cols.length>0){
                cols.forEach((col) => {
                  // if the column is present
                  if(item[col]){
                    // check if the value contains our filter
                    found||=item[col].toString().toLowerCase().includes(ref.queryfilter.toLowerCase())
                  }else{
                    // no item, always pass
                    found=true
                  }
                });
              }else{
                // normal array
                found=item.toString().toLowerCase().includes(ref.queryfilter.toLowerCase())
              }

            }
          }else{
            found=true
          }
          // var found = ((item)?item[ref.previewLabel]||item:"").toString().toLowerCase().includes(ref.queryfilter.toLowerCase())
          if(found){
            filtered.push({index:i,value:item})
          }
          return filtered;
        }, []);
      },
    },
    watch: {                    // we watch the values prop for changes... each time we reset the data and grab the labels
      values: {
         handler(val){
           this.queryfilter=""   // remove filter
           this.selected={}      // selections
           this.getLabels()      // re lookup labels
           this.$emit('reset')   // signal reset preview to parent
           this.recalc()
         },
         deep: true
      },
      focus:{
        handler(val){
          if(val=='content'){
            var ref=this
            this.$nextTick(()=>{
              ref.$refs.queryfilter.focus({ preventScroll: true })
              ref.$emit('focusset')
            })
          }
        }
      }
    },
    methods:{
      objectEqual(object1,object2){
        const keys1 = Object.keys(object1);
        const keys2 = Object.keys(object2);
        for (let key of keys1) {
          if (object1[key] !== object2[key]) {
            return false;
          }
        }
        return true;
      },
      highlightFilter(v,label=undefined){
        var s=v+""
        var cols=[]
        if(this.filterColumns.length>0){
          cols=this.filterColumns
        }else{
          if(this.previewLabel){
            cols.push(this.previewLabel)
          }
        }
        if(label && !cols.includes(label)){
          return h.htmlEncode(s)
        }
        var index;
        var search=this.queryfilter;
        var l=search.length
        var p1,p2,p3
        if(s && this.queryfilter){
          index=s.toLowerCase().indexOf(search.toLowerCase())
          if(index>=0){
            p1=s.slice(0,index)
            p2=s.slice(index,index+l)
            p3=s.slice(index+l)
            return `${h.htmlEncode(p1)}<span class='has-text-weight-bold'>${h.htmlEncode(p2)}</span>${h.htmlEncode(p3)}`
          }else{
            return h.htmlEncode(s)
          }

        }else{
          return v
        }
      },
      select(i){
        Vue.set(this.selected,i,!this.selected[i]);
        this.recalc()
      },
      choose(i){
        Vue.set(this.chosen,i,!this.selected[i]);
        this.recalc()
      },      
      recalc(){
        var ref=this
        var l = this.values.length
        var first = this.values.slice(0,3)
        if(l>0){
          if(l>3){
            this.preview = first.map(i => {return ((i)?(i[ref.previewLabel]??i):"undefined")}).join(', ') + ", ... ("+l+" items selected)"
          }else{
            this.preview = first.map(i => {return ((i)?(i[ref.previewLabel]??i):"undefined")}).join(', ')
          }
        }else{
          this.preview = ""
        }
        this.$emit('input', {values:this.selectedItems,preview:this.preview})
        this.foo=JSON.stringify(this.preview)
      },
      multicheck(){
        var ref=this
        if(!this.checkAll){
          ref.filtered.forEach((item) => {Vue.set(ref.selected,item.index,true)})
        }else{
          ref.filtered.forEach((item) => {Vue.set(ref.selected,item.index,false)})
        }
        this.recalc()
      },
      reset(){
        var ref=this
        this.filtered.forEach((item) => {
          Vue.set(ref.selected,item.index,false)
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
          }else{
            if(this.labels.length>0)
              ref.valueLabel=this.labels[0]
          }
        }

      }
    },
    mounted(){
      var ref=this
      this.reset()
      this.getLabels()
    }
  }
</script>
<style scoped>
.table td,.table th{
  max-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
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
  width:4em!important;
  max-width:4em!important;
}
</style>
