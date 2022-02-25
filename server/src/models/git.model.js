'use strict';
const logger=require("../lib/logger")
const path=require("path")
const Exec=require("../lib/exec.js")
const YAML=require("yaml")
const fs=require("fs")

var Git=function(){

};

// run a playbook
Git.push = function (form,repo,extraVars,user, result) {

  // prepare my Git command
  var metaData = {form:form,target:repo.file,inventory:'',tags:'',check:false,diff:false,job_type:'git',extravars:extraVars,user:user}
    Exec.runCommand(null,metaData,result,function(jobid,counter){
    try{
      var yaml = YAML.stringify(JSON.parse(extraVars))
      fs.writeFileSync(path.join(repo.dir,repo.file),yaml)
      Exec.printCommand(`Extravars Yaml file created : ${repo.file}`,"stdout",jobid,counter,function(){

        var command = `git commit -am "update from ansibleforms" && ${repo.push}`
        var directory = repo.dir

        Exec.executeCommand({directory:directory,command:command,description:"Pushing to git",task:"Git push"},jobid,counter)
      })
    }catch(e){
      logger.error(e)
      Exec.printCommand(e,"stderr",jobid,counter)
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
