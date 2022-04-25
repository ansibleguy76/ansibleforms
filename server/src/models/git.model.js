'use strict';
const logger=require("../lib/logger")
const path=require("path")
const {exec} = require('child_process');
var config=require('../../config/app.config')

var Git=function(){

};
var Exec=function(){}
Exec.executeSilentCommand = (cmd) => {

  return new Promise((resolve,reject)=>{
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
            reject(err)
          }else{
            resolve("Git fetch finished")
          }
      })
      // add error eventlistener to the process; set failed
      child.on('error',function(data){
        logger.error(data)
        err+=data+"\r\n"
        reject(err)
      })

    }catch(e){
      reject(e)
    }
  })

}

// run a playbook
Git.pull = function (repo) {

    var command = repo.pull
    var directory = path.join(config.repoPath,repo.dir)
    return Exec.executeSilentCommand({directory:directory,command:command,description:"Pulling from git"})

};
module.exports= Git;
