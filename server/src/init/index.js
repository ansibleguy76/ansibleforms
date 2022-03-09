const logger=require("../lib/logger");
var Ssh = require('../models/ssh.model');

Ssh.generate(false,function(err,out){
  if(err){
    logger.error("Failed to generate ssh keys : " + err)
  }
})
