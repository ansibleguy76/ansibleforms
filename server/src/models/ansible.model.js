'use strict';
const ansibleConfig = require('./../../config/ansible.config');
const logger=require("../lib/logger")
const Exec=require("../lib/exec.js")

//awx object create - not used but as instance for later
var Ansible=function(){

};

// run a playbook
Ansible.run = function (form,playbook,inventory,tags,check,diff,extraVars,user, result) {
  // prepare my ansible command
  var command = `ansible-playbook -e '${extraVars}'`
  inventory.forEach((item, i) => {
    command += ` -i '${item}'`
  });

  if(tags){
    command += ` -t '${tags}'`
  }
  if(check){
    command += ` --check`
  }
  if(diff){
    command += ` --diff`
  }
  command += ` ${playbook}`
  var directory = ansibleConfig.path
  var cmdObj = {directory:directory,command:command,description:"Running playbook",task:"Playbook"}
  var metaData = {form:form,target:playbook,inventory:inventory,tags:tags,check:check,diff:diff,job_type:'ansible',extravars:extraVars,user:user}
  Exec.runCommand(cmdObj,metaData,result)

};
module.exports= Ansible;
