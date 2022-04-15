<template>
  <div>
    <div v-if="!sticky" class="dropdown is-fullwidth" :class="{'is-active':isActive && !isLoading,'is-up':isUp}">
      <div class="dropdown-trigger">
        <p class="control has-icons-right" :class="{'has-icons-left':icon!=undefined}">
          <input
            class="input"
            ref="input"
            :class="{'is-danger':hasError}"
            :readonly="!disabled"
            type="text"
            :value="(isLoading)?'':preview"
            :placeholder="(isLoading)?'Loading...':placeholder"
            aria-haspopup="true"
            aria-controls="dropdown-menu"
            @keydown.esc="close()"
            @keydown.tab="close()"
            @keydown.space="toggle()"
            @mousedown="toggle()"
            :disabled="disabled"
          >
          <span v-if="icon!=undefined" class="icon is-small is-left">
            <font-awesome-icon :icon="icon" />
          </span>
          <span class="icon is-small is-right">
            <font-awesome-icon v-if="isLoading" icon="spinner" spin />
            <font-awesome-icon v-else-if="!isActive" icon="angle-down" />
            <font-awesome-icon v-else icon="angle-right" />
          </span>
        </p>
      </div>
      <div ref="dd" class="dropdown-menu" id="dropdown-menu" role="menu">
        <div class="dropdown-content" ref="content" @keydown.esc="close()" @keydown.tab="close()" >
          <BulmaAdvancedTable
            :defaultValue="defaultValue"
            :required="required||false"
            :multiple="multiple||false"
            :name="name"
            :placeholder="placeholder||'Select...'"
            :values="values||[]"
            v-model="selected"
            :columns="columns||[]"
            :pctColumns="pctColumns||[]"
            :filterColumns="filterColumns||[]"
            :previewColumn="previewColumn||''"
            :valueColumn="valueColumn||''"
            @ischanged="$emit('ischanged')"
            @isSelected="close()"
            ref="child"
           />
        </div>
      </div>
    </div>
    <div class="inputborder mb-2 p-2" :class="{'hasError':hasError}" v-else tabindex="0">
      <BulmaAdvancedTable
        :defaultValue="defaultValue"
        :required="required||false"
        :multiple="multiple||false"
        :name="name"
        :values="values||[]"
        v-model="selected"
        :columns="columns||[]"
        :pctColumns="pctColumns||[]"
        :filterColumns="filterColumns||[]"
        :previewColumn="previewColumn||''"
        :valueColumn="valueColumn||''"
        @ischanged="$emit('ischanged')"
       />
    </div>

  </div>
</template>
<script>
  import Vue from 'vue'
  import BulmaAdvancedTable from './BulmaAdvancedTable.vue'
  export default{
    name:"BulmaAdvancedSelect",
    components:{BulmaAdvancedTable},
    props: {
      values: {
        type: Array,
        required: true,
      },
      hasError:{type:Boolean},
      multiple:{type:Boolean},
      required:{type:Boolean},
      isLoading:{type:Boolean},
      name:{type:String,required:true},
      defaultValue:{type:[String,Array]},
      placeholder:{type:String},
      icon:{type:String},
      sizeClass:{type:String},
      columns:{type:Array},
      previewColumn:{type:String},
      valueColumn:{type:String},
      pctColumns:{type:Array},
      filterColumns:{type:Array},
      sticky:{type:Boolean},
      disabled:{type:Boolean}
    },
    data () {
      return {
        selected:{},
        isActive:false,
        checkAll:false,
        labels:[],
        valueLabel:"",
        previewLabel:"",
        preview:"",
        focus:"",
        queryfilter:"",
        isUp:false
      }
    },
    computed: {
    },
    watch: {                    // we watch the selected change and emit input event
      selected: {
         handler(val){
           this.preview=val.preview
           this.$emit('input',val.values)
         },
         deep: true
      }
    },
    methods:{
      testUp(){

      },
      handleBlur(event){
        console.log(event)
        // if (event.currentTarget && !event.currentTarget.contains(event.relatedTarget)) {
        //   this.close()
        // }
      },
      close(){
        this.isActive=false
        this.$refs.input.focus({ preventScroll: true })
        // this.queryfilter=""
      },
      toggle(){
        if(this.disabled)return
        var ref=this
        this.isUp=false
        this.isActive=!this.isActive
        if(this.isActive){
          this.$nextTick(()=>{
            ref.focus="content";
            // calculate if we need to do a dropup
            var dim = ref.$refs["dd"].getBoundingClientRect()
            var wh = window.innerHeight
            // if dropdown is out out of view AND there is space for dropup, do dropup
            ref.isUp=((dim.bottom>wh) && (dim.top>dim.height))
          })
        }
      }
    },
    mounted(){
      var ref=this
      setInterval(function(){
        if(ref.focus=="content"){
          if(ref.$refs.content){
            ref.focus=""
            ref.$refs.content.focus({ preventScroll: true })
          }
        }
      }, 100);
      // this.$refs.input.blur()
      // this.$refs.content.blur()
    }
  }
</script>
<style scoped>
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
.inputborder{
  background-color: white;
  border:1px solid #d9dee2;
  border-radius: 4px;
}
.hasError{
  border-color: #ea4141!important;
}
</style>
