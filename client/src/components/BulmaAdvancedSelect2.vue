<template>
    <div class="columns is-gapless">
        <div class="column is-flex border-right">
            <div class="p-2 is-fullwidth">
                <BulmaAdvancedTable2
                    :required="required||false"
                    :values="valuesNotSelected||[]"
                    v-model="selectedToMoveRight"
                    :columns="columns||[]"
                    :filterColumns="filterColumns||[]"
                    :previewColumn="previewColumn||''"
                    :valueColumn="valueColumn||''"
                    @reset="preview='';"
                />
            </div>

        </div>
        <div class="has-background-light column is-narrow is-flex is-justify-content-center is-align-items-center">
            <div class="m-3">
                <button class="button button-arrow is-success is-outlined" @click="moveAllRight"><font-awesome-icon icon="angles-right" /></button><br>
                <button class="button button-arrow is-success is-outlined" @click="moveRight"><font-awesome-icon icon="angle-right" /></button><br>
                <button class="button button-arrow is-warning is-outlined" @click="moveLeft"><font-awesome-icon icon="angle-left" /></button><br>
                <button class="button button-arrow is-warning is-outlined" @click="moveAllLeft"><font-awesome-icon icon="angles-left" /></button>                
            </div>
            
        </div>
        <div class="column is-flex border-left">
            <div class="p-2 is-fullwidth">
                <BulmaAdvancedTable2
                    :required="required||false"
                    :values="this.selected||[]"
                    v-model="selectedToMoveLeft"
                    :columns="columns||[]"
                    :filterColumns="filterColumns||[]"
                    :previewColumn="previewColumn||''"
                    :valueColumn="valueColumn||''"
                    @reset="preview=''"
                    @input="change"
                />
            </div>

        </div>
    </div>
</template>

<script>

import Vue from 'vue'
import BulmaAdvancedTable2 from './BulmaAdvancedTable2.vue'
import _ from 'lodash'
export default {
    name: "BulmaAdvancedSelect2",
    components: {
        BulmaAdvancedTable2
    },
    props: {
        values: { type: Array, required: true },
        required: { type: Boolean },
        name: { type: String, required: true },
        defaultValue: { type: [String, Array,Object] },
        columns: { type: Array },
        previewColumn: { type: String },
        valueColumn: { type: String},
        filterColumns: { type: Array },
        disabled: { type: Boolean }
    },
    watch:{
        values: {
            handler(val){
            this.recalc()
            },
            deep: true
        },  
    },
  
    data() {
        return {
            selectedToMoveRight: {},
            selectedToMoveLeft: {},
            selectedToMove:undefined,
            selected: [],
            checkAll: false,
            labels: [],
            valueLabel: "",
            previewLabel: "",
            queryfilter: ""
        }
    },
    computed: {
        valuesNotSelected(){
            return _.difference(this.values,this.selected)
        },
    },
    methods: {
      moveRight(){
          this.selected=_.concat(this.selected,this.selectedToMoveRight.values)
      },
      moveLeft(){
          this.selected=_.difference(this.selected,this.selectedToMoveLeft.values)
      },
      moveAllRight(){
          this.selected=_.concat(this.values,[])
      },
      moveAllLeft(){
          this.selected=[]
      },
      change(){
        if(this.selected.length==0){
            this.$emit('input',{value:undefined,preview:undefined})
        }else{
            this.$emit('input', {values:this.selected,preview:this.selectedToMoveLeft.preview})   
        }
      },
      recalc(){
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

            if(this.defaultValue=="__auto__"){
                this.selected.push(this.values[0]);
            }else if(this.defaultValue=="__all__"){ // if all is set, we select all
                this.moveAllRight()
            }else if(this.defaultValue!="__none__" && this.defaultValue!=undefined){ // if a regular default is set, we select it
                var obj=undefined
                var defaulttype
                try{
                    obj = JSON.parse(this.defaultValue)
                    if(typeof obj == "object"){
                        defaulttype="object"
                    }
                }catch(err){
                    obj=undefined
                }
                if(typeof this.defaultValue == "object"){
                    obj=this.defaultValue
                    defaulttype="object"
                }
                if(defaulttype=="object"){
                    obj=_.concat(obj,[])
                    this.selected=_.intersectionWith(this.values,obj,_.isEqual)
                }else{
                    // we search for the value by string
                    this.values.forEach((item) => {
                        if(item && ref.defaultValue==(item[ref.valueLabel]||item)){
                            this.selected.push(item)
                        }else if(Array.isArray(ref.defaultValue) && ref.defaultValue.length>0){
                            if(item && ref.defaultValue.includes(item[ref.valueLabel]||item||false)){
                                this.selected.push(item)
                            }
                        }
                    })
                }
            }
        }
       
      }
    },
    mounted() {
        var ref = this
        this.recalc()
    }

}

</script>
<style scoped>
    .button-arrow{
        width:4rem;
        margin-bottom:0.3rem;    
    }
    .border-right{
        border-right:1px solid #aaa;
    }
    .border-left{
        border-left:1px solid #aaa;
    }
    .is-fullwidth{
        width:100%
    }
</style>
