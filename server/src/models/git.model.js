'use strict';
const logger=require("../lib/logger")
const path=require("path")
const {exec} = require('child_process');
var config=require('../../config/app.config')

var Git=function(){

};
var Exec=function(){}
Exec.executeSilentCommand = (cmd,result) => {
  // a counter to order the output (as it's very fast and the database can mess up the order)
  var command = cmd.command
  var directory = cmd.directory
  var description = cmd.description
  // execute the procces
  logger.debug(`${description}, ${directory} > ${command}`)
  try{
    var child = exec(command,{cwd:directory});
    var out=""
    var err=""
    // add output eventlistener to the process to save output
    child.stdout.on('data',function(data){
      logger.debug(data)
    })
    // add error eventlistener to the process to save output
    child.stderr.on('data',function(data){
      // save the output ; but whilst saving, we quickly check the status to detect abort
      logger.debug(data)
      err+=data+"\r\n"
    })
    // add exit eventlistener to the process to handle status update
    child.on('exit',function(data){
      // if the exit was an actual request ; set aborted
      logger.info(description + " finished : " + data)
        if(data!=0){
          result(err,null)
        }else{
          result(null,"Git fetch finished")
        }
    })
    // add error eventlistener to the process; set failed
    child.on('error',function(data){
      logger.error(data)
      err+=data+"\r\n"
      result(err,null)
    })

  }catch(e){
    result(e,null)
  }
}

// run a playbook
Git.pull = function (repo, result) {

    var command = repo.pull
    var directory = path.join(config.repoPath,repo.dir)
    Exec.executeSilentCommand({directory:directory,command:command,description:"Pulling from git"},result)

};
module.exports= Git;
