const certinfo=require("cert-info")
const restResult=require("../models/restResult.model")
const logger=require("./logger")
const {exec} = require('child_process');
const Job = require("../models/job.model")
const Helpers = require("./common")
const moment = require("moment")
var Exec = function(){

}

Exec.executeSilentCommand = (cmd,result) => {
  // a counter to order the output (as it's very fast and the database can mess up the order)
  var command = cmd.command
  var directory = cmd.directory
  var description = cmd.description
  // execute the procces
  logger.silly(`${description}, ${directory} > ${command}`)
  try{
    var child = exec(command,{cwd:directory});
    var out=""
    var err=""
    // add output eventlistener to the process to save output
    child.stdout.on('data',function(data){
      logger.silly(data)
    })
    // add error eventlistener to the process to save output
    child.stderr.on('data',function(data){
      // save the output ; but whilst saving, we quickly check the status to detect abort
      logger.silly(data)
      err+=data+"\r\n"
    })
    // add exit eventlistener to the process to handle status update
    child.on('exit',function(data){
      // if the exit was an actual request ; set aborted
      logger.debug(description + " finished : " + data)
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
Exec.endCommand = (jobid,counter,stream,status,message,next) => {
  Job.createOutput({output:message,output_type:stream,job_id:jobid,order:++counter},function(error,res){
    if(error){
      logger.error(error)
    }
    Job.update({status:status,end:moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')},jobid,function(error,res){
      if(error){
        logger.error(error)
      }
    })
    if(next)next(jobid,counter)
  })
}
Exec.executeCommand = (cmd,jobid,counter,success,failed,aborted) => {
  // a counter to order the output (as it's very fast and the database can mess up the order)
  var jobstatus = "success"
  var command = cmd.command
  var directory = cmd.directory
  var description = cmd.description
  var task = cmd.task
  // execute the procces
  logger.silly(`${description}, ${directory} > ${Helpers.logSafe(command)}`)
  try{
    var child = exec(command,{cwd:directory});

    // add output eventlistener to the process to save output
    child.stdout.on('data',function(data){
      // save the output ; but whilst saving, we quickly check the status to detect abort
      Job.createOutput({output:data,output_type:"stdout",job_id:jobid,order:++counter},function(error,status){
        if(error){
          logger.error(error)
        }else{
          // if abort request found ; kill the process
          if(status=="abort"){
            logger.warn("Abort is requested, killing child")
            process.kill(child.pid,"SIGTERM");
          }
        }
      })
    })
    // add error eventlistener to the process to save output
    child.stderr.on('data',function(data){
      // save the output ; but whilst saving, we quickly check the status to detect abort
      Job.createOutput({output:data,output_type:"stderr",job_id:jobid,order:++counter},function(error,status){
        if(error){
          logger.error(error)
        }else{
          // if abort request found ; kill the process
          if(status=="abort"){
            logger.warn("Abort is requested, killing child")
            process.kill(child.pid,"SIGTERM");
          }
        }
      })
    })
    // add exit eventlistener to the process to handle status update
    child.on('exit',function(data){
      // if the exit was an actual request ; set aborted
      if(child.signalCode=='SIGTERM'){
        Exec.endCommand(jobid,counter,"stderr","aborted",`${task} was aborted by operator`,aborted)
      }else{ // if the exit was natural; set the jobstatus (either success or failed)
        if(data!=0){
          jobstatus="failed"
          logger.error(`[${jobid}] Failed with code ${data}`)
          Exec.endCommand(jobid,counter,"stderr",jobstatus,`[ERROR]: ${task} failed with status (${data})`,failed)
        }else{
          Exec.endCommand(jobid,counter,"stdout",jobstatus,`ok: [${task} finished] with status (${data})`,success)
        }

      }

    })
    // add error eventlistener to the process; set failed
    child.on('error',function(data){
      Exec.endCommand(jobid,counter,"stderr","failed",`${task} failed : `+data,failed)
    })

  }catch(e){
    Exec.endCommand(jobid,counter,"stderr","failed",`${task} failed : `+e,failed)
  }
}
Exec.printCommand = (data,type,jobid,counter,next,abort) => {
    Job.createOutput({output:data,output_type:type,job_id:jobid,order:++counter},function(error,status){
      var aborted=false
      if(error){
        logger.error(error)
      }else{
        // if abort request found ; kill the process
        if(status=="abort" && abort){
            aborted=true
            abort(jobid,counter)
        }
      }
      if(next && !aborted)next(jobid,counter)
    })
}

module.exports = Exec
