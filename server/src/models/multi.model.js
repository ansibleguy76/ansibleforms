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
        var finalSuccessStatus=true
        var partialstatus=false
        var last = steps.reduce(
          async (promise,step)=>{
            return promise.then(async (previousSuccess) =>{
              var result=false
              if(previousSuccess){

                  var ev = {...extraVars}
                  if(step.key && ev[step.key]){
                    // logger.warn(step.key + " exists using it")
                    ev = ev[step.key]
                  }
                  if(step.type=="awx"){
                    logger.silly("Running step " + step.name)
                    // rest is in background - Launch awx
                    result= await Awx.do(form,step.template,step.inventory,step.check,step.diff,step.tags,user,creds,ev,null,function(err,job){
                      if(err){
                        Exec.printCommand(err,"stderr",jobid,++counter)
                      }else{
                        Exec.printCommand(`Launched step ${step.name} with jobid ${job.id}`,"stdout",jobid,++counter)
                        // TODO loop job progress
                      }
                    })
                    logger.silly("Result from awx = " + result)
                    return true
                  }
                  if(step.type=="ansible"){
                    logger.silly("Running step " + step.name)
                    // rest is in background - Launch ansible
                    result= await Ansible.do(form,step.playbook,step.inventory,step.check,step.diff,step.tags,user,creds,ev,null,function(err,job){
                      if(err){
                        Exec.printCommand(err,"stderr",jobid,++counter)
                      }else{
                        Exec.printCommand(`Launched step ${step.name} with jobid ${job.id}`,"stdout",jobid,++counter)
                        // TODO loop job progress
                      }
                    })
                    logger.silly("Result from ansible = " + result)
                    return true
                  }
                  if(step.type=="git"){
                    logger.silly("Running step " + step.name)
                    // rest is in background - launch file save + git commit/push
                    result= await Git.do(form,step.repo,ev,user,null,function(err,job){
                      if(err){
                        Exec.printCommand(err,"stderr",jobid,++counter)
                      }else{
                        Exec.printCommand(`Launched step ${step.name} with jobid ${job.id}`,"stdout",jobid,++counter)
                        // TODO loop job progress
                      }
                    })
                    logger.silly("Result from git = " + result)
                    return true
                  }
              }else{
                logger.silly("Skipping step " + step.name)
                finalSuccessStatus=false
                Exec.printCommand("Skipping step "+ step.name,"stderr",jobid,++counter)
                return false
              }
            }).catch((err)=>{
              logger.error("Failed step " + step.name)
              Exec.printCommand("Failed step "+ step.name + " : " + err,"stderr",jobid,++counter)
              if(step.continue){
                partialstatus=true
                return true
              }else{
                finalSuccessStatus=false
                return false
              }
            })
          },
          Promise.resolve(true)
        ).catch((err)=>{ // failed at last step
          logger.error("Failed step " + steps[-1].name)
          finalSuccessStatus=false
          Exec.printCommand("Failed step "+ steps[-1].name + " : " + err,"stderr",jobid,++counter)
        })
        last.then((success)=>{
          logger.silly("Last step => " + success)
          if(finalSuccessStatus){
            if(partialstatus){
              Exec.endCommand(jobid,++counter,"stdout","success","Finished multi with warnings")
            }else{
              Exec.endCommand(jobid,++counter,"stdout","warning","Finished multi with warnings")
            }

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
