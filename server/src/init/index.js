const logger=require("../lib/logger");
var Ssh = require('../models/ssh.model');
var Form = require('../models/form.model');
var Job = require('../models/job.model');


Ssh.generate(false)
  .catch((err)=>{
    logger.warning("Failed to generate ssh keys : " + err)
  })
Form.initBackupFolder()

// this is at startup, abandon all running jobs, pointless to not do it.
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
