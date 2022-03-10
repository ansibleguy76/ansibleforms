'use strict';
const logger=require("../lib/logger")
const path=require("path")
const Exec=require("../lib/exec.js")
const Job=require("./job.model")
const YAML=require("yaml")
var config=require('../../config/app.config')
const fs=require("fs")

var Git=function(){

};

// run git push
Git.push = function (form,repo,extraVars,user, result,success,failed) {

  // create a new job in the database
  Job.create(new Job({form:form,target:repo.file,user:user.username,user_type:user.type,status:"running",job_type:"git",extravars:extraVars}),function(error,jobid){
    var counter=0
    if(error){
      logger.error(error)
      result(error,null)
      if(failed)failed(error)
    }else{
      // job created - return to client
      result(null,{id:jobid})
      logger.debug(`Job id ${jobid} is created`)
      // rest is in background - launch save + git commit/push
      try{
        // save the extravars as file - we do this in sync, should be fast
        Exec.printCommand(`TASK [Writing YAML to local repo] ${'*'.repeat(72-26)}`,"stdout",jobid,++counter)
        var yaml = YAML.stringify(JSON.parse(extraVars))
        fs.writeFileSync(path.join(config.repoPath,repo.dir,repo.file),yaml)
        // log the save
        Exec.printCommand(`ok: [Extravars Yaml file created : ${repo.file}]`,"stdout",jobid,++counter)
        Exec.printCommand(`TASK [Committing changes] ${'*'.repeat(72-18)}`,"stdout",jobid,++counter)
        // start commit
        var command = `git commit --allow-empty -am "update from ansibleforms" && ${repo.push}`
        var directory = path.join(config.repoPath,repo.dir)
        Exec.executeCommand({directory:directory,command:command,description:"Pushing to git",task:"Git push"},jobid,counter,(jobid,counter)=>{
          if(success)success()
        },(jobid,counter)=>{
          if(failed)failed("Job failed")
        },(jobid,counter)=>{
          if(failed)failed("Job was aborted")
        })

      }catch(e){
        logger.error(e)
        Exec.endCommand(jobid,counter,"stderr","failed",e,null,(jobid,counter)=>{
          if(failed)failed(e)
        })
      }

    }
  })

};
// run a playbook
Git.pull = function (repo, result) {

    var command = repo.pull
    var directory = path.join(config.repoPath,repo.dir)
    Exec.executeSilentCommand({directory:directory,command:command,description:"Pulling from git"},result)

};
module.exports= Git;
