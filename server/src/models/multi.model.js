'use strict';
const logger=require("../lib/logger")
const path=require("path")
const Exec=require("../lib/exec.js")
const Job=require("./job.model")
const Awx=require("../controllers/awx.controller")
const Git=require("../controllers/git.controller")
const Ansible=require("../controllers/ansible.controller")
const YAML=require("yaml")
const fs=require("fs")

var Multi=function(){

};

// run git push
Multi.launch = async function (form,steps,extraVars,user,creds, result) {
  // create a new job in the database
  Job.create(new Job({form:form,target:"multi",user:user.username,user_type:user.type,status:"running",job_type:"multi",extravars:JSON.stringify(extraVars)}),async function(error,jobid){
    var counter=0
    if(error){
      logger.error(error)
      result(error,null)
    }else{
      // job created - return to client
      result(null,{id:jobid})
      logger.silly(`Job id ${jobid} is created`)
      // rest is in background - launch save + git commit/push
      // Exec.printCommand("ok, so far so good","stdout",jobid,counter)

      try{
        var finalstatus=true
        var last = steps.reduce(
          async (promise,step)=>{
            return promise.then(async previousSuccess =>{
              var result=false
                var ev = {...extraVars}
                if(step.key && ev[step.key]){
                  logger.warn(step.key + " exists using it")
                  ev = ev[step.key]
                }
                if(step.type=="awx"){
                  logger.silly("Running step " + step.name)
                  result= await Awx.do(form,step.template,step.inventory,step.check,step.diff,step.tags,user,creds,ev,null,function(err,job){
                    if(err){
                      Exec.printCommand(err,"stderr",jobid,++counter)
                      finalstatus=false
                    }else{
                      Exec.printCommand(`Launched step ${step.name} with jobid ${job.id}`,"stdout",jobid,++counter)
                      // TODO loop job progress
                    }
                  })
                  logger.silly("Result from awx = " + result)
                  return result
                }
                if(step.type=="ansible"){
                  logger.silly("Running step " + step.name)
                  // rest is in background - launch save + git commit/push
                  result= await Ansible.do(form,step.playbook,step.inventory,step.check,step.diff,step.tags,user,creds,ev,null,function(err,job){
                    if(err){
                      Exec.printCommand(err,"stderr",jobid,++counter)
                      finalstatus=false
                    }else{
                      Exec.printCommand(`Launched step ${step.name} with jobid ${job.id}`,"stdout",jobid,++counter)
                      // TODO loop job progress
                    }
                  })
                  logger.silly("Result from ansible = " + result)
                  return result
                }
                if(step.type=="git"){
                  logger.silly("Running step " + step.name)
                  // rest is in background - launch save + git commit/push
                  result= await Git.do(form,step.repo,ev,user,null,function(err,job){
                    if(err){
                      Exec.printCommand(err,"stderr",jobid,++counter)
                      finalstatus=false
                    }else{
                      Exec.printCommand(`Launched step ${step.name} with jobid ${job.id}`,"stdout",jobid,++counter)
                      // TODO loop job progress
                    }
                  })
                  logger.silly("Result from git = " + result)
                  return result
                }
            }).catch((err)=>{
              logger.silly("Skipping step " + step.name)
              finalstatus=false
              Exec.printCommand("Failed " + err,"stderr",jobid,++counter)
              return false
            })
          },
          Promise.resolve(true)
        )
        last.then((success)=>{
          logger.silly("Last step => " + success)
          if(finalstatus){
            Exec.endCommand(jobid,++counter,"stdout","success","Finished multi")
          }else{
            Exec.endCommand(jobid,++counter,"stderr","failed","Finished multi with errors")
          }

        }).catch((err)=>{
          Exec.endCommand(jobid,++counter,"stderr","failed","Finished multi with errors")
        })

      }catch(e){
        logger.error(e)
        Exec.endCommand(jobid,++counter,"stderr","failed",e)
      }

    }
  })

};

module.exports= Multi;
