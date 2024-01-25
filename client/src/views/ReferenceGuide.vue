<template>
  <div id="top">
    <section class="section has-background-light">
      <div class="container" v-if="help">
        <div class="columns is-widescreen">
          <div class="column has-background-white p-3">
            
            <!-- Section tabs -->
            <div class="tabs is-medium is-boxed">
              <ul>
                <template v-for="h in help">
                  <li v-if="!h.hideFromReferenceGuide" :key="h.name" :class="{'is-active':links.includes(h.link)}">
                    <router-link :to="'/reference-guide/'+h.link">
                      <span class="icon is-small"><font-awesome-icon :icon="h.icon.split(',')" /></span>
                      <span>{{ h.name }}</span>
                    </router-link>
                  </li>                   
                </template>
              </ul>
            </div>
            
            <!-- Section help link (forms.yaml, category, ...) -->
            <nav class="navbar is-link" v-if="sectionSubsHelp && sectionSubsHelp.length>1">
              <div id="navbarSection" class="navbar-menu">
                <div class="navbar-start">
                  <template v-for="h in sectionSubsHelp">
                    <router-link :key="h.name" class="navbar-item" :class="{'is-active':links==h.link}" :to="'/reference-guide/'+h.link">
                      <span class="icon is-small mr-2"><font-awesome-icon :icon="h.icon.split(',')" /></span>
                      <span>{{ h.name }}</span>
                    </router-link>
                  </template>
                </div>
              </div>
            </nav>    
            
            <!-- Page help links (form, formfield, ...)-->
            <nav class="navbar is-info" v-if="pageHelp && pageSubsHelp.length>1">
              <div id="navbarPage" class="navbar-menu">
                <div class="navbar-start">
                  <template v-for="h in pageSubsHelp">
                    <router-link :key="h.name" class="navbar-item" :class="{'is-active':links==h.link}" :to="'/reference-guide/'+h.link">
                      <span class="icon is-small mr-2"><font-awesome-icon :icon="h.icon.split(',')" /></span>
                      <span>{{ h.name }}</span>
                    </router-link>
                  </template>
                </div>
              </div>
            </nav>  
            
            <!-- Sub help links (formfield, tablefield, ...)-->
            <nav class="navbar is-light" v-if="subHelp && subSubsHelp.length>1">
              <div id="navbarSub" class="navbar-menu">
                <div class="navbar-start">
                  <template v-for="h in subSubsHelp">
                    <router-link :key="h.name" class="navbar-item" :class="{'is-active':links==h.link}" :to="'/reference-guide/'+h.link">
                      <span class="icon is-small mr-2"><font-awesome-icon :icon="h.icon.split(',')" /></span>
                      <span>{{ h.name }}</span>
                    </router-link>
                  </template>
                </div>
              </div>
            </nav>  
            
            <!-- Help page -->
            <div class="content m-4 py-5">
              
              <!-- title -->
              <h1 class="title">{{ currentHelp.name }}</h1>
              
              <!-- description -->
              <VueShowdown class="mb-5" :markdown="currentHelp.description" flavor="github" :options="{ghCodeBlocks:true}" />
              
              <!-- examples link -->
              <p v-if="currentHelp.items">
              <router-link v-if="currentHelp.examples" :to="{path:$route.path, hash:'#examples'}"><span class="icon mr-2" size="xs"><font-awesome-icon icon="star" /></span><span>Examples</span></router-link><br>
              <router-link :to="{path:$route.path, hash:'#properties'}"><span class="icon mr-2" size="xs"><font-awesome-icon icon="wrench" /></span><span>All properties</span></router-link><br>
              </p>
              <!-- type links -->
              <div v-if="types" class="mb-5">
                <p id="types" class="has-text-weight-bold">{{ currentHelp.name }} types</p>
                <table class="table is-bordered is-narrow is-striped">
                  <thead>
                    <tr class="has-text-weight-bold">
                      <td>Type</td>
                      <td>Description</td>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="t in types" :key="t.name">
                      <td>
                        <router-link :to="{path:$route.path, hash:'#'+t.name}"><strong>{{ t.name }}</strong></router-link>
                      </td>
                      <td>
                        <VueShowdown :markdown="t.description" flavor="github" :options="{ghCodeBlocks:true}" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- type properties tables -->
              <div>
              <template v-if="types">
                <div v-for="t in types" :key="t.name" class="mt-3">
                  <h2 class="mytype subtitle is-capitalized is-underlined has-text-primary" :id="t.name">{{ t.name }} {{ help.name }}</h2>
                  <div v-if="t.version" class="field is-grouped is-grouped-multiline">
                    <div class="control">
                      <div class="tags has-addons">
                        <span class="tag is-dark">version</span>
                        <span class="tag is-info">{{t.version}}</span>
                      </div>
                    </div>
                  </div>
                  <VueShowdown class="mb-5" :markdown="t.description" flavor="github" :options="{ghCodeBlocks:true}" />
                  <VueShowdown v-if="t.extra" class="mb-5" :markdown="t.extra" flavor="github" :options="{ghCodeBlocks:true}" />
                  <p v-if="related(t.name).length>0">The following properties are related to {{ currentHelp.name }} {{ t.name }}</p>  
                  <BulmaHelpTable :help="related(t.name)" :itemName="currentHelp.itemName" :showWithTypes="false" />
                  <!-- examples -->
                  <p class="mt-5 has-text-weight-bold" v-if="t.examples">Examples</p>
                  <div v-for="e,i in t.examples" :key="e.name">
                    <p class="has-text-link mt-2">{{ i+1 }}) {{ e.name }}</p>
                    <highlight-code
                      lang="YAML"
                      :code="e.code"
                    />
                  </div>      
                  <p v-if="t.moreExamplesLink" class="has-text-warning" >
                      <router-link :to="'/reference-guide/'+t.moreExamplesLink">Find more info and examples here</router-link>
                  </p>                          
                </div>
              </template>

              <!-- main properties table -->
                <div v-if="currentHelp.items">
                  <h2 id="properties" class="subtitle is-capitalized is-underlined has-text-danger">All Properties</h2>
                  <BulmaHelpTable :help="currentHelp.items" :itemName="currentHelp.itemName" :showWithTypes="true"/>
                </div>
              </div>
              <!-- examples -->
              <h2 id="examples" class="subtitle" v-if="currentHelp.examples && currentHelp.items">More Examples</h2>
              <BulmaExampleTable :examples="currentHelp.examples" />
              <p v-if="currentHelp.moreExamplesLink" class="has-text-warning" >
                  <router-link :to="'/reference-guide/'+currentHelp.moreExamplesLink">Find more info and examples here</router-link>
              </p>              
            </div>              
          </div>
          <div v-if="types" class="column is-one-fifth">
            <aside class="menu">
              <h2 class="subtitle">On this page</h2>
              <p class="menu-label">
                Types
              </p>
              <ul class="menu-list">
                <li v-for="t in types" :key="t.name">
                   <router-link :to="{path:$route.path, hash:'#'+t.name}">{{ t.name }}</router-link>                 
                </li>
              </ul>
              <p class="menu-label">
                All
              </p>
              <ul class="menu-list">
                <li>
                   <router-link :to="{path:$route.path, hash:'#properties'}">All Properties</router-link>                 
                </li>
              </ul>              
            </aside>            
          </div>
        </div>
      </div>
    </section>
    <!-- back to top scroll -->
    <transition name="fade" appear>
        <div id="pagetop" class="float-right-bottom is-clickable has-text-primary" v-show="scY > 300" @click="toTop">
          <font-awesome-icon icon="circle-chevron-up" size="4x" />
        </div>
    </transition>      
  </div>
</template>
<script>
  import Vue from 'vue'
  import axios from 'axios'
  import TokenStorage from './../lib/TokenStorage'
  import BulmaHelpTable from './../components/BulmaHelpTable.vue'
  import BulmaExampleTable from './../components/BulmaExampleTable.vue'
  import 'highlight.js/styles/agate.css'
  import VueHighlightJS from 'vue-highlight.js';
  //import 'highlight.js/styles/default.css';
  // import javascript from 'highlight.js/lib/languages/javascript';
  import 'vue-highlight.js/lib/allLanguages'
  // import yaml from 'highlight.js/lib/languages/yaml';
  import VueShowDown from 'vue-showdown'
  Vue.use(VueShowDown)
  // Vue.use(VueHighlightJS, {
  //   // Register only languages that you want
  //     languages: {
  //       yaml,
  //       javascript
  //     }
  //   });
  Vue.use(VueHighlightJS,{auto: true});

  export default{
    components:{BulmaHelpTable,BulmaExampleTable},
    name:"ReferenceGuide",
    props:{
    },
    data(){
      return  {
        help:undefined,
        scTimer: 0,
        scY: 0,           
      }
    },
    computed: {
      sectionHelp(){
        return this.help?.filter(x => this.links.includes(x.link)) || []
      },
      sectionSubsHelp(){
        var parent = this.sectionHelp
        if(parent.length>0){
           var subs=parent[0]?.help || []
          return [...parent,...subs]
        }
        return []
      },
      pageHelp(){
        var sectionHelp = this.sectionHelp
        if(sectionHelp.length>0){
          return sectionHelp[0].help?.filter(x => this.links.includes(x.link)) || []
        }
        return []
      },     
      pageSubsHelp(){
        var parent = this.pageHelp
        if(parent.length>0){
          var subs=parent[0]?.help || []
          return [...parent,...subs]
        }
        return []
      },   
      subHelp(){
        var pageHelp = this.pageHelp
        if(pageHelp.length>0){
          return pageHelp[0].help?.filter(x => this.links.includes(x.link)) || []
        }
        return []
      },     
      subSubsHelp(){
        var parent = this.subHelp
        if(parent.length>0){
          var subs=parent[0]?.help || []
          return [...parent,...subs]
        }
        return []
      },    
      types(){
        var i = this.currentHelp?.items?.filter(x => x.name == "type") || []
        if(i.length>0)return i[0].choices
        else return undefined
      },              
      currentHelp(){
        if(this.links.includes('types'))return undefined
        if(this.level==1){
          return this.help?.filter(x => this.links==x.link)[0] || undefined
        }
        if(this.level==2){
          return this.sectionSubsHelp?.filter(x => this.links==x.link)[0] || undefined
        }
        if(this.level==3){
          return this.pageSubsHelp?.filter(x => this.links==x.link)[0] || undefined
        } 
        if(this.level==4){
          return this.subSubsHelp?.filter(x => this.links==x.link)[0] || undefined
        }                    
        return undefined
      },
      section(){
        return this.$route.params.section || this.help[0].name
      },
      page(){
        return this.$route.params.page || this.section
      },
      sub(){
        return this.$route.params.sub || this.page
      },
      item(){
        return this.$route.params.item || this.sub
      },
      level(){
        if(this.item!=this.sub){
          return 4
        }        
        if(this.sub!=this.page){
          return 3
        }
        if(this.page!=this.section){
          return 2
        }
        return 1
      },
      links(){
        return this.$route.path.replace("/reference-guide/","")
      }
    },
    watch: {
    },
    methods:{
      getHelp(){
        var ref=this
        axios.get(`${process.env.BASE_URL}api/v1/help`,TokenStorage.getAuthentication())
          .then((result)=>{
            if(result.data.status=="error"){
              ref.$toast.error(result.data.message)
            }else{
              ref.help=result.data.data.output
            }
            
          }),function(err){
            ref.$toast.error(err.toString());
            ref.help=undefined
          };
      },
      related(type){
        return this.currentHelp?.items?.filter(x => (x.with_types?.includes(type) || false)) || []   
      },       
      handleScroll: function () {
        if (this.scTimer) return;
        this.scTimer = setTimeout(() => {
          this.scY = window.scrollY;
          clearTimeout(this.scTimer);
          this.scTimer = 0;
        }, 100);
      },
      toTop: function () {
        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      },      
    },
    mounted() { // when the Vue app is booted up, this is run automatically.
      this.getHelp(),
      window.addEventListener('scroll', this.handleScroll);
    },
    beforeDestroy(){
      window.addEventListener('scroll', this.handleScroll);
    }
  }
</script>
<style scoped>
  .navbar-menu{
    z-index:500!important;
  }
  .float-right-bottom{
    position:fixed;
    z-index:99999;
    bottom:10px;
    right:10px;
  }
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.5s ease;
  }

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}  
.capitalize{
  text-transform: capitalize;
}
.unstyled{
  list-style:none;
}
.menu {
  position: sticky;
  display: inline-block;
  vertical-align: top;
  max-height: 100vh;
  overflow-y: auto;
  width: 200px;
  top: 0;
  bottom: 0;
  padding: 30px;
}

.content {
  display: inline-block;
}
</style>
