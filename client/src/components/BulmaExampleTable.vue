<template>
  <div v-if="examples">
    <BulmaInput 
      icon="filter"
      placeholder="filter"
      v-model="search"
    />    
    <ul style="columns:2">
      <li v-for="e in filteredItems" :key="e.name">
        <router-link :to="{path:$route.path, hash:'#'+e.name.replaceAll(' ','_').toLowerCase()}"><strong>{{ e.short||e.name }}</strong></router-link>
      </li>
    </ul>


    <div v-for="f in filteredItems" class="mt-5" :key="f.name">
      <h2 class="subtitle" :id="f.name.replaceAll(' ','_').toLowerCase()" v-html="highlight(f.name)">
      </h2>
      <div v-if="f.version" class="field is-grouped is-grouped-multiline">
        <div class="control">
          <div class="tags has-addons">
            <span class="tag is-dark">version</span>
            <span class="tag is-info">{{f.version}}</span>
          </div>
        </div>
      </div>      
      <p v-if="f.description">
        <VueShowdown :markdown="highlight(f.description)" flavor="github" :options="{ghCodeBlocks:true}" />
      </p>
      <highlightjs v-if="f.code"
        :language="f.language || 'javascript'"
        :code="f.code"
      />
    </div>
  </div>
</template>
<script>
  import Vue from 'vue'
  import BulmaInput from './../components/BulmaInput.vue'
  export default{
    name:"BulmaExampleTable",
    props:['examples'],
    components:{BulmaInput},
    computed:{
      filteredItems(){
        return this.examples?.filter(x => (x.name?.toLowerCase().includes(this.search.toLowerCase()) || 
            x.description?.toLowerCase().includes(this.search.toLowerCase()) 
        ))
      },
      hasOutput(){
        return this.filteredItems?.filter(x => x.output)?.length>0
      },

    },
    data(){
      return{
        search: ""
      }
    },
    methods:{
      escapeRegExp(string){
          return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
      },   
      highlight(x){
        if(this.search && x){
          var esc = this.search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'); // eslint-disable-line
          var reg = new RegExp(esc, 'ig');
          return x.replace(reg, '<span style="background-color:yellow">$&</span>');
        }
        return x
      },
    }
  }
</script>
<style scoped>
</style>
