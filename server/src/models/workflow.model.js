'use strict';
const logger=require("../lib/logger")
const path=require("path")
const Helpers=require("../lib/common.js")
const YAML=require("yaml")
const fs=require("fs")

var Workflow=function(){

};

// run a playbook
Workflow.launch = function (form,workflow,extraVars,user, result) {

  // prepare my Workflow command
  Helpers.runCommand(null,form,workflow.file,user,result,function(jobid,counter){
    try{
      var yaml = YAML.stringify(JSON.parse(extraVars))
      fs.writeFileSync(path.join(workflow.dir,workflow.file),yaml)
      Helpers.printCommand(`Extravars Yaml file created : ${workflow.file}`,"stdout",jobid,counter,function(){

        var command = `git commit -am "update from ansibleforms" && ${workflow.push}`
        var directory = workflow.dir

        Helpers.executeCommand({directory:directory,command:command,description:"Pushing to git",task:"Workflow push"},jobid,counter)
      })
    }catch(e){
      logger.error(e)
      Helpers.printCommand(e,"stderr",jobid,counter)
    }
  })
};
module.exports= Workflow;
