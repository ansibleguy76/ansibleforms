// Routes

// Composables
import { createRouter, createWebHistory } from 'vue-router/auto'

import designer from "@/pages/designer.vue"
import index from "@/pages/index.vue"
import form from "@/pages/form.vue"
import login from "@/pages/login.vue"
import logout from "@/pages/logout.vue"
import logs from "@/pages/logs.vue"
import jobs from "@/pages/jobs.vue"
import apidocs from "@/pages/api-docs.vue"
import unknown from "@/pages/unknown.vue"
import changePassword from "@/pages/change-password.vue"  

// admin
import aap from "@/pages/admin/aap.vue"
import credentials from "@/pages/admin/credentials.vue"
import entraId from "@/pages/admin/entraId.vue"
import groups from "@/pages/admin/groups.vue"
import knownHosts from "@/pages/admin/knownHosts.vue"
import ldap from "@/pages/admin/ldap.vue"
import mailSettings from "@/pages/admin/mailSettings.vue"
import openId from "@/pages/admin/openId.vue"
import repositories from "@/pages/admin/repositories.vue"
import dataSchemas from "@/pages/admin/dataSchemas.vue"
import datasources from "@/pages/admin/datasources.vue"
import schedules from "@/pages/admin/schedules.vue"
import settings from "@/pages/admin/settings.vue"
import ssh from "@/pages/admin/ssh.vue"
import users from "@/pages/admin/users.vue"
import backups from "@/pages/admin/backups.vue"

import TokenStorage from '@/lib/TokenStorage.js'

// checkDesigner
const checkDesigner=(to, from, next) => {
  var payload = TokenStorage.getPayload()
  if(payload?.user?.options?.showDesigner ?? payload?.user?.roles?.includes("admin")){
    next()
  }else{
    console.log("You don't have access to the designer")
  }
}
// checkLogs
const checkLogs=(to, from, next) => {
  var payload = TokenStorage.getPayload()
  if(payload?.user?.options?.showLogs ?? payload?.user?.roles?.includes("admin")){
    next()
  }else{
    console.log("You don't have access to the logs")
  }
}
// checkJobs
const checkJobs=(to, from, next) => {
  var payload = TokenStorage.getPayload()
  if(payload?.user?.options?.showJobs ?? true){
    next()
  }else{
    console.log("You don't have access to the jobs")
  }
}
// checkSettings
const checkSettings=(to, from, next) => {
  var payload = TokenStorage.getPayload()
  if(payload?.user?.options?.showSettings ?? payload?.user?.roles?.includes("admin")){
    next()
  }else{
    console.log("You don't have access to the settings")
  }
}
// allowBackupOps
const allowBackupOps=(to, from, next) => {
  var payload = TokenStorage.getPayload()
  if(payload?.user?.options?.allowBackupOps ?? payload?.user?.roles?.includes("admin")){
    next()
  }else{
    console.log("You don't have access to the backups page")
  }
}



const routes = [

  // root routes
  { path: '/', name:"/", component: index },
  { path: '/designer', name:"/designer", component: designer, beforeEnter: checkDesigner },
  { path: '/form', name: "/form", component: form },
  { path: '/login', name: "/login", component: login },
  { path: '/change-password', name: "/change-password", component: changePassword },
  { path: '/logout', name: "/logout", component: logout },
  { path: '/jobs', name: "/jobs", component: jobs, beforeEnter: checkJobs },
  { path: "/jobs/:id", name: "/jobs/:id", component: jobs, beforeEnter: checkJobs },
  { path: '/logs', name: "/logs", component: logs, beforeEnter: checkLogs },
  { path: '/api-docs', name: "/api-docs", component: apidocs },
  { path: '/:pathMatch(.*)*', name: "/unknown", component: unknown },

  // admin routes
  { path: '/admin/aap', name: "/admin/aap", component: aap, beforeEnter: checkSettings },
  { path: '/admin/credentials', name: "/admin/credentials", component: credentials, beforeEnter: checkSettings },
  { path: '/admin/entraId', name: "/admin/entraId", component: entraId, beforeEnter: checkSettings },
  { path: '/admin/groups', name: "/admin/groups", component: groups, beforeEnter: checkSettings },
  { path: '/admin/knownHosts', name: "/admin/knownHosts", component: knownHosts, beforeEnter: checkSettings },
  { path: '/admin/ldap', name: "/admin/ldap", component: ldap, beforeEnter: checkSettings },
  { path: '/admin/mailSettings', name: "/admin/mailSettings", component: mailSettings, beforeEnter: checkSettings },
  { path: '/admin/openId', name: "/admin/openId", component: openId, beforeEnter: checkSettings },
  { path: '/admin/repositories', name: "/admin/repositories", component: repositories, beforeEnter: checkSettings },
  { path: '/admin/dataSchemas', name: "/admin/dataSchemas", component: dataSchemas, beforeEnter: checkSettings },
  { path: '/admin/datasources', name: "/admin/datasources", component: datasources, beforeEnter: checkSettings },
  { path: '/admin/schedules', name: "/admin/schedules", component: schedules, beforeEnter: checkSettings },
  { path: '/admin/settings', name: "/admin/settings", component: settings, beforeEnter: checkSettings },
  { path: '/admin/ssh', name: "/admin/ssh", component: ssh, beforeEnter: checkSettings },
  { path: '/admin/users', name: "/admin/users", component: users, beforeEnter: checkSettings },
  { path: '/admin/backups', name: "/admin/backups", component: backups, beforeEnter: allowBackupOps },

]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
