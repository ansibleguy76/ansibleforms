<template>
  <section class="section has-background-light">
    <BulmaQuickView class="quickview" v-if="(formConfig.warnings || formConfig.errors) && showWarnings" title="Form warnings" footer="" @close="showWarnings=false">
          <p v-for="w,i in formConfig.warnings" :key="'warning'+i" class="mb-3" v-html="w"></p>
          <p v-for="w,i in formConfig.errors" :key="'warning'+i" class="mb-3" v-html="w"></p>
    </BulmaQuickView>     
    <div class="container is-fullhd">
      <button v-if="formConfig?.warnings?.length>0 || formConfig?.errors?.length>0" @click="showWarnings=!showWarnings" class="button is-small is-light is-warning mr-3 mb-2">
          <span class="icon">
            <font-awesome-icon icon="exclamation-triangle" />
          </span>
          <span class="mr-1">{{(showWarnings)?'Hide':'This config has'}} Warnings or Errors </span>
      </button>         
      <div class="tile is-ancestor columns">
        <div class="tile is-parent column">
          <article class="tile is-child box">
            <Categories :formConfig="formConfig" />
          </article>
        </div>
        <div class="tile is-parent column is-three-quarters-fullhd is-three-quarters-widescreen is-two-thirds-desktop">
          <Forms :formConfig="formConfig" />
        </div>
      </div>
    </div>
  </section>
</template>
<script>
  import Categories from './../components/Categories.vue'
  import Form from './../lib/Form'
  import Forms from './../components/Forms.vue'
  import BulmaQuickView from '../components/BulmaQuickView.vue'
  export default{
    components:{Categories,Forms,BulmaQuickView},
    name:"AfForms",
    props:{
    },
    data(){
      return  {
          showWarnings:false,                                                // show the warnings
          formConfig:{},                                                        // the form configdata
      }
    },
    computed: {
    },
    watch: {
    },
    methods:{
    },
    mounted() { // when the Vue app is booted up, this is run automatically.
      var ref=this
      Form.getList(function(formConfig){
        ref.formConfig=formConfig
      },function(err){
        ref.$toast.error(err.toString())
        if(ref.$route.name!="Login"){
          ref.$router.replace({name:"Error"}).catch(err => {});
        }
      })
    }
  }
</script>
<style scoped>
.quickview{
  z-index:91000;
}
</style>
