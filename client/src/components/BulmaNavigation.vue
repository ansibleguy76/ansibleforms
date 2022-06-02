<template>
  <nav v-if="dataList.length>perPage" class="pagination" role="pagination" aria-label="pagination">
    <a class="pagination-previous" v-if="page != 1" @click="setPage(page-1)">Previous</a>
    <a class="pagination-next" @click="setPage(page+1)" v-if="page < pages.length">Next page</a>
    <ul class="pagination-list">
      <li>
        <a class="pagination-link" v-if="showFirstPage" :class="{'is-current':1==page}" @click="setPage(1)" aria-label="Goto page 1">1</a>
      </li>
      <li>
        <span class="pagination-ellipsis" v-if="showFirstEllipsis">&hellip;</span>
      </li>
      <li v-for="pageNumber in displayedPages" :key="pageNumber">
        <a class="pagination-link" :class="{'is-current':pageNumber==page}" @click="setPage(pageNumber)" :aria-label="'Goto page '+pageNumber">{{pageNumber}}</a>
      </li>
      <li>
        <span class="pagination-ellipsis" v-if="showLastEllipsis">&hellip;</span>
      </li>
      <li>
        <a class="pagination-link" v-if="showLastPage" :class="{'is-current':page==(pages.length)}" @click="setPage(pages.length)" :aria-label="'Goto page '+pages.length">{{pages.length}}</a>
      </li>
    </ul>
  </nav>
</template>
<script>
  import Vue from 'vue'
  export default{
    name:"BulmaNavigation",
    components:  {},
    props:{
      dataList:{type:Array},
      perPage:{type:Number},
      buttonsShown:{type:Number},
      index:{type:Number}
    },
    data(){
      return  {
        page:1
      }
    },methods:{
      setPage(page){
        this.page=page
        this.change()
      },
      paginate (list) {
        let page = this.page;
        let perPage = this.perPage;
        let from = (page * perPage) - perPage;
        let to = (page * perPage);
        return  list.slice(from, to);
      },
      change(){
        this.$emit('change',this.displayedItems)
      }
    },
    watch: {
      displayedItems() {
        this.$emit('change',this.displayedItems)
      }
    },
    computed:{
      displayedItems () {
          return this.paginate(this.dataList);
      },
      displayedPages(){
        var from=this.page-1 // from the first
        if(from==0)from=1     // force on first
        var to = this.page+this.buttonsShown
        // for x from the last
        if(this.page>=this.pages.length-this.buttonsShown){
          from=this.pages.length-this.buttonsShown-1
        }
        // make sure the have the right amount of buttons
        if((to-from)!=this.buttonsShown)to=this.buttonsShown+from
        // if all can be show, show all - otherwise a subset
        if(this.buttonsShown>=this.pages.length){
          return this.pages
        }else{
          return this.pages.slice(from, to)
        }
      },
      showFirstPage(){
        return !(this.displayedPages.includes(1))
      },
      showLastPage(){
        return !(this.displayedPages.includes(this.pages.length))
      },
      showFirstEllipsis(){
        return (this.page>2 && this.pages.length>=2 && !this.displayedPages.includes(2))
      },
      showLastEllipsis(){
        return (!this.displayedPages.includes(this.pages.length-1) && this.page<(this.pages.length-1))
      },
      pages () {
        let numberOfPages = Math.ceil(this.dataList.length / this.perPage);
        return Array.from(Array(numberOfPages), (_,x) => x+1);
      },
      pageByIndex(){
        if(!(this.index>0))return 1
        var x = this.index/this.perPage
        return Math.floor(x+1)
      },
    },
    mounted(){
      this.page=this.pageByIndex
      this.change()
    }
  }
</script>
<style scoped>
</style>
