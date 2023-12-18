<template>
  <div>
    <table class="table is-bordered is-striped is-fullwidth">
      <thead class="has-background-primary" @click="$emit('reset')">
        <tr>
          <th class="has-text-white is-first">Actions</th>
          <th class="has-text-white" v-for="label,idx in labels" :key="'label_'+label">{{label}}

            <span
              v-if="filters.includes(columns[idx])"
              class="icon dropdown is-clickable is-active"
              :class="{'has-text-warning':filterValues[columns[idx]]!=''}"
              @click="showFilters=!showFilters"
            >
              <font-awesome-icon class="dropdown-trigger" icon="filter" size="xs" />

            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr class="has-background-success-light" v-if="showFilters">
          <th class="has-text-white is-first"></th>
          <th class="has-text-white" v-for="column in columns" :key="'filter_'+column">
            <p v-if="filters.includes(column)" class="control has-icons-left has-icons-right">
              <input  class="input" v-model="filterValues[column]" />
              <span class="icon is-small is-left">
                <font-awesome-icon icon="filter" />
              </span>
            </p>
          </th>
        </tr>
        <tr v-for="item,i in displayedList" :key="'item_'+((identifier)?item[identifier]:item)+'_'+i" :class="{'has-background-link-light':(identifier)?currentItem==item[identifier]:currentItem==item}">
          <td class="is-first">
            <template v-for="a in actions" >
              <span :key="'action_'+a.name" v-if="item['allow'+a.name]==undefined || item['allow'+a.name]==true" class="icon is-clickable" :class="a.color" :title="a.title" @click="(identifier)?action(a.name,item[identifier]):action(a.name,item)"><font-awesome-icon :icon="a.icon" /></span>
              <span :key="'action_'+a.name" v-else class="icon has-text-grey-light"><font-awesome-icon :icon="a.icon" /></span>
            </template>
          </td>
          <template v-for="column,i in columns">
          <td v-if="(icons.length<=i)?true:!icons[i]"
            class="is-clickable"
            @click="(identifier)?action(actions[0].name,item[identifier]):action(actions[0].name,item)"
            :key="'item_'+item.name+'_value_'+column"
          >
            {{ (column)?item[column]:item }}
          </td>
          <td v-else :key="'item_'+item.name+'_value_'+column">
            <span v-if="(column)?item[column]:item" class="icon"><font-awesome-icon :icon="(column)?item[column]:item" /></span>
          </td>
          </template>
        </tr>
      </tbody>
    </table>
    <BulmaNavigation
      :dataList="filteredList"
      :perPage="perPage"
      :buttonsShown="buttonsShown"
      @change="setDisplayedList"
    />
  </div>
</template>
<script>
  import Vue from 'vue'
  import BulmaNavigation from './BulmaNavigation.vue'
  export default{
    name:"BulmaAdminTable",
    components:  {BulmaNavigation},
    props:{
      dataList:{type:Array},
      labels:{type:Array},
      columns:{type:Array},
      filters:{type:Array,default:()=>{return []}},
      icons:{type:Array,default:()=>{return []}},
      actions:{type:Array},
      identifier:{type:String},
      currentItem:{type:[String,Number]},
      perPage:{type:Number,default:10},
      buttonsShown:{type:Number,default:3}
    },
    data(){
      return  {
        displayedList:[],
        filterValues:{},
        showFilters:false
      }
    },methods:{
      action(name,id){
          this.$emit(name,id)
      },
      setDisplayedList(list){
        this.displayedList=list
      }
    },
    computed:{
      filteredList(){
        var ref=this
        var idx
        return this.dataList.filter(record => {
          var found=true
          ref.filters.forEach(field => {
            if(ref.filterValues[field] && !record[field].toUpperCase().includes(ref.filterValues[field].toUpperCase()))found=false
          });
          return found
        })
      }
    },
    mounted(){
      var ref=this
      ref.filters.forEach(field => {
        Vue.set(ref.filterValues,field,"")
      });
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
table thead th.is-first,table tbody td.is-first{
  width:8em!important;
  max-width:8em!important;
}
</style>
