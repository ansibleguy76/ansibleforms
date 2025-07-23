<script setup>

    /****************************************************/
    /*                                                  */
    /*  Bootstrap Pagination Component                  */
    /*                                                  */
    /*  @props:                                         */
    /*      dataList: Array - List of items to paginate  */
    /*      perPage: Number - Items per page             */
    /*      buttonsShown: Number - Number of buttons     */
    /*      index: Number - Index of the item to show    */
    /*                                                  */
    /*  @emit:                                          */
    /*      change: Array - List of items to show        */
    /*                                                  */
    /****************************************************/

    import { watch, ref } from 'vue';

    // INIT

    const emit = defineEmits(['change']);

    // PROPS

    const props = defineProps({
        dataList:{type:Array},
        buttonsShown:{type:Number},
        index:{type:Number}
    });

    // DATA

    const page = ref(0)
    const perPage = ref(10)

    // METHODS

    function setPage(p){
        page.value=p
        change()
    }
    function paginate (list) {
        let from = (page.value * perPage.value) - perPage.value;
        let to = (page.value * perPage.value);
        return  list.slice(from, to);
    }
    function change(){
        emit('change',displayedItems.value)
    }

    // COMPUTED

    const displayedItems = computed(() => {
        return paginate(props.dataList);
    });

    const displayedPages = computed(() => {
        var result
        let from = page.value - 1;
        if(from == 0) from = 1;
        let to = page.value + props.buttonsShown;
        if(page.value >= pages.value.length - props.buttonsShown){
            from = pages.value.length - props.buttonsShown - 1;
        }
        if((to - from) != props.buttonsShown) to = props.buttonsShown + from;
        
        if(props.buttonsShown >= pages.value.length){
            result = pages.value;
            
        }else{
            result = pages.value.slice(from, to);
        }
        return result;
    });

    const showFirstPage = computed(() => {
        return !displayedPages.value.includes(1);
    });

    const showLastPage = computed(() => {
        return !displayedPages.value.includes(pages.value.length);
    });

    const showFirstEllipsis = computed(() => {
        return (page.value > 2 && pages.value.length >= 2 && !displayedPages.value.includes(2));
    });

    const showLastEllipsis = computed(() => {
        return (!displayedPages.value.includes(pages.value.length - 1) && page.value < (pages.value.length - 1));
    });

    const pages = computed(() => {
        let numberOfPages = Math.ceil(props.dataList.length / perPage.value);
        return Array.from(Array(numberOfPages), (_, x) => x + 1);
    });

    const pageByIndex = computed(() => {
        if(!(props.index > 0)) return 1;
        let x = props.index / perPage.value;
        return Math.floor(x + 1);
    });

    // WATCHERS
   
    watch(displayedItems,()=>{
        change()
    })    

    // EVENTS

    onMounted(()=>{
        page.value=pageByIndex
        setPage(1)
    })
</script>
<template>
    <nav aria-label="Job pagination">

        <ul class="pagination justify-content-end user-select-none">
            <li class="me-2">
                <select class="form-select" v-model="perPage">
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                </select>        
            </li>
            <li role="button" class="page-item" :class="{'disabled':page <= 1}">
                <a class="page-link" @click="setPage(page-1)">Previous</a>
            </li>
            <li role="button" class="page-item" :class="{'active':1==page}">
            <a class="page-link" v-if="showFirstPage"  @click="setPage(1)" aria-label="Goto page 1">1</a>
            </li>
            <li class="page-item" v-if="showFirstEllipsis">
            <span class="page-link" >&hellip;</span>
            </li>
            <li role="button" class="page-item" :class="{'active':pageNumber==page}" v-for="pageNumber in displayedPages" :key="pageNumber">
            <a class="page-link" @click="setPage(pageNumber)" :aria-label="'Goto page '+pageNumber">{{pageNumber}}</a>
            </li>
            <li class="page-item" v-if="showLastEllipsis">
            <span class="page-link" >&hellip;</span>
            </li>
            <li role="button" class="page-item" :class="{'active':page==(pages.length)}">
            <a class="page-link" v-if="showLastPage" @click="setPage(pages.length)" :aria-label="'Goto page '+pages.length">{{pages.length}}</a>
            </li>
            <li role="button" class="page-item" :class="{'disabled':page >= pages.length}">
                <a class="page-link" @click="setPage(page+1)">Next</a>
            </li>
        </ul>
    </nav>    

</template>