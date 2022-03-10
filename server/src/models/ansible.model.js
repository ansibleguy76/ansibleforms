'use strict';
const ansibleConfig = require('./../../config/ansible.config');
const logger=require("../lib/logger")
const Exec=require("../lib/exec.js")
const Job=require("./job.model")

var Ansible=function(){

};

// run a playbook
Ansible.launch = function (form,playbook,inventory,tags,check,diff,extraVars,user, result,success,failed) {
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
  // create a new job in the database
  Job.create(new Job({form:form,target:playbook,user:user.username,user_type:user.type,status:"running",job_type:"ansible",extravars:extraVars}),function(error,jobid){
    var counter=0
    if(error){
      logger.error(error)
      result(error,null)
      if(failed)failed(error)
    }else{
      // job created - return to client
      result(null,{id:jobid})
      logger.debug(`Job id ${jobid} is created`)
      // in the background, start the commands
      Exec.executeCommand(cmdObj,jobid,counter,(jobid,counter)=>{
        if(success)success()
      },(jobid,counter)=>{
        if(failed)failed("Job failed")
      },(jobid,counter)=>{
        if(failed)failed("Job was aborted")
      })
    }
  })

};
module.exports= Ansible;
