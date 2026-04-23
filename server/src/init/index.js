import logger from "../lib/logger.js";
import Ssh from '../models/ssh.model.js';
import Form from '../models/form.model.js';
import Job from '../models/job.model.js';
import Schema from '../models/schema.model.js';
import mysql from "../models/db.model.js";
import Repository from '../models/repository.model.js';
import Datasource from '../models/datasource.model.js';
import Schedule from '../models/schedule.model.js';
import BackupModel from '../models/backup.model.js';
import cronService from '../services/cron.service.js';
import dayjs from "dayjs";
import appConfig from "../../config/app.config.js";
import User from "../models/user.model.js";
import Group from "../models/group.model.js";
import Token from "../models/token.model.js";

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
  var schemaIsReady = false
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
      // Schema exists but has issues - continue with caution
      schemaIsReady = false
    }else{
      logger.info("Schema is up to date")
      schemaIsReady = true
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
    // Schema is missing - stop initialization here
    schemaIsReady = false
  }

  // Only continue with group/user creation if schema is ready
  if(!schemaIsReady){
    logger.warning("Schema is not ready, skipping group and user initialization")
    logger.warning("Please create the schema via the /schema endpoint")
    // Continue to start the app so the /schema endpoint is available
  }else{
    // check admins groups
    logger.info("Checking admins group exists")
    try{
      var adminGroupName = "admins"
      var adminGroup = await Group.findByName(adminGroupName)
      if(!adminGroup){
        logger.info(`Group ${adminGroupName} not found, creating it`)
        adminGroupId = await Group.create({name:adminGroupName})
        logger.info(`Created admins group with id ${adminGroupId}`)
      }else{
        adminGroupId = adminGroup.id
        logger.info(`Found admins group with id ${adminGroupId}`)
      }
    }catch(err){
      logger.error("Failed to check/create admins group : " + err)
    }

    // check admin user
    logger.info("Checking admin user exists")
    try{
      var adminUsername = appConfig.adminUsername
      var adminUser = await User.findByUsername(adminUsername)
      if(!adminUser){
        logger.info(`Admin user ${adminUsername} not found, creating it`)
        var adminPassword = appConfig.adminPassword
        await User.create({username:adminUsername,email:'',password:adminPassword,group_id:adminGroupId})
        logger.info(`Created admin user ${adminUsername}`)
      }else{
        logger.info(`Admin user ${adminUsername} already exists`)
      }
    }catch(err){
      logger.error("Failed to check/create admin user : " + err)
    }
  }

  // let's check other database records like settings,ldap. if no record exists, create them, this is for fresh install
  logger.info("Checking database records")
  const records = {
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

  logger.info("Initializing cron service for scheduled tasks")
  // Initialize all cron jobs from database (repositories, datasources, schedules)
  await cronService.initializeAll();

  logger.info("Initializing system maintenance tasks")
  // Initialize system maintenance cron jobs (abandoned jobs, token cleanup, backups, etc.)
  await cronService.initializeSystemTasks(Job, Token, BackupModel, appConfig);

  logger.info("Pulling repositories")
  mysql.do("SELECT name FROM AnsibleForms.`repositories` WHERE rebase_on_start=1")
  .then((repositories)=>{
    repositories.map((repo)=>{
      logger.info("Pulling " + repo.name)
      Repository.clone(repo.name).catch((e)=>{})
    })
  })
  .catch((e)=>{})

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

  // Cleanup expired stored jobs daily at 3 AM
  logger.info("Initializing stored jobs cleanup");
  async function cleanupExpiredStoredJobs() {
    try {
      const result = await mysql.do(
        "DELETE FROM AnsibleForms.stored_jobs WHERE expires_at IS NOT NULL AND expires_at < NOW()",
        undefined,
        true
      );
      if (result.affectedRows > 0) {
        logger.info(`Cleaned up ${result.affectedRows} expired stored job(s)`);
      }
    } catch (e) {
      logger.error("Failed to cleanup expired stored jobs:", e);
    } finally {
      // Run cleanup daily (24 hours)
      setTimeout(cleanupExpiredStoredJobs, 24 * 60 * 60 * 1000);
    }
  }

  // Initial call to start the cleanup process (run after 1 minute)
  setTimeout(cleanupExpiredStoredJobs, 60000);
}

export default init