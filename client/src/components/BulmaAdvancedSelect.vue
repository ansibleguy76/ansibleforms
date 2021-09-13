<template>
  <div class="dropdown is-fullwidth" :class="{'is-active':isActive}" @keydown.esc="isActive=false"  @keydown.tab="isActive=false">
    <div class="dropdown-trigger">
      <p class="control has-icons-right" :class="{'has-icons-left':icon!=undefined}">
        <input class="input" :class="{'is-danger':hasError}" readonly type="email" :placeholder="placeholder" aria-haspopup="true" aria-controls="dropdown-menu" @click="isActive=!isActive">
        <span v-if="icon!=undefined" class="icon is-small is-left">
          <i class="fas" :class="icon"></i>
        </span>
        <span class="icon is-small is-right">
          <i v-if="!isActive" class="fas fa-angle-down" aria-hidden="true"></i>
          <i v-if="isActive" class="fas fa-angle-right" aria-hidden="true"></i>
        </span>
      </p>
    </div>
    <div class="dropdown-menu" id="dropdown-menu" role="menu">
      <div class="dropdown-content">
        <p v-if="values.length==0">No data</p>
        <div v-if="values.length>0" class="table-container">
          <table class="table is-striped is-hoverable is-narrow">
            <thead>
              <tr>
                <th v-if="multiple" class="is-first"><BulmaCheckbox v-model="checkAll" @ischanged="multicheck()"></BulmaCheckbox></th>
                <th :key="l" v-for="l in labels">{{ l }}</th>
              </tr>
            </thead>
            <tbody>
              <tr :class="{'has-background-info':selected[i],'has-text-white':selected[i]}" :key="i" v-for="v,i in values" @click="select(i)">
                <td v-if="multiple" class="is-first"><i v-if="selected[i]" class="fal fa-check-square"></i><i v-else class="fal fa-square"></i> <span class="is-size-7 has-text-grey-lighter">{{i}}</span></td>
                <td :key="l" v-for="l in labels">{{ v[l] }}</td>
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
  import BulmaCheckbox from './BulmaCheckbox.vue'
  export default{
    name:"BulmaAdvancedSelect",
    components:{BulmaCheckbox},
    props: {
      values: {
        type: Array,
        required: true,
      },
      icon:{type:String,required:false},
      hasError:{type:Boolean},
      multiple:{type:Boolean},
      name:{type:String,required:true}
    },
    data () {
      return {
        selected:{},
        isActive:false,
        checkAll:false,
        placeholder:"Select...",
        labels:[],
        firstLabel:""
      }
    },
    computed: {
    },
    watch: {
      values: {
         handler(val){
           this.reset()
           this.getLabels()
         },
         deep: true
      }
    },
    methods:{
      select(i){
        if(this.multiple){
          this.selected[i]=!this.selected[i];
        }else{
          var temp = !this.selected[i]
          this.selected=[]
          this.selected[i]=temp;
          this.isActive=false;
        }
        this.recalc()
      },
      recalc(){
        var ref=this
        var result = this.values.filter((v,i) => this.selected[i])
        this.$emit('input', result)
        this.$emit('ischanged')
        var first = result.slice(0,3)
        if(result.length>0){
          if(result.length>3){
            this.placeholder = first.map(i => {return i[ref.firstLabel]}).join(', ') + ", ... ("+result.length+" items selected)"
          }else{
            this.placeholder = first.map(i => {return i[ref.firstLabel]}).join(', ')
          }
          if(result.length==this.values.length)this.checkAll=true
        }else{
          this.placeholder = "Select..."
          this.checkAll=false
        }
      },
      multicheck(){
        var ref=this
        if(this.checkAll){
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
        if(this.values.length>0){
          this.labels = Object.keys(this.values[0])
          if(this.labels.length>0){
            this.firstLabel = this.labels[0]
          }else{
            this.firstLabel=""
          }
        }
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
.dropdown.is-fullwidth {
  display: flex;
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
