<template>
  <section class="section has-background-light">
    <div class="container">
    <div class="tile is-ancestor">
      <div class="tile is-parent">
        <article class="tile is-child box">
          <Categories :formConfig="formConfig" />
        </article>
      </div>
      <div class="tile is-parent is-9">
        <Forms :formConfig="formConfig" />
      </div>
    </div>
  </div>
  </section>
</template>
<script>
  import Vue from 'vue'
  import Categories from './../components/Categories.vue'
  import Forms from './../components/Forms.vue'
  export default{
    components:{Categories,Forms},
    props:{
      formConfig:{type:[Object,String]}
    },
    data(){
      return  {
          // formConfig:{},                                                        // the form configdata
      }
    },
    computed: {
    },
    watch: {
    },
    methods:{
    },
    mounted() { // when the Vue app is booted up, this is run automatically.
      if(this.formConfig==undefined){
        this.$router.replace({name:"Login"});
      }
    }
  }
</script>
<style scoped>
</style>
