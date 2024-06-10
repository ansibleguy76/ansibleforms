<template>
  <section v-if="isAdmin" class="section">
    <BulmaModal v-if="showDelete" title="Delete" action="Delete" @click="removeHost();showDelete=false" @close="showDelete=false" @cancel="showDelete=false">Are you sure you want to delete knownhostssitory '{{ knownhostsItem}}'</BulmaModal>
    <div class="container">
      <h1 class="title has-text-info"><font-awesome-icon :icon="['fab','git-square']" /> Known Hosts</h1>
      <div class="columns">
        <div class="column is-narrow">
          <BulmaSettingsMenu />
        </div>
        <div class="column">    
          <div class="columns">
            <div class="column" v-if="unique && unique.length>0">
              <BulmaAdminTable
                :dataList="unique"
                :labels="['Host Entry']"
                :columns="['']"
                identifier=""
                :actions="[{name:'select',title:'show entry',icon:'info-circle',color:'has-text-link'},{name:'remove',title:'remove knownhostssitory',icon:'times',color:'has-text-danger'}]"
                :currentItem="knownhostsItem"
                @select="selectItem"
                @remove="removeItem"
              />
            </div>
            <transition name="add-column" appear>
              <div class="column" v-if="!showDelete">
                <BulmaInput icon="server" v-model="host" label="Known hosts" placeholder="github.com,bitbucket.com,172.16.0.1,..." :required="true" :hasError="$v.host.$invalid" :errors="[]" />
                <BulmaButton v-if="!loading" icon="server" label="Add to known hosts" @click="addHost()"></BulmaButton>
              </div>
            </transition>
          </div>
          <div v-if="knownhostsItem" class="notification enable-line-break">
            {{ knownhostsItem }}
          </div>
          <div v-if="doubles" class="notification is-info">
            {{ doubles }} lines removed from view (doubles or empty)
          </div>          
        </div>
      </div>
    </div>
  </section>
</template>
<script>
  import Vue from 'vue'
  import axios from 'axios'
  import Vuelidate from 'vuelidate'
  import BulmaButton from '../components/BulmaButton.vue'
  import BulmaInput from '../components/BulmaInput.vue'
  import BulmaAdminTable from '../components/BulmaAdminTable.vue'
  import BulmaModal from '../components/BulmaModal.vue'
  import _ from 'lodash'
  import BulmaSettingsMenu from '../components/BulmaSettingsMenu.vue'
  import TokenStorage from '../lib/TokenStorage'
  import { required, email, minValue,maxValue,minLength,maxLength,helpers,requiredIf,sameAs } from 'vuelidate/lib/validators'
  const gitclone = helpers.regex("gitclone",/^git clone --quiet .+$/g)
  Vue.use(Vuelidate)

  export default{
    name: "AfKnownHosts",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    components:{BulmaButton,BulmaInput,BulmaModal,BulmaAdminTable,BulmaSettingsMenu},
    data(){
      return  {
          loading:false,
          showDelete:false,
          host:"",
          knownhostsItem:undefined,
          knownHostsList:[],
          alert:{
            timeout:undefined,
            message:"",
            type:""
          },
          knownhostsStatus:""
        }
    },
    computed:{
      unique(){
        return _.compact(_.uniq(this.knownHostsList))
      },
      doubles(){
        return this.knownHostsList.length-this.unique.length
      }
    },
    methods:{
      loadAll(){
        this.loadKnownHostsList();
      },loadKnownHostsList(){
        var ref= this;
        axios.get(`${process.env.BASE_URL}api/v1/knownHosts/`,TokenStorage.getAuthentication())
          .then((result)=>{
            if(result.data.status=="error"){
              ref.$toast.error(result.data.message);
            }else{
              ref.knownHostsList=result.data.data.output;
            }
          }),function(err){
            ref.$toast.error(err.toString());
          };
      },
      reset(){
        this.knownhostsItem=undefined
        this.host=""
      },
      selectItem(value){
        this.knownhostsItem=value
        //this.loadHost()
      },
      removeItem(value){
        this.selectItem(value)
        this.showDelete=true
      },
      removeHost(){
        var ref= this;
        axios.delete(`${process.env.BASE_URL}api/v1/knownhosts/?name=${encodeURIComponent(this.knownhostsItem)}`,TokenStorage.getAuthentication())
          .then((result)=>{
            if(result.data.status=="error"){
              ref.$toast.error(result.data.message + ", " + result.data.data.error);
            }else{
              ref.$toast.success("Host is removed");
              ref.knownhostsItem=undefined;
              ref.loadAll();
            }
          }),function(err){
            ref.$toast.error(err.toString());
          };
      },
      addHost(){
        var ref= this;
        if (!this.$v.host.$invalid) {
          this.loading=true
          var host=this.host
          axios.post(`${process.env.BASE_URL}api/v1/knownhosts/`,{host},TokenStorage.getAuthentication())
            .then((result)=>{
              ref.loading=false
              if(result.data.status=="error"){
                ref.$toast.error(result.data.message + ", " + result.data.data.error);
              }else{
                ref.reset()
                ref.$toast.success("Added host");
                ref.loadAll();
              }
            }),function(err){
              ref.loading=false
              ref.$toast.error(err.toString());
            };
        }
      },
      showAlert(type,message){
          var ref=this;
          this.alert.message=message;
          if(type){
            this.alert.type=type
          }else{
            this.alert.type="is-info"
          }
          clearTimeout(this.alert.timeout)
          this.alert.timeout = setTimeout(function(){ref.alert.message=""}, 5000);
      }
    },
    validations: {
      host:{
        required
      }
    },
    mounted() { // when the Vue app is booted up, this is run automatically.
        this.loadAll();
    }
  }
</script>
<style scoped>
  .cursor-progress{
    cursor:progress;
  }
  .is-text-overflow {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width:100%;
  }
  .enable-line-break {
      white-space: pre-wrap;
      overflow-wrap: break-word;
      max-width:50vw;
  }
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
  .add-column-enter-to, .add-column-leave {
    opacity: 1;
  }
  .add-column-enter, .add-column-leave-to {
    overflow: hidden;
    opacity: 0;
  }
  .add-column-enter-active > div {
    transition: all 0.5s;
  }
  .add-column-enter-active {
    overflow: hidden;
    transition: all 0.5s;
  }
  .add-column-leave-active {
    overflow: hidden;
    transition: all 0.5s;
  }
  .add-column-leave-active > div {
    transition: all 0.5s;
  }
  .add-column-leave-to > div {
    width: 0;
  }
</style>
