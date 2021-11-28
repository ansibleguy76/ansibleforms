'use strict';
const ansibleConfig = require('./../../config/ansible.config');
const logger=require("../lib/logger")
const {exec} = require('child_process');
const Job = require("./job.model")
const moment = require("moment")

//awx object create - not used but as instance for later
var Ansible=function(){

};

// run a playbook
Ansible.run = function (form,playbook,inventory,tags,extraVars, result) {

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

  var child = exec(command,{cwd:directory});
  Job.create(new Job({form:form,playbook:playbook,status:"running"}),function(error,jobid){
    var counter=0
    if(error){
      logger.error(error)
      result(error,null)
    }else{
      result(null,{id:jobid})
      logger.silly(`Job id ${jobid} is created`)
      child.stdout.on('data',function(data){
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
          Job.update({status:"success",end:moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')},jobid,function(error,res){
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
