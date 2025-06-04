<template>
  <aside class="menu mr-5">
    <template v-for="group in groups">
      <p :key="'p-'+group" class="menu-label">{{ group }}</p>
      <ul :key="'ul-'+group" class="menu-list">
        <li v-for="m in menulist(group)" :key="m.to">
          <router-link :to="m.to">{{ m.title }}</router-link>
        </li>
      </ul>
    </template>
  </aside>
</template>
<script>
  import _ from 'lodash'
  export default{
    name:"BulmaSettingsMenu",
    props:{
      authenticated:{type:Boolean},
      isAdmin:{type:Boolean}
    },
    computed:{
      groups(){
        return _.uniqBy(this.menu,'group').map(x => x.group)
      }
    },
    data(){
      return  {
        menu:[
          {group:"general",title:"Ansible Forms",to:"/settings"},
          {group:"general",title:"Mail",to:"/mail_settings"},
          {group:"authentication",title:"Groups",to:"/groups"},
          {group:"authentication",title:"Users",to:"/users"},
          {group:"authentication",title:"Ldap",to:"/ldap"},
          {group:"authentication",title:"MS Entra ID",to:"/azuread"},
          {group:"authentication",title:"Open ID Connect",to:"/oidc"},
          {group:"connection",title:"Credentials",to:"/credentials"},
          {group:"connection",title:"Ssh",to:"/sshkey"},
          {group:"connection",title:"Known Hosts",to:"/knownhosts"},
          {group:"connection",title:"AWX",to:"/awx"},
          {group:"connection",title:"Repositories",to:"/repos"},
          {group:"datasource",title:"Data Schemas",to:"/datasourceSchemas"},
          {group:"datasource",title:"Data Sources",to:"/datasources"},
          {group:"schedule",title:"Schedules",to:"/schedules"},
        ]
      }
    },methods:{
      menulist(group){
        return this.menu.filter(x => x.group==group)
      }
    },mounted(){
    }
  }
</script>
<style scoped>

</style>
