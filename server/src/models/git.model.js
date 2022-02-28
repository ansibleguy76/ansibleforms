'use strict';
const logger=require("../lib/logger")
const path=require("path")
const Exec=require("../lib/exec.js")
const Job=require("./job.model")
const YAML=require("yaml")
const fs=require("fs")

var Git=function(){

};

// run git push
Git.push = function (form,repo,extraVars,user, result) {

  // prepare my Git command
  var metaData = {form:form,target:repo.file,inventory:'',tags:'',check:false,diff:false,job_type:'git',extravars:extraVars,user:user}

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
      // rest is in background - launch save + git commit/push
      try{
        // save the extravars as file - we do this in sync, should be fast
        var yaml = YAML.stringify(JSON.parse(extraVars))
        fs.writeFileSync(path.join(repo.dir,repo.file),yaml)
        // log the save
        Exec.printCommand(`Extravars Yaml file created : ${repo.file}`,"stdout",jobid,counter,function(){
          // start commit
          var command = `git commit --allow-empty -am "update from ansibleforms" && ${repo.push}`
          var directory = repo.dir
          Exec.executeCommand({directory:directory,command:command,description:"Pushing to git",task:"Git push"},jobid,counter)
        })
      }catch(e){
        logger.error(e)
        Exec.printCommand(e,"stderr",jobid,counter)
      }

    }
  })

};
// run a playbook
Git.pull = function (repo, result) {

    var command = repo.pull
    var directory = repo.dir
    Exec.executeSilentCommand({directory:directory,command:command,description:"Pulling from git"},result)

};
module.exports= Git;
