'use strict';
const ansibleConfig = require('./../../config/ansible.config');
const logger=require("../lib/logger")
const {exec} = require('child_process');
//awx object create - not used but as instance for later
var Ansible=function(){

};

// run a playbook
Ansible.run = function (playbook,inventory,tags,extraVars, result) {

  // prepare my ansible command
  var command = `ansible-playbook -e '${extraVars}'`
  if(inventory){
    command += ` -i '${inventory}'`
  }
  if(tags){
    command += ` -t '${tags}'`
  }
  command += ` ${playbook}`
  var directory = ansibleConfig.path
  logger.debug(`Executing playbook, ${directory} > ${command}`)

  exec(command,{cwd:directory}, (error, stdout, stderr) => {
    if (error) {
      logger.error(`exec error: ${error}\n\n`);
      result(error,null)
    }else{
      logger.silly(`stdout: ${stdout}`);
      logger.silly(`stderr: ${stderr}`);
      result(null,stdout,stderr)
    }

  });

};
module.exports= Ansible;
