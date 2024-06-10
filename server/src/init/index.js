async function init(){

  const logger=require("../lib/logger");
  var Ssh = require('../models/ssh.model');
  var Form = require('../models/form.model');
  var Job = require('../models/job.model');
  const mysql=require("../models/db.model");
  const Repository = require('../models/repository.model');
  const parser = require("cron-parser")
  const dayjs = require("dayjs")

    // this is at startup, don't start the app until mysql is ready
    // rewrite with await
    console.log("Waiting for mysql to start")
    async function sleep(millis) {
      return new Promise(resolve => setTimeout(resolve, millis));
    }
    var MYSQL_IS_READY = false
    while(!MYSQL_IS_READY){
      try{
        await mysql.do("SELECT 1")
        MYSQL_IS_READY = true
      }catch(e){
        console.log("Mysql not ready yet")
        await sleep(5000)
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