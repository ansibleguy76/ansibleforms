'use strict';
const ansibleConfig = require('./../../config/ansible.config');
const logger=require("../lib/logger")
const {exec} = require('child_process');
const Job = require("./job.model")

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

  var process = exec(command,{cwd:directory});
  Job.create(new Job({command:command,status:"running"}),function(error,jobid){
    if(error){
      logger.error(error)
      result(error,null)
    }else{
      result(null,{id:jobid})
      logger.silly(`Job id ${jobid} is created`)
      process.stdout.on('data',function(data){
        Job.createOutput({output:data,output_type:"stdout",job_id:jobid},function(error,res){
          if(error){
            logger.error(error)
          }
        })
      })
      process.stderr.on('data',function(data){
        Job.createOutput({output:data,output_type:"stderr",job_id:jobid},function(error,res){
          if(error){
            logger.error(error)
          }
        })
      })
      process.on('exit',function(data){
        Job.update({status:"success"},jobid,function(error,res){
          if(error){
            logger.error(error)
          }
        })
      })
      process.on('error',function(data){
        Job.update({status:"failed"},jobid,function(error,res){
          if(error){
            logger.error(error)
          }
        })
      })
    }
  })


};
module.exports= Ansible;
