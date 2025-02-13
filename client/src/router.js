import Vue from 'vue'
import Router from 'vue-router'
import Forms from './views/Forms.vue'
import Form from './views/Form.vue'
import FormReload from './views/FormReload.vue'
import Login from './views/Login.vue'
import ErrorVue from './views/Error.vue'
import Schema from './views/Schema.vue'
import Groups from './views/Groups.vue'
import Repos from './views/Repos.vue'
import Users from './views/Users.vue'
import Ldap from './views/Ldap.vue'
import AzureAd from './views/AzureAd.vue'
import OIDC from './views/OIDC.vue'
import Settings from './views/Settings.vue'
import MailSettings from './views/MailSettings.vue'
import Awx from './views/Awx.vue'
import Designer from './views/Designer.vue'
import Credentials from './views/Credentials.vue'
import Sshkey from './views/Sshkey.vue'
import KnownHosts from './views/KnownHosts.vue'
import Jobs from './views/Jobs.vue'
import Logs from './views/Logs.vue'
import Profile from './views/Profile.vue'
import ReferenceGuide from './views/ReferenceGuide.vue'
import Install from './views/Install.vue'
import TokenStorage from './lib/TokenStorage.js'
Vue.use(Router);

const checkDesigner=(to, from, next) => {
  var payload = TokenStorage.getPayload()
  if(payload?.user?.options?.showDesigner ?? payload?.user?.roles?.includes("admin")){
    next()
  }else{
    console.log("You are not allowed to access designer")
  }
}
const checkLogs=(to, from, next) => {
  var payload = TokenStorage.getPayload()
  if(payload?.user?.options?.showLogs ?? payload?.user?.roles?.includes("admin")){
    next()
  }else{
    console.log("You are not allowed to access logs")
  }
}
const checkSettings=(to, from, next) => {
  var payload = TokenStorage.getPayload()
  if(payload?.user?.options?.showSettings ?? payload?.user?.roles?.includes("admin")){
    next()
  }else{
    console.log("You are not allowed to access settings")
  }
}

export default new Router({
  base: process.env.BASE_URL, // automatically append base url to routes
  linkExactActiveClass: 'is-active',
  scrollBehavior (to, from, savedPosition) {
    if (to && to.hash) {
      return {
          selector: to.hash,
          offset: { x: 0, y: 80 }, // avoid blocking the view when having fixed components
          behavior: 'smooth'
      };
    } else if (savedPosition) {
        return savedPosition;
    } else {
        return { x: 0, y: 0 };
    }
  },
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
        path: '/form-reload',
        component:FormReload
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
        path:"/install",
        name:"Install",
        component:Install
      },      
      {
        path:"/reference-guide",
        name:"Reference Guide Home",
        component:ReferenceGuide
      },
      {
        path:"/reference-guide/:section",
        name:"Reference Guide Section",
        component:ReferenceGuide
      },  
      {
        path:"/reference-guide/:section/:page",
        name:"Reference Guide Page",
        component:ReferenceGuide
      },     
      {
        path:"/reference-guide/:section/:page/:sub",
        name:"Reference Guide Sub",
        component:ReferenceGuide
      },   
      {
        path:"/reference-guide/:section/:page/:sub/:item",
        name:"Reference Guide Item",
        component:ReferenceGuide
      },                                 
      {
        path:"/groups",
        name:"Groups",
        component:Groups,
        beforeEnter: checkSettings
      },
      {
        path:"/repos",
        name:"Repos",
        component:Repos,
        beforeEnter: checkSettings
      },
      {
        path:"/users",
        name:"Users",
        component:Users,
        beforeEnter: checkSettings
      },
      {
        path:"/ldap",
        name:"Ldap",
        component:Ldap,
        beforeEnter: checkSettings
      },
      {
        path:"/azuread",
        name:"AzureAd",
        component:AzureAd,
        beforeEnter: checkSettings
      },
      {
          path:"/oidc",
          name:"OIDC",
          component:OIDC,
          beforeEnter: checkSettings
      },
      {
        path:"/settings",
        name:"Settings",
        component:Settings,
        beforeEnter: checkSettings
      },        
      {
        path:"/mail_settings",
        name:"Settings Mail",
        component:MailSettings,
        beforeEnter: checkSettings
      },
      {
        path:"/awx",
        name:"Awx",
        component:Awx,
        beforeEnter: checkSettings
      },
      {
        path:"/credentials",
        name:"Credentials",
        component:Credentials,
        beforeEnter: checkSettings
      },
      {
        path:"/sshkey",
        name:"Sshkey",
        component:Sshkey,
        beforeEnter: checkSettings
      },
      {
        path:"/knownhosts",
        name:"KnownHost",
        component:KnownHosts,
        beforeEnter: checkSettings
      },      
      {
        path:"/logs",
        name:"Logs",
        component:Logs,
        beforeEnter: checkLogs
      },
      {
        path:"/designer",
        name:"Designer",
        component:Designer,
        beforeEnter: checkDesigner
      },
      {
        path:"/jobs",
        name:"JobLogs",
        component:Jobs
      },
      {
        path:"/jobs/:id",
        name:"JobLog",
        component:Jobs
      }
  ]
})
