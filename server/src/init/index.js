import logger from "../lib/logger.js";
import Ssh from '../models/ssh.model.js';
import Form from '../models/form.model.js';
import Job from '../models/job.model.js';
import Schema from '../models/schema.model.js';
import mysql from "../models/db.model.js";
import Repository from '../models/repository.model.js';
import Datasource from '../models/datasource.model.js';
import Schedule from '../models/schedule.model.js';
import { CronExpressionParser } from "cron-parser";
import dayjs from "dayjs";
import appConfig from "../../config/app.config.js";
import User from "../models/user.model.js";
import Group from "../models/group.model.js";

const init = async function(){


  let adminGroupId = undefined;

  // this is at startup, don't start the app until mysql is ready
  // rewrite with await

  async function sleep(millis) {
    return new Promise(resolve => setTimeout(resolve, millis));
  }
  var MYSQL_IS_READY = false
  while(!MYSQL_IS_READY){
    try{
      logger.info("Waiting for mysql to start")      
      await mysql.do("SELECT 1")
      MYSQL_IS_READY = true
    }catch(e){
      logger.warning("Mysql not ready yet")
      await sleep(5000)
    }
  }

  logger.info("Mysql is ready")

  // check Schema
  try{
    var schemaresult = await Schema.hasSchema()
    if(schemaresult.data.failed.length>0){
      logger.warning("Schema is not up to date")
      for(let i=0;i<schemaresult.data.success.length;i++){
        logger.info(schemaresult.data.success[i])
      }
      for(let i=0;i<schemaresult.data.failed.length;i++){
        logger.error(schemaresult.data.failed[i])
      }
    }else{
      logger.info("Schema is up to date")
      // for(let i=0;i<schemaresult.data.success.length;i++){
      //   logger.info(schemaresult.data.success[i])
      // }      
    }

  }catch(err){
    var result = err.result
    if(result?.data){
      if(result.data.failed.length>0){
        for(let i=0;i<result.data.success.length;i++){
          logger.info(result.data.success[i])
        }
        for(let i=0;i<result.data.failed.length;i++){
          logger.error(result.data.failed[i])
        }
      }
    }else{
      logger.error("Fatal error : " + err)
      throw err
    }

  }

  // check admins groups
  try{
    var adminGroupName = "admins"
    var adminGroup = await Group.findByName(adminGroupName)
    if(adminGroup.length==0){
      logger.warning(`Group ${adminGroupName} not found, creating it`)
      adminGroup = {}
      adminGroup.id = await Group.create(new Group({name:adminGroupName}))
    }else{
      adminGroup = adminGroup[0]
    }
    adminGroupId = adminGroup.id
  }catch(err){
    logger.error("Failed to check/create admins group : " + err)
    throw err
  }

  // check admin user
  logger.info("Checking admin user exists")
  try{
    var adminUsername = appConfig.adminUsername
    var adminUser = await User.findByUsername(adminUsername)
    if(adminUser.length==0){
      logger.warning(`Admin user ${adminUsername} not found, creating it`)
      var adminPassword = appConfig.adminPassword
      await User.create(new User({username:adminUsername,email:'',password:adminPassword,group_id:adminGroupId}))
    }else{
      adminUser = adminUser[0]
    }
  }catch(err){
    logger.error("Failed to check/create admin user : " + err)
    throw err
  }

  // let's check other database records like settings,ldap,awx,oidc and azuread. if no record exists, create them, this is for fresh install
  logger.info("Checking database records")
  const records = {
    azuread:{client_id:'',secret_id:'',enable:0,groupfilter:''},
    oidc:{issuer:'',client_id:'',secret_id:'',enabled:0,groupfilter:''},
    awx:{uri:'',token:'',username:'', password:'',ignore_certs:0,use_credentials:0,ca_bundle:''},
    ldap:{server:'',port:389,ignore_certs:1,enable_tls:0,cert:'',ca_bundle:'',bind_user_dn:'',bind_user_pw:'',search_base:'',username_attribute:'sAMAccountName',groups_attribute:'memberOf',enable:0,is_advanced:0,groups_search_base:'',group_class:'',group_member_attribute:'',group_member_user_attribute:''},    
    settings:{mail_server:'',mail_port:25,mail_secure:0,mail_username:'',mail_password:'',mail_from:'',url:'',forms_yaml:''}    
  }
 
  for(let record in records){
    try{
      var result = await mysql.do(`SELECT * FROM AnsibleForms.${record}`)
      if(result.length==0){
        logger.warning(`No record found for ${record}, creating it`)
        var obj = records[record]
        var keys = Object.keys(obj)
        var values = keys.map((key)=>{return obj[key]})
        var sql = `INSERT INTO AnsibleForms.${record}(${keys.join(",")}) VALUES(${values.map(()=>{return "?"}).join(",")})`
        await mysql.do(sql,values)
      }
    }catch(err){
      logger.error(`Failed to check/create ${record} : ` + err)
      throw err
    }
  }

  logger.info("All database records are checked")

  logger.info("Checking ssh keys")
  Ssh.generate(false)
    .catch((err)=>{
      logger.warning("Failed to generate ssh keys : " + err)
    })

  logger.info("Checking backup folder")
  Form.initBackupFolder()

  logger.info("Checking old jobs")
  Job.abandon(true)
  .then((changed)=>{
    logger.warning(`Abandoned ${changed} jobs`)
  })
  .catch((err)=>{
    logger.error("Failed to abandon jobs : " + err)
  })

  logger.info("Initializing hourly abandoned jobs timer")
  // this is hourly, abandon running jobs older than a day.
  setInterval(()=>{
    Job.abandon()
      .then((changed)=>{
        logger.warning(`Abandoned ${changed} jobs`)
      })
      .catch((err)=>{
        logger.error("Failed to abandon jobs : " + err)
      })
  },3600000)

  logger.info("Pulling repositories")
  mysql.do("SELECT name FROM AnsibleForms.`repositories` WHERE rebase_on_start=1")
  .then((repositories)=>{
    repositories.map((repo)=>{
      logger.info("Pulling " + repo.name)
      Repository.clone(repo.name).catch((e)=>{})
    })
  })
  .catch((e)=>{})

  logger.info("Initializing cron schedules")
  // this is hourly, abandon running jobs older than a day.
  setInterval(async ()=>{

    // find any repositories with cron schedules that need to run
    try{
      const repositories = await mysql.do("SELECT name,cron FROM AnsibleForms.`repositories` WHERE COALESCE(status,'')<>'running' AND cron<>''",undefined,true)
      repositories.map(async (repo)=>{
        try{
          const interval = CronExpressionParser.parse(repo.cron) 
          const next = interval.next().toDate()
          const date = dayjs(next)
          const now = dayjs()
          const minutes = date.diff(now,'m')
          if(minutes==0){
            Repository.pull(repo.name).catch((e)=>{}) // we don't wait for the pull to finish to continue
          }else{
            // logger.debug(`Not time yet, ${minutes} minutes to go`)
          }
        }catch(e){
          logger.error(`Failed to parse cron schedule ${repo.cron}`)
        }       
      })
    }catch(e){} 

    // find any datasources with cron schedules that need to run
    try{
      // datasource cron schedules
      const datasources = await mysql.do("SELECT id,name,cron FROM AnsibleForms.`datasource` WHERE COALESCE(status,'')<>'running' AND COALESCE(status,'')<>'queued' AND cron<>''",undefined,true)
      datasources.map(async(ds)=>{
        try{
          const interval = CronExpressionParser.parse(ds.cron) 
          const next = interval.next().toDate()
          const date = dayjs(next)
          const now = dayjs()
          const minutes = date.diff(now,'m')
          if(minutes==0){
            // time to run
            await Datasource.queue(ds.id)

          }else{
            // logger.debug(`Not time yet, ${minutes} minutes to go`)
          }
        }catch(e){
          logger.error(`Failed to queue datasource`,e)
        }       
      })
    }catch(e){}

    // find any schedules with cron schedules that need to run
    try{
      // schedule cron schedules
      const schedules = await mysql.do("SELECT id,name,cron FROM AnsibleForms.`schedule` WHERE COALESCE(status,'')<>'running' AND COALESCE(status,'')<>'queued' AND cron<>''",undefined,true)
      schedules.map(async(schedule)=>{
        try{
          const interval = CronExpressionParser.parse(schedule.cron) 
          const next = interval.next().toDate()
          const date = dayjs(next)
          const now = dayjs()
          const minutes = date.diff(now,'m')
          if(minutes==0){
            // time to run
            await Schedule.queue(schedule.id)

          }else{
            // logger.debug(`Not time yet, ${minutes} minutes to go`)
          }
        }catch(e){
          logger.error(`Failed to queue schedule`,e)
        }       
      })
    }catch(e){}


  },56000) // run every 55 second, should hit 0 minutes once



  // now we check if there are any datasources that need to be imported, every 10 seconds
  // we only import 1 datasource that is with the lowest queue_id while there are no datasources with status running
  // in the interval, we only import one datasource

  async function checkDatasources() {
    try {
      // logger.info("Checking datasources")
      // check if another one is still running... skip if it is (in theory not possible)
      // but in case 2 instances are running against the same database
      const running = await mysql.do("SELECT id FROM AnsibleForms.`datasource` WHERE state='running'", undefined, true);
      // still running, don't do anything
      if (running.length > 0) {
        logger.error("Datasource is running, skipping, this is not normal, this means 2 instances are running against the same database");
        return;
      }
      // logger.info("No datasource is running, checking for queued datasources")
      const datasources = await mysql.do("SELECT id FROM AnsibleForms.`datasource` WHERE state='queued' ORDER BY queue_id LIMIT 1", undefined, true);
      if (datasources.length > 0) {
        logger.info("Found queued datasource");
        const ds = datasources[0];
        logger.info(`Importing datasource ${ds.id}`);
        try {
          await Datasource.import(ds.id);
        } catch (e) {
          logger.error(`Failed to import datasource ${ds.id} : ` + e);
        }
      }
    } catch (e) {
      logger.error(e);
    } finally {
      // Schedule the next execution
      setTimeout(checkDatasources, 10000);
    }
  }
  
  // Initial call to start the process
  setTimeout(checkDatasources, 10000);

  // just like datasource, be also process schedules, some database layout

  async function checkSchedules(){
    try{
      // logger.info("Checking schedules")
      // check if another one is still running... skip if it is (in theory not possible)
      // but in case 2 instances are running against the same database
      const running = await mysql.do("SELECT id FROM AnsibleForms.`schedule` WHERE state='running'",undefined,true)
      // still running, don't do anything
      if(running.length>0){
        logger.error("Schedule is running, skipping, this is not normal, this means 2 instances are running against the same database")
        return
      }
      // logger.info("No schedule is running, checking for queued schedules")
      const schedules = await mysql.do("SELECT id, name FROM AnsibleForms.`schedule` WHERE state='queued' ORDER BY queue_id LIMIT 1",undefined,true)
      if(schedules.length>0){
        logger.info("Found queued schedule")
        const schedule = schedules[0]
        logger.info(`Importing schedule '${schedule.name}'`)
        try{
          await Schedule.launch(schedule.id)
        }catch(e){
          logger.error(`Failed to launch schedule '${schedule.name}' : ` + e)
        }
      }
    }catch(e){
      logger.error(e)
    }finally{
      // Schedule the next execution
      setTimeout(checkSchedules,10000)
    }
  }

  // Initial call to start the process
  setTimeout(checkSchedules,10000)
}

export default init