<template>
  <section class="section has-background-light">
    <div class="container">
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
  import Vue from 'vue'
  import Categories from './../components/Categories.vue'
  import Form from './../lib/Form'
  import Forms from './../components/Forms.vue'
  export default{
    components:{Categories,Forms},
    name:"AfForms",
    props:{
    },
    data(){
      return  {
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
</style>
