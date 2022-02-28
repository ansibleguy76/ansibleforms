'use strict';
const ansibleConfig = require('./../../config/ansible.config');
const logger=require("../lib/logger")
const Exec=require("../lib/exec.js")
const Job=require("./job.model")

var Ansible=function(){

};

// run a playbook
Ansible.launch = function (form,playbook,inventory,tags,check,diff,extraVars,user, result) {
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
  // create a new job in the database
  Job.create(new Job({form:metaData.form,target:metaData.target,user:metaData.user.username,user_type:metaData.user.type,status:"running",job_type:metaData.job_type,extravars:metaData.extravars}),function(error,jobid){
    var counter=0
    if(error){
      logger.error(error)
      result(error,null)
    }else{
      // job created - return to client
      result(null,{id:jobid})
      logger.silly(`Job id ${jobid} is created`)
      // in the background, start the commands
      Exec.executeCommand(cmdObj,jobid,counter)
    }
  })

};
module.exports= Ansible;
