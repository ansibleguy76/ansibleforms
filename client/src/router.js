import Vue from 'vue'
import Router from 'vue-router'
import Forms from './views/Forms.vue'
import Form from './views/Form.vue'
import Login from './views/Login.vue'
import ErrorVue from './views/Error.vue'
import Schema from './views/Schema.vue'
import Groups from './views/Groups.vue'
import Repos from './views/Repos.vue'
import Users from './views/Users.vue'
import Ldap from './views/Ldap.vue'
import Awx from './views/Awx.vue'
import Designer from './views/Designer.vue'
import Credentials from './views/Credentials.vue'
import Sshkey from './views/Sshkey.vue'
import Jobs from './views/Jobs.vue'
import Logs from './views/Logs.vue'
import Profile from './views/Profile.vue'
import TokenStorage from './lib/TokenStorage.js'
Vue.use(Router);
const checkAdmin=(to, from, next) => {
  var payload = TokenStorage.getPayload()
  if(payload.user && payload.user.roles && payload.user.roles.includes("admin")){
    next()
  }else{
    console.log("You are not an admin user")
  }
}

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
        component:Groups,
        beforeEnter: checkAdmin
      },
      {
        path:"/repos",
        name:"Repos",
        component:Repos,
        beforeEnter: checkAdmin
      },
      {
        path:"/users",
        name:"Users",
        component:Users,
        beforeEnter: checkAdmin
      },
      {
        path:"/ldap",
        name:"Ldap",
        component:Ldap,
        beforeEnter: checkAdmin
      },
      {
        path:"/awx",
        name:"Awx",
        component:Awx,
        beforeEnter: checkAdmin
      },
      {
        path:"/credentials",
        name:"Credentials",
        component:Credentials,
        beforeEnter: checkAdmin
      },
      {
        path:"/sshkey",
        name:"Sshkey",
        component:Sshkey,
        beforeEnter: checkAdmin
      },
      {
        path:"/logs",
        name:"Logs",
        component:Logs,
        beforeEnter: checkAdmin
      },
      {
        path:"/designer",
        name:"Designer",
        component:Designer,
        beforeEnter: checkAdmin
      },
      {
        path:"/jobs",
        name:"JobLogs",
        component:Jobs
      }
  ]
})
