'use strict';
const ansibleConfig = require('./../../config/ansible.config');
const logger=require("../lib/logger")
const {exec} = require('child_process');
const Job = require("./job.model")
const moment = require("moment")

//awx object create - not used but as instance for later
var Ansible=function(){

};

// single regex checks on ansible output to see if an error occured
function hasError(data){
  if(data.match(/^fatal:/)){
    return true
  }
  if(data.match(/FAILED!/)){
    return true
  }
  if(data.match(/ERROR!/)){
    return true
  }
  if(data.match(/failed=[1-9]/)){
    return true
  }
  return false
}

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
  logger.silly(`Executing playbook, ${directory} > ${command}`)

  // execute the procces
  var child = exec(command,{cwd:directory});

  // create a new job in the database
  Job.create(new Job({form:form,playbook:playbook,user:user.username,user_type:user.type,status:"running"}),function(error,jobid){
    // a counter to order the output (as it very fast and the database can mess up the order)
    var counter=0
    var jobstatus = "success"

    if(error){
      logger.error(error)
      result(error,null)
    }else{
      // job created
      result(null,{id:jobid})
      logger.silly(`Job id ${jobid} is created`)

      // add output eventlistener to the process to save output
      child.stdout.on('data',function(data){
        if(hasError(data)){
          jobstatus="failed"
        }
        // save the output ; but whilst saving, we quickly check the status to detect abort
        Job.createOutput({output:data,output_type:"stdout",job_id:jobid,order:++counter},function(error,res){
          if(error){
            logger.error(error)
          }else{
            // if abort request found ; kill the process
            if(res.length==2){
              if(res[1][0].status=="abort"){
                logger.warn("Abort is requested, killing child")
                process.kill(child.pid,"SIGTERM");
              }
            }
          }
        })
      })
      // add error eventlistener to the process to save output
      child.stderr.on('data',function(data){
        if(hasError(data)){
          jobstatus="failed"
        }
        // save the output ; but whilst saving, we quickly check the status to detect abort
        Job.createOutput({output:data,output_type:"stderr",job_id:jobid,order:++counter},function(error,res){
          if(error){
            logger.error(error)
          }else{
            // if abort request found ; kill the process
            if(res.length==2){
              if(res[1][0].status=="abort"){
                logger.warn("Abort is requested, killing child")
                process.kill(child.pid,"SIGTERM");
              }
            }
          }
        })
      })
      // add exit eventlistener to the process to handle status update
      child.on('exit',function(data){
        // if the exit was an actual request ; set aborted
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
        }else{ // if the exit was natural; set the jobstatus (either success or failed)
          Job.update({status:jobstatus,end:moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')},jobid,function(error,res){
            if(error){
              logger.error(error)
            }
          })
        }

      })
      // add error eventlistener to the process; set failed
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
