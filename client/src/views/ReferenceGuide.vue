<template>
  <section class="section has-background-light">
    <div class="container" v-if="help">
      <div class="columns is-3 is-variable">
        <div class="column">
          <nav class="panel has-background-white is-primary">
            <p class="panel-heading">
              Repositories
            </p>
            <div class="panel-block">
              <p class="control has-icons-left">
                <input class="input" type="text" placeholder="Search">
                <span class="icon is-left">
                  <i class="fas fa-search" aria-hidden="true"></i>
                </span>
              </p>
            </div>
            <p class="panel-tabs">
              <a class="is-active">All</a>
              <a>Public</a>
              <a>Private</a>
              <a>Sources</a>
              <a>Forks</a>
            </p>
            <a class="panel-block is-active">
              <span class="panel-icon">
                <i class="fas fa-book" aria-hidden="true"></i>
              </span>
              bulma
            </a>
            <a class="panel-block">
              <span class="panel-icon">
                <i class="fas fa-book" aria-hidden="true"></i>
              </span>
              marksheet
            </a>
            <a class="panel-block">
              <span class="panel-icon">
                <i class="fas fa-book" aria-hidden="true"></i>
              </span>
              minireset.css
            </a>
            <a class="panel-block">
              <span class="panel-icon">
                <i class="fas fa-book" aria-hidden="true"></i>
              </span>
              jgthms.github.io
            </a>
            <a class="panel-block">
              <span class="panel-icon">
                <i class="fas fa-code-branch" aria-hidden="true"></i>
              </span>
              daniellowtw/infboard
            </a>
            <a class="panel-block">
              <span class="panel-icon">
                <i class="fas fa-code-branch" aria-hidden="true"></i>
              </span>
              mojs
            </a>
            <label class="panel-block">
              <input type="checkbox">
              remember me
            </label>
            <div class="panel-block">
              <button class="button is-link is-outlined is-fullwidth">
                Reset all filters
              </button>
            </div>
          </nav>
        </div>
        <div class="column is-three-quarters-fullhd is-three-quarters-widescreen is-two-thirds-desktop">
          <div class="has-background-white">

            <div class="tabs is-medium">
              <ul>
                <li class="is-active">
                  <a>
                    <span class="icon is-small"><font-awesome-icon icon="image" /></span>
                    <span>Formfield</span>
                  </a>
                </li>
              </ul>
            </div>
            <div class="content m-4 py-5">
              <h1 class="title">Formfield</h1>
              <VueShowdown :markdown="help.formfield.description" flavor="github" :options="{ghCodeBlocks:true}" />
              <table class="table mt-2 is-bordered is-striped">
                <thead>
                  <tr>
                    <th>Attribute</th>
                    <th>Comments</th>
                  </tr>
                </thead>

                <tbody>
                  <tr v-for="f in help.formfield.attributes" :key="f.name">
                    <td>
                      <span class="has-text-weight-bold">{{f.name}}</span><br>
                      <span class="has-text-primary is-size-7">{{f.type}}</span>
                      <span v-if="f.required" class="has-text-danger is-size-7"> / required</span>
                      <span v-if="f.unique" class="has-text-warning is-size-7"> / unique</span>
                      <br>
                      <span v-if="f.version" class="is-italic has-text-success is-size-7">added in version {{f.version}}</span>
                      <div v-if="f.with_types">
                        <span class="has-text-weight-bold is-size-7">Only available with types:</span><br>
                        <span class="is-size-7">{{ f.with_types }}</span>
                      </div>
                    </td>
                    <td>
                      <p>
                        {{ f.short }}<br>
                        <span class="has-text-primary" v-if="f.allowed">{{ f.allowed }}</span>
                      </p>
                      <p>
                        <VueShowdown :markdown="f.description" flavor="github" :options="{ghCodeBlocks:true}" />
                      </p>
                      <p class="is-size-7" v-if="f.choices">
                        <span class="has-text-weight-bold">Choices:</span><br>
                        <ul>
                          <li v-for="c in f.choices" :key="c">
                            <span v-if="c==f.default" class="has-text-info">{{ c }} (default)</span>
                            <span v-else>{{ c }}</span>
                          </li>
                        </ul>
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
                      <div v-for="e in f.examples" :key="e.name">
                        <p class="has-text-link">{{ e.name }}</p>
                        <highlight-code
                          lang="YAML"
                          :code="e.code"
                        />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
<script>
  import Vue from 'vue'
  import axios from 'axios'
  import TokenStorage from './../lib/TokenStorage'
  // import 'highlight.js/styles/monokai-sublime.css'
  import VueHighlightJS from 'vue-highlight.js';
  import 'highlight.js/styles/default.css';
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
  Vue.use(VueHighlightJS);

  export default{
    components:{},
    name:"ReferenceGuide",
    props:{
    },
    data(){
      return  {
        help:undefined
      }
    },
    computed: {
    },
    watch: {
    },
    methods:{
      getHelp(){
        var ref=this
        axios.get('/api/v1/help',TokenStorage.getAuthentication())
          .then((result)=>{
            ref.help=result.data.data.output
          }),function(error){
            ref.$toast.error(error.message);
            ref.help=undefined
          };
      },
    },
    mounted() { // when the Vue app is booted up, this is run automatically.
      this.getHelp()
    }
  }
</script>
<style scoped>

</style>
