<template>
  <div v-if="help">
    <BulmaInput 
      icon="filter"
      placeholder="filter"
      v-model="search"
    />
    <table class="table mt-2 is-bordered is-striped">
      <thead>
        <tr>
          <th>{{ itemName }}</th>
          <th v-if="hasDefaults">Choices/Defaults</th>
          <th>Comments</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="f in filteredItems" :key="f.name">
          <td>
            <span class="has-text-weight-bold" v-html="highlight(f.name)"></span><br>
            <span class="has-text-primary">{{f.type}}</span>
            <span v-if="f.required" class="has-text-danger"> / required</span>
            <span v-if="f.unique" class="has-text-warning"> / unique</span>
            <br>
            <span v-if="f.version" class="is-italic has-text-success">added in version {{f.version}}</span>
            <div v-if="f.with_types && showWithTypes">
              <span class="has-text-weight-bold">Only available with types:</span><br>
              <span class="">{{ f.with_types }}</span>
            </div>
          
          </td>
          <td v-if="hasDefaults">
            <div class="" v-if="f.choices">
              <span class="has-text-weight-bold">Choices:</span><br>
              <ul>
                <li v-for="c in f.choices" :key="c.name">
                  <span :title="c.description" v-if="c.name==f.default" class="has-text-info">{{ c.name }} (default)</span>
                  <span :title="c.description" v-else>{{ c.name }}</span>
                </li>
              </ul>
            </div>                      
            <div v-else-if="f.default!=undefined">
              <span class="has-text-weight-bold">Default:</span><br>
              <span class="">{{ f.default }}</span>
            </div>                      
          </td>
          <td>
            <p>
              <strong v-html="highlight(f.short)"></strong><br>
              <router-link v-if="f.objectLink" :to="'/reference-guide/'+f.objectLink"><span class="icon"><font-awesome-icon icon="link" size="xs" /></span><span>{{ f.allowed }}</span></router-link>
              <span v-else-if="f.allowed" class="has-text-primary">{{ f.allowed }}</span>
            </p>
            <p>
              <VueShowdown :markdown="highlight(f.description)" flavor="github" :options="{ghCodeBlocks:true}" />
            </p>
            <div class="notification" v-for="c in f.changelog" :key="c.type+c.version">
              <div class="tags has-addons mb-1" v-if="c.type=='added'">
                <span class="tag is-dark">Added</span>
                <span class="tag is-success">{{ c.version }}</span>
              </div>
              <VueShowdown :markdown="c.description" flavor="github" :options="{ghCodeBlocks:true}" />
            </div>
            <p v-if="f.examples" class="has-text-weight-bold">
              Examples:
            </p>
            <div v-for="e,i in f.examples" :key="e.name">
              <p class="has-text-weight-bold mt-2">{{ i+1 }}) {{ e.name }}</p>
              <highlight-code
                lang="YAML"
                :code="e.code"
              />
            </div>
            <p v-if="f.moreExamplesLink" class="box has-text-weight-bold" >
                <router-link :to="'/reference-guide/'+f.moreExamplesLink"><span class="icon mr-2"><font-awesome-icon icon="lightbulb" size="xs" /></span><span>Find more info and examples here</span></router-link>
            </p>            
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
<script>
  import Vue from 'vue'
  import BulmaInput from './../components/BulmaInput.vue'
  export default{
    name:"BulmaHelpTable",
    props:['help','itemName','showWithTypes'],
    components:{BulmaInput},
    computed:{
      filteredItems(){
        return this.help?.filter(x => (x.name?.toLowerCase().includes(this.search.toLowerCase()) || 
            x.description?.toLowerCase().includes(this.search.toLowerCase()) ||
            x.short?.toLowerCase().includes(this.search.toLowerCase()) 
        ))
      },
      hasDefaults(){
        return this.filteredItems?.filter(x => x.default || x.choices)?.length>0
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
        if(this.search){
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
