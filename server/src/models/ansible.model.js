'use strict';
const ansibleConfig = require('./../../config/ansible.config');
const logger=require("../lib/logger")
const {exec} = require('child_process');
const Job = require("./job.model")
const moment = require("moment")

//awx object create - not used but as instance for later
var Ansible=function(){

};

function hasError(data){
  if(data.match(/^fatal:/)){
    return true
  }
  if(data.match(/FAILED!/)){
    return true
  }
  if(data.match(/failed=[1-9]/)){
    return true
  }
  return false
}

// run a playbook
Ansible.run = function (form,playbook,inventory,tags,extraVars,user, result) {
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
  logger.silly(`Executing playbook, ${directory} > ${command}`)

  var child = exec(command,{cwd:directory});
  Job.create(new Job({form:form,playbook:playbook,user:user.username,user_type:user.type,status:"running"}),function(error,jobid){
    var counter=0
    var jobstatus = "success"
    if(error){
      logger.error(error)
      result(error,null)
    }else{
      result(null,{id:jobid})
      logger.silly(`Job id ${jobid} is created`)
      child.stdout.on('data',function(data){
        if(hasError(data)){
          jobstatus="failed"
        }
        Job.createOutput({output:data,output_type:"stdout",job_id:jobid,order:++counter},function(error,res){
          if(error){
            logger.error(error)
          }else{
            if(res.length==2){
              if(res[1][0].status=="abort"){
                logger.warn("Abort is requested, killing child")
                process.kill(child.pid,"SIGTERM");
              }
            }
          }
        })
      })
      child.stderr.on('data',function(data){
        Job.createOutput({output:data,output_type:"stderr",job_id:jobid,order:++counter},function(error,res){
          if(error){
            logger.error(error)
          }else{
            if(hasError(data)){
              jobstatus="failed"
            }
            if(res.length==2){
              if(res[1][0].status=="abort"){
                logger.warn("Abort is requested, killing child")
                process.kill(child.pid,"SIGTERM");
              }
            }
          }
        })
      })
      child.on('exit',function(data){
        if(child.signalCode=='SIGTERM'){
          Job.createOutput({output:"Playbook was aborted by operator",output_type:"stderr",job_id:jobid,order:++counter},function(error,res){
            if(error){
              logger.error(error)
            }
            Job.update({status:"aborted",end:moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')},jobid,function(error,res){
              if(error){
                logger.error(error)
              }
            })
          })
        }else{
          Job.update({status:jobstatus,end:moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')},jobid,function(error,res){
            if(error){
              logger.error(error)
            }
          })
        }

      })
      child.on('error',function(data){
        Job.update({status:"failed",end:moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')},jobid,function(error,res){
          if(error){
            logger.error(error)
          }
        })
      })
    }
  })


};
module.exports= Ansible;
