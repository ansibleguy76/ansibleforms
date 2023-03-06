const logger=require("../lib/logger");
var Ssh = require('../models/ssh.model');
var Form = require('../models/form.model');

Ssh.generate(false)
  .catch((err)=>{
    logger.error("Failed to generate ssh keys : " + err)
  })
Form.initBackupFolder()
