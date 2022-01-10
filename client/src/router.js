import Vue from 'vue'
import Router from 'vue-router'
import Forms from './views/Forms.vue'
import Form from './views/Form.vue'
import Login from './views/Login.vue'
import ErrorVue from './views/Error.vue'
import Schema from './views/Schema.vue'
import Groups from './views/Groups.vue'
import Users from './views/Users.vue'
import Ldap from './views/Ldap.vue'
import Awx from './views/Awx.vue'
import Designer from './views/Designer.vue'
import Credentials from './views/Credentials.vue'
import Jobs from './views/Jobs.vue'
import Profile from './views/Profile.vue'

Vue.use(Router);
export default new Router({
  linkExactActiveClass: 'is-active',
  routes: [
      {
        path:"/",
        name:"Home",
        component:Forms
      },
      {
        path:"/form",
        name:"Form",
        component:Form
      },
      {
        path:"/login",
        name:"Login",
        component:Login
      },
      {
        path:"/profile",
        name:"Profile",
        component:Profile
      },
      {
        path:"/error",
        name:"Error",
        component:ErrorVue
      },
      {
        path:"/schema",
        name:"Schema",
        component:Schema
      },
      {
        path:"/groups",
        name:"Groups",
        component:Groups
      },
      {
        path:"/users",
        name:"Users",
        component:Users
      },
      {
        path:"/ldap",
        name:"Ldap",
        component:Ldap
      },
      {
        path:"/awx",
        name:"Awx",
        component:Awx
      },
      {
        path:"/credentials",
        name:"Credentials",
        component:Credentials
      },
      {
        path:"/designer",
        name:"Designer",
        component:Designer
      },
      {
        path:"/jobs",
        name:"JobLogs",
        component:Jobs
      }
  ]
})
