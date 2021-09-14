<template>
  <div class="dropdown is-fullwidth" :class="{'is-active':isActive && !isLoading}">
    <div class="dropdown-trigger">
      <p class="control has-icons-right" :class="{'has-icons-left':icon!=undefined}">
        <input
          class="input"
          ref="input"
          :class="{'is-danger':hasError}"
          readonly
          type="text"
          :value="(isLoading)?'':preview"
          :placeholder="(isLoading)?'Loading...':placeholder"
          aria-haspopup="true"
          aria-controls="dropdown-menu"
          @keydown.esc="close()"
          @keydown.tab="close()"
          @keydown.space="toggle()"
          @mousedown="toggle()"
        >
        <span v-if="icon!=undefined" class="icon is-small is-left">
          <i class="fas" :class="icon"></i>
        </span>
        <span class="icon is-small is-right">
          <i v-if="isLoading" class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          <i v-else-if="!isActive" class="fas fa-angle-down" aria-hidden="true"></i>
          <i v-else class="fas fa-angle-right" aria-hidden="true"></i>
        </span>
      </p>
    </div>
    <div class="dropdown-menu" id="dropdown-menu" role="menu">
      <div class="dropdown-content" ref="content" tabindex="0" @keydown.esc="close()" @keydown.tab="close()" @blur="close()">
        <p v-if="values.length==0">No data</p>
        <div v-if="values.length>0" class="table-container">
          <table class="table is-hoverable is-narrow">
            <thead v-if="labels.length>1">
              <tr>
                <th v-if="multiple" class="is-first">
                  <i v-if="checkAll" @click="multicheck()" class="fal fa-check-square"></i>
                  <i v-else @click="multicheck()" class="fal fa-square"></i>
                </th>
                <th class="is-size-7" :key="l" v-for="l in labels">{{ l }}</th>
              </tr>
            </thead>
            <tbody>
              <tr :class="{'has-background-info':selected[i],'has-text-white':selected[i]}" :key="i" v-for="v,i in values" @click="select(i)">
                <td v-if="multiple" class="is-first is-size-7">
                  <i v-if="selected[i]" class="fal fa-check-square"></i>
                  <i v-else class="fal fa-square"></i> <span class="is-size-7 has-text-grey-lighter">{{i}}</span>
                </td>
                <td class="is-size-7" :key="l" v-for="l in labels">{{ v[l] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
  import Vue from 'vue'
  // import BulmaCheckbox from './BulmaCheckbox.vue'
  export default{
    name:"BulmaAdvancedSelect",
    // components:{BulmaCheckbox},
    props: {
      values: {
        type: Array,
        required: true,
      },
      icon:{type:String,required:false},
      hasError:{type:Boolean},
      multiple:{type:Boolean},
      outputObject:{type:Boolean},
      required:{type:Boolean},
      name:{type:String,required:true},
      default:{type:String},
      placeholder:{type:String},
      status:{type:String}
    },
    data () {
      return {
        selected:{},
        isActive:false,
        checkAll:false,
        labels:[],
        firstLabel:"",
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
      },
      status(val){
         if(['fixed','variable'].includes(this.status)){
           this.isLoading=false
         }else{
           this.isLoading=true
         }
      }
    },
    methods:{
      close(){
        this.isActive=false
      },
      toggle(){
        var ref=this
        this.isActive=!this.isActive
        if(this.isActive){
          this.$nextTick(()=>{ref.focus="content"})
        }
      },
      select(i){
        if(this.multiple){
          this.selected[i]=!this.selected[i];
        }else{
          var temp = !this.selected[i]  // if single just clear and invert selection
          this.selected=[]
          this.selected[i]=temp;
          this.isActive=false;
          this.$refs.input.focus()
        }
        this.recalc()
      },
      recalc(){
        var ref=this
        var result = this.values.filter((v,i) => this.selected[i]) // normal, return array of objects
        var flattenedresult = result.map((item,i) => item[ref.firstLabel])

        if(this.multiple){ // multiple and outputObject, return simple array
          if(!this.outputObject){
            this.$emit('input', flattenedresult)
          }else{
            this.$emit('input', result)
          }
        }else{
          if(!this.outputObject){
            if(flattenedresult.length>0)
              this.$emit('input', flattenedresult[0])
            else {
              this.$emit('input', undefined)
            }
          }else{
            if(result.length>0)
              this.$emit('input', result[0])
            else{
              this.$emit('input', undefined)
            }
          }
        }

        this.$emit('ischanged')
        var first = result.slice(0,3)
        if(result.length>0){
          if(result.length>3){
            this.preview = first.map(i => {return i[ref.firstLabel]}).join(', ') + ", ... ("+result.length+" items selected)"
          }else{
            this.preview = first.map(i => {return i[ref.firstLabel]}).join(', ')
          }
        }else{
          this.preview = ""
        }
        this.checkAll=(result.length==this.values.length)
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
        this.preview=""
        if(this.values.length>0){
          this.labels = Object.keys(this.values[0])
          if(this.labels.length>0){
            this.firstLabel = this.labels[0]
          }else{
            this.firstLabel=""
          }
          if(this.default=="__auto__" && this.values.length>0){
            this.select(0) // if __auto__ select the first
          }else if(this.default!="__none__" && this.default!=undefined){ // if a regular default is set, we select it
            this.values.forEach((item,i) => {
              if(ref.default==item[ref.firstLabel]){
                this.select(i)
              }
            })
          }else{
            this.recalc()
          }
        }
        this.$refs.input.blur()
        this.$refs.content.blur()
      }
    },
    mounted(){
      var ref=this
      setInterval(function(){
        if(ref.focus=="content"){
          ref.focus=""
          ref.$refs.content.focus()
        }
      }, 100);
    }
  }
</script>
<style scoped>
.table td{
  white-space: nowrap;
}
.dropdown.is-fullwidth {
  display: flex;
}
.dropdown input{
  cursor:pointer;
}
.dropdown .dropdown-trigger,.dropdown .dropdown-menu {
    width: 100%;
}
.dropdown.is-fullwidth .button {
    display: flex;
    width: 100%;
    justify-content: space-between
}
.dropdown-content{
  border:1px solid black;
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
