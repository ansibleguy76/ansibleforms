async function init(){

  const logger=require("../lib/logger");
  var Ssh = require('../models/ssh.model');
  var Form = require('../models/form.model');
  var Job = require('../models/job.model');
  var Schema = require('../models/schema.model');
  const mysql=require("../models/db.model");
  const Repository = require('../models/repository.model');
  const parser = require("cron-parser")
  const dayjs = require("dayjs")
  const util = require('util')

  // this is at startup, don't start the app until mysql is ready
  // rewrite with await
  logger.info("Waiting for mysql to start")
  async function sleep(millis) {
    return new Promise(resolve => setTimeout(resolve, millis));
  }
  var MYSQL_IS_READY = false
  while(!MYSQL_IS_READY){
    try{
      await mysql.do("SELECT 1")
      MYSQL_IS_READY = true
    }catch(e){
      logger.log("Mysql not ready yet")
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


  Ssh.generate(false)
    .catch((err)=>{
      logger.warning("Failed to generate ssh keys : " + err)
    })
  Form.initBackupFolder()

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

  logger.info("Initializing repository cron schedules")
  // this is hourly, abandon running jobs older than a day.
  setInterval(()=>{
    mysql.do("SELECT name,cron FROM AnsibleForms.`repositories` WHERE status<>'running' AND cron<>''",undefined,true)
    .then((repositories)=>{
      repositories.map((repo)=>{
        try{
          const interval = parser.parseExpression(repo.cron) 
          const next = interval.next().toDate()
          const date = dayjs(next)
          const now = dayjs()
          const minutes = date.diff(now,'m')
          if(minutes==0){
            Repository.pull(repo.name)
          }else{
            // logger.debug(`Not time yet, ${minutes} minutes to go`)
          }
        }catch(e){
          logger.error(`Failed to parse cron schedule ${repo.cron}`)
        }       

      })
    })
    .catch((e)=>{})  
  },56000) // run every 55 second, should hit 0 minutes once

}

module.exports = init