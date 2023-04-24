const logger=require("../lib/logger");
var Ssh = require('../models/ssh.model');
var Form = require('../models/form.model');
var Job = require('../models/job.model')

Ssh.generate(false)
  .catch((err)=>{
    logger.error("Failed to generate ssh keys : " + err)
  })
Form.initBackupFolder()
Job.abandon()
  .then((changed)=>{
    logger.warning(`Abandoned ${changed} jobs`)
  })
  .catch((err)=>{
    logger.error("Failed to abandon job : " + err)
  })
