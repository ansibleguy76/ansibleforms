

<template>

<div>
    <div v-if="!sticky && !horizontal" v-click-outside="dropfocus" class="dropdown is-fullwidth" :class="{'is-active':isActive && !isLoading,'is-up':isUp,'is-right':isRight}">
        <div ref="dt" class="dropdown-trigger">
            <p class="control has-icons-right" :class="{'has-icons-left':icon!=undefined}">
                <input class="input" ref="input" :class="{'is-danger':hasError}" :readonly="!disabled" type="text" :value="(isLoading)?'':preview" :placeholder="(isLoading)?'Loading...':placeholder" aria-haspopup="true" aria-controls="dropdown-menu" @keydown.esc="close()"
                @keydown.tab="close()" @keydown.space="toggle()" @mouseup="toggle()" :disabled="disabled" :tabindex="null">
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
        <div ref="dd" class="dropdown-menu" :style="'width:'+dropdownMenuWidth" id="dropdown-menu" role="menu">
            <div class="dropdown-content" ref="content" @keydown.esc="close()" @keydown.tab="close()">
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
                  @isSelected="close()"
                  @reset="preview=''"
                  :focus="focus"
                  @focusset="focus=''"
                />
            </div>
        </div>
    </div>
    <div class="inputborder mb-2 p-2" :class="{'hasError':hasError}" v-if="!horizontal && sticky" tabindex="0">
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
          @reset="preview=''"
        />
    </div>
    <div v-if="!sticky && horizontal" v-click-outside="dropfocus" class="dropdown is-fullwidth" :class="{'is-active':isActive && !isLoading,'is-up':isUp,'is-right':isRight}">
        <div class="dropdown-trigger">
            <p class="control has-icons-right" :class="{'has-icons-left':icon!=undefined}">
                <input class="input" ref="input" :class="{'is-danger':hasError}" :readonly="!disabled" type="text" :value="(isLoading)?'':preview" :placeholder="(isLoading)?'Loading...':placeholder" aria-haspopup="true" aria-controls="dropdown-menu" @keydown.esc="close()"
                @keydown.tab="close()" @keydown.space="toggle()" @mouseup="toggle()" :disabled="disabled" :tabindex="null">
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
        <div ref="dd" class="dropdown-menu" :style="'width:'+dropdownMenuWidth" id="dropdown-menu" role="menu">
            <div class="dropdown-content p-0" ref="content" @keydown.esc="close()" @keydown.tab="close()">
                <BulmaAdvancedSelect2
                    :required="required||false"
                    :name="name"
                    :defaultValue="defaultValue"
                    :values="values||[]"
                    v-model="selected"
                    :columns="columns||[]"
                    :filterColumns="filterColumns||[]"
                    :previewColumn="previewColumn||''"
                    :valueColumn="valueColumn||''"
                    @reset="preview=''"
                    :focus="focus"
                    @focusset="focus=''"
                />
            </div>
        </div>
    </div>    
    <div class="inputborder mb-2" :class="{'hasError':hasError}" v-if="horizontal && sticky" tabindex="0">
        <BulmaAdvancedSelect2
            :required="required||false"
            :name="name"
            :defaultValue="defaultValue"
            :values="values||[]"
            v-model="selected"
            :columns="columns||[]"
            :filterColumns="filterColumns||[]"
            :previewColumn="previewColumn||''"
            :valueColumn="valueColumn||''"
            @reset="preview=''"
        />
    </div>    

</div>

</template>

<script>

import Vue from 'vue'
import BulmaAdvancedTable from './BulmaAdvancedTable.vue'
import BulmaAdvancedSelect2 from './BulmaAdvancedSelect2.vue'
export default {
    name: "BulmaAdvancedSelect",
    components: {
        BulmaAdvancedTable,
        BulmaAdvancedSelect2
    },
    props: {
        containerSize: {type: Object},
        values: { type: Array, required: true },
        hasError: { type: Boolean },
        multiple: { type: Boolean },
        required: { type: Boolean },
        isLoading: { type: Boolean },
        name: { type: String, required: true },
        defaultValue: { type: [String, Array,Object] },
        placeholder: { type: String },
        icon: { type: String },
        sizeClass: { type: String },
        columns: { type: Array },
        previewColumn: { type: String },
        valueColumn: { type: String},
        pctColumns: { type: Array},
        filterColumns: { type: Array },
        sticky: { type: Boolean },
        horizontal: {type: Boolean},
        disabled: { type: Boolean }
    },
    data() {
        return {
            selected: {},
            isActive: false,
            checkAll: false,
            labels: [],
            valueLabel: "",
            previewLabel: "",
            preview: "",
            focus: "",
            queryfilter: "",
            isUp: false,
            isRight: false,
            dropdownMenuWidth:"100%"
        }
    },
    watch: { // we watch the selected change and emit input event
        selected: {
            handler(val) {
                this.preview = val.preview
                this.$emit('input', val.values)
            },
            deep: true
        },
        containerSize:{
            handler(val){
                this.calcDropdownMenuWidth()
            },
            deep: true
        }
    },
    methods: {
      close(a) {
          this.isActive = false
          this.$refs.input?.focus({ preventScroll: true  })
      },
      toggle() {
          if (this.disabled) return
          var ref = this
          this.isUp = false
          this.isActive = !this.isActive
          if (this.isActive && !this.isLoading) {
              this.$nextTick(() => {
                  ref.focus = "content";
                  //calculate if we need to do a dropup
                  var dd = ref.$refs["dd"]?.getBoundingClientRect()
                  var dt = ref.$refs["dt"]?.getBoundingClientRect()
                  if(dt){
                    var wh = window.innerHeight
                    var ww = window.innerWidth
                    // if dropdown is out out of view AND there is space for dropup, do dropup
                    ref.isUp=((dd.bottom>wh) && (dd.height<(dt.top-100)))
                    ref.isRight=(dt.left>ww/2)
                    this.calcDropdownMenuWidth()   
                  }
              })
          }
      },
      calcDropdownMenuWidth(){
        var valueLength=0
        try{ 
            if(typeof this.values[0]=="object")
                valueLength=Object.keys(this.values[0]).length 
        }catch(e){
            //
        }
        var columnsCount=this.columns?.length || valueLength
        if(this.horizontal || (columnsCount>1)){
            var dt = this.$refs["dt"]?.getBoundingClientRect()
            var dtleft = dt?.left||0
            var dtright = (dt?.right||0)
            var ww = this.containerSize.width
            var wx = this.containerSize.x         
            var widthIfLeft = (ww+wx-dtleft-25)
            var widthIfRight = (dtright-wx-25)
            var width=((this.isRight)?widthIfRight:widthIfLeft)
            this.dropdownMenuWidth=width+"px"
        }

      },
      dropfocus(){
        if(this.isActive){
          this.isActive=false
          // don't reset focus
        }
      }
    },
    mounted() {
        var ref = this
            // this.$refs.input.blur()
            // this.$refs.content.blur()
    },
    directives: {
        'click-outside': {
            bind: function(el, binding, vNode) {
                // Provided expression must evaluate to a function.
                if (typeof binding.value !== 'function') {
                    const compName = vNode.context.name
                    let warn = `[Vue-click-outside:] provided expression '${binding.expression}' is not a function, but has to be`
                    if (compName) {
                        warn += `Found in component '${compName}'`
                    }

                    console.warn(warn)
                }
                // Define Handler and cache it on the element
                const bubble = binding.modifiers.bubble
                const handler = (e) => {
                    if (bubble || (!el.contains(e.target) && el !== e.target)) {
                        binding.value(e)
                    }
                }
                el.__vueClickOutside__ = handler

                // add Event Listeners
                document.addEventListener('click', handler)
            },

            unbind: function(el, binding) {
                // Remove Event Listeners
                document.removeEventListener('click', el.__vueClickOutside__)
                el.__vueClickOutside__ = null

            }
        }
    }
}

</script>
<style scoped>

.dropdown.is-fullwidth {
    display: flex;
}

.dropdown input {
    cursor: pointer;
}

.dropdown .dropdown-trigger,
.dropdown{ 
    width: 100%;
}

.dropdown-menu {
  min-width: 100%;
}

.dropdown.is-fullwidth .button {
    display: flex;
    width: 100%;
    justify-content: space-between
}

.dropdown-content {
    border: 1px solid black;
}


.inputborder {
    background-color: white;
    border: 1px solid #d9dee2;
    border-radius: 4px;
}

.hasError {
    border-color: #ea4141!important;
}

</style>
