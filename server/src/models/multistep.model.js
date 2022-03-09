'use strict';
const logger=require("../lib/logger")
const path=require("path")
const moment=require("moment")
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
  Job.create(new Job({form:form,target:"multistep",user:user.username,user_type:user.type,status:"running",job_type:"multistep",extravars:JSON.stringify(extraVars)}),async function(error,jobid){
    var counter=0
    var ok=0
    var failed=0
    var skipped=0
    var aborted=false
    if(error){
      // multistep job could not be created (unlikely)
      logger.error(error)
      result(error,null)
    }else{
      // parent job created - return to client who can now follow the flow
      result(null,{id:jobid})
      logger.silly(`Job id ${jobid} is created`)
      // all remaining steps are now in the background
      try{
        var finalSuccessStatus=true  // multistep success from start to end ?
        var partialstatus=false      // was there a step that failed and had continue ?
        steps.reduce(     // loop promises of the steps
          async (promise,step)=>{    // we get the promise of the previous step and the new step
            return promise.then(async (previousSuccess) =>{ // we don't actually use previous success
              var result=false
              logger.info("Running step " + step.name)
              // print title and check abort
              Exec.printCommand(`STEP [${step.name}] ${'*'.repeat(72-step.name.length)}`,"stdout",jobid,++counter,null,()=>{
                // if abort, then step aborted flag, and change status to aborting
                aborted=true
                Exec.printCommand(`Abort is requested`,"stderr",jobid,++counter)
                Job.update({status:"aborting",end:moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')},jobid,function(error,res){
                  if(error){
                    logger.error(error)
                  }
                })
              })
              // if aborted is requested, stop the flow
              if(aborted){throw("Abort is requested")} // fail step due to abort
              // if the previous steps were ok (or failed with continue) OR step has always:true
              if(finalSuccessStatus || step.always){
                  // filter the extravars with "key"
                  var ev = {...extraVars}
                  if(step.key && ev[step.key]){
                    // logger.warn(step.key + " exists using it")
                    ev = ev[step.key]
                  }
                  // type : AWX
                  if(step.type=="awx"){
                    // wait the promise of AWX do
                    result= await Awx.do(form,step.template,step.inventory,step.check,step.diff,step.tags,user,creds,ev,null,function(err,job){
                      if(err){
                        // unlikely, would mean we could not create a job
                        Exec.printCommand(err,"stderr",jobid,++counter)
                      }else{
                        // job created, set parent id
                        Job.setParentId(jobid,job.id,function(error,res){ if(error){ logger.error(error) }})
                        Exec.printCommand(`ok: [Launched step ${step.name} with jobid '${job.id}']`,"stdout",jobid,++counter)
                      }
                    })
                    // AWX job is done
                    logger.silly("Result from awx = " + result)
                    // check again for abort
                    Exec.printCommand(null,null,jobid,++counter,null,()=>{
                      aborted=true
                      Exec.printCommand(`Abort is requested`,"stderr",jobid,++counter)
                      Job.update({status:"aborting",end:moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')},jobid,function(error,res){
                        if(error){
                          logger.error(error)
                        }
                      })
                    })
                    ok++
                    // exit step and return promise true
                    return true
                  }
                  // step : ansible
                  if(step.type=="ansible"){
                    // wait for the ansible promise
                    result= await Ansible.do(form,step.playbook,step.inventory,step.check,step.diff,step.tags,user,creds,ev,null,function(err,job){
                      if(err){
                        // unlikely no job created
                        Exec.printCommand(err,"stderr",jobid,++counter)
                      }else{
                        // job created, set parent id
                        Job.setParentId(jobid,job.id,function(error,res){ if(error){ logger.error(error) }})
                        Exec.printCommand(`ok: [Launched step ${step.name} with jobid '${job.id}']`,"stdout",jobid,++counter)
                      }
                    })
                    // job finished
                    logger.silly("Result from ansible = " + result)
                    // check again for abort
                    Exec.printCommand(null,null,jobid,++counter,null,()=>{
                      aborted=true
                      Exec.printCommand(`Abort is requested`,"stderr",jobid,++counter)
                      Job.update({status:"aborting",end:moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')},jobid,function(error,res){
                        if(error){
                          logger.error(error)
                        }
                      })
                    })
                    ok++
                    // exit step and return promise true
                    return true
                  }
                  // type: git
                  if(step.type=="git"){
                    // wait for git promise
                    result= await Git.do(form,step.repo,ev,user,null,function(err,job){
                      if(err){
                        // unlikely no job created
                        Exec.printCommand(err,"stderr",jobid,++counter)
                      }else{
                        // job ready, set parent id
                        Job.setParentId(jobid,job.id,function(error,res){ if(error){ logger.error(error) }})
                        Exec.printCommand(`ok: [Launched step ${step.name} with jobid '${job.id}']`,"stdout",jobid,++counter)
                      }
                    })
                    // job finished
                    logger.silly("Result from git = " + result)
                    // check again for abort
                    Exec.printCommand(null,null,jobid,++counter,null,()=>{
                      aborted=true
                      Exec.printCommand(`Abort is requested`,"stderr",jobid,++counter)
                      Job.update({status:"aborting",end:moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')},jobid,function(error,res){
                        if(error){
                          logger.error(error)
                        }
                      })
                    })
                    ok++
                    // exit step, return promise true
                    return true
                  }
              }else{ // previous was not success or there was fail in other steps
                // skip this step
                skipped++
                logger.silly("skipping: step " + step.name)
                finalSuccessStatus=false
                Exec.printCommand("skipping: [due to previous failure]","stdout",jobid,++counter)
                // fail this step
                return false
              }
            }).catch((err)=>{
              // step failed in promise - something was wrong
              failed++
              logger.error("Failed step " + step.name)
              Exec.printCommand("[ERROR]: Failed step "+ step.name + " : " + err,"stderr",jobid,++counter)
              // if continue, we mark partial and mark as success
              if(step.continue){
                partialstatus=true
                return true
              }else{  // no continue, we fail the multistep
                finalSuccessStatus=false
                return false
              }
            })
          },
          Promise.resolve(true) // initial reduce promise
        ).catch((err)=>{ // failed at last step
          // we still need to handle the last failure
          failed++
          logger.error("Failed step " + steps[-1].name)
          finalSuccessStatus=false
          Exec.printCommand("Failed step "+ steps[-1].name + " : " + err,"stderr",jobid,++counter)

        }).then((success)=>{ // last step success
          logger.silly("Last step => " + success)
        }).finally(()=>{ // finally create recap
          // create recap
          Exec.printCommand(`MULTISTEP RECAP ${'*'.repeat(64)}`,"stdout",jobid,++counter)
          Exec.printCommand(`localhost   : ok=${ok}    failed=${failed}    skipped=${skipped}`,"stdout",jobid,++counter)
          if(finalSuccessStatus){
            // if multistep was success
            if(partialstatus){
              // but a step failed with continue => mark as warning
              Exec.endCommand(jobid,++counter,"stdout","warning","[WARNING]: Finished multistep with warnings")
            }else{
              // mark as full success
              Exec.endCommand(jobid,++counter,"stdout","success","ok: Finished multistep successfully")
            }

          }else{  // no multistep success
            if(aborted){
              // if aborted mark as such
              Exec.endCommand(jobid,++counter,"stderr","aborted","multistep was aborted")
            }else{
              // else, mark failed
              Exec.endCommand(jobid,++counter,"stderr","failed","[ERROR]: Finished multistep with errors")
            }
          }
        })

      }catch(e){
        // a final catch for fatal errors // should not occur if properly coded
        logger.error(e)
        Exec.endCommand(jobid,++counter,"stderr","failed",e)
      }
    }
  })

};

module.exports= Multi;
