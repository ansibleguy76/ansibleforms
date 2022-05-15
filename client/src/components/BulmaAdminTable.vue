<template>
  <div>
    <table class="table is-bordered is-striped is-fullwidth">
      <thead class="has-background-primary">
        <tr>
          <th class="has-text-white is-first">Actions</th>
          <th class="has-text-white" v-for="label in labels" :key="'label_'+label">{{label}}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in displayedList" :key="'item_'+((identifier)?item[identifier]:item)" :class="{'has-background-link-light':(identifier)?currentItem==item[identifier]:currentItem==item}">
          <td class="is-first">
            <template v-for="a in actions" >
              <span :key="'action_'+a.name" v-if="item['allow'+a.name]==undefined || item['allow'+a.name]==true" class="icon is-clickable" :class="a.color" :title="a.title" @click="(identifier)?action(a.name,item[identifier]):action(a.name,item)"><font-awesome-icon :icon="a.icon" /></span>
              <span :key="'action_'+a.name" v-else class="icon has-text-grey-light"><font-awesome-icon :icon="a.icon" /></span>
            </template>
          </td>
          <td class="is-clickable" @click="(identifier)?action(actions[0].name,item[identifier]):action(actions[0].name,item)" v-for="column in columns" :key="'item_'+item.name+'_value_'+column">{{ (column)?item[column]:item }}</td>
        </tr>
      </tbody>
    </table>
    <BulmaNavigation
      v-if="dataList && dataList.length>0"
      :dataList="dataList"
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
      actions:{type:Array},
      identifier:{type:String},
      currentItem:{type:[String,Number]},
      perPage:{type:Number,default:10},
      buttonsShown:{type:Number,default:3}
    },
    data(){
      return  {
        displayedList:[]
      }
    },methods:{
      action(name,id){
          this.$emit(name,id)
      },
      setDisplayedList(list){
        this.displayedList=list
      }
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
