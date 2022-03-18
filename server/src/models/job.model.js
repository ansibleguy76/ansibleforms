'use strict';
const https=require('https')
const axios=require('axios')
const fs=require('fs')
const path=require('path')
const YAML = require('yaml')
const moment= require('moment')
const {exec} = require('child_process');
const Helpers = require('../lib/common.js')
const logger=require("../lib/logger");
const authConfig = require('../../config/auth.config')
const appConfig = require('../../config/app.config')
const ansibleConfig = require('./../../config/ansible.config');
const mysql = require('./db.model')
const RestResult = require('./restResult.model')
const Form = require('./form.model')


const httpsAgent = new https.Agent({
  rejectUnauthorized: false
})
function getHttpsAgent(awxConfig){
  // logger.debug("config : " + awxConfig)
  return new https.Agent({
    rejectUnauthorized: !awxConfig.ignore_certs,
    ca: awxConfig.ca_bundle
  })
}


var Exec = function(){

}
// start a command with db output
Exec.executeCommand = (cmd,jobid,counter,success,failed,aborted) => {
  // a counter to order the output (as it's very fast and the database can mess up the order)
  var jobstatus = "success"
  var command = cmd.command
  var directory = cmd.directory
  var description = cmd.description
  var task = cmd.task
  // execute the procces
  logger.debug(`${description}, ${directory} > ${Helpers.logSafe(command)}`)
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
            logger.warning("Abort is requested, killing child")
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
            logger.warning("Abort is requested, killing child")
            process.kill(child.pid,"SIGTERM");
          }
        }
      })
    })
    // add exit eventlistener to the process to handle status update
    child.on('exit',function(data){
      // if the exit was an actual request ; set aborted
      if(child.signalCode=='SIGTERM'){
        Job.endJobStatus(jobid,counter,"stderr","aborted",`${task} was aborted by operator`,aborted)
      }else{ // if the exit was natural; set the jobstatus (either success or failed)
        if(data!=0){
          jobstatus="failed"
          logger.error(`[${jobid}] Failed with code ${data}`)
          Job.endJobStatus(jobid,counter,"stderr",jobstatus,`[ERROR]: ${task} failed with status (${data})`,failed)
        }else{
          Job.endJobStatus(jobid,counter,"stdout",jobstatus,`ok: [${task} finished] with status (${data})`,success)
        }

      }

    })
    // add error eventlistener to the process; set failed
    child.on('error',function(data){
      Job.endJobStatus(jobid,counter,"stderr","failed",`${task} failed : `+data,failed)
    })

  }catch(e){
    Job.endJobStatus(jobid,counter,"stderr","failed",`${task} failed : `+e,failed)
  }
}

//job stuff... interaction with job database
var Job=function(job){
    if(job.form && job.form!=""){ // first time insert
      this.form = job.form;
      this.target = job.target;
      this.user = job.user;
      this.user_type = job.user_type;
      this.job_type = job.job_type;
      this.start = moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')
      this.extravars = Helpers.logSafe(job.extravars);
      this.credentials = job.credentials
    }
    if(job.status && job.status!=""){ // allow single status update
      this.status = job.status;
    }
    if(job.end && job.end!=""){ // allow single status update
      this.end = job.end;
    }
    if(job.parent_id){
      this.parent_id=job.parent_id
    }
};
Job.create = function (record, result) {
  logger.info(`Creating job`)
  try{
    mysql.query("INSERT INTO AnsibleForms.`jobs` set ?", record, function (err, res) {
        if(err) {
            result(err, null);
        }
        else{
            result(null, res.insertId);
        }
    });
  }catch(err){
    result(err, null);
  }
};
Job.update = function (record,id, result) {
  logger.debug(`Updating job ${id}`)
  try{
    mysql.query("UPDATE AnsibleForms.`jobs` set ? WHERE id=?", [record,id], function (err, res) {
        if(err) {
            //lib/logger.error(err)
            result(err, null);
        }
        else{
            result(null, res);
        }
    });
  }catch(err){
    result(err, null);
  }
};
Job.setParentId = function (parent_id,id, result) {
  logger.debug(`Updating job ${id}`)
  try{
    mysql.query("UPDATE AnsibleForms.`jobs` set parent_id=? WHERE id=?", [parent_id,id], function (err, res) {
        if(err) {
            //lib/logger.error(err)
            result(err, null);
        }
        else{
            result(null, res);
        }
    });
  }catch(err){
    result(err, null);
  }
};
Job.endJobStatus = (jobid,counter,stream,status,message,next) => {
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
Job.printJobOutput = (data,type,jobid,counter,next,abort) => {
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
Job.abort = function (id, result) {
  logger.debug(`Updating job ${id}`)
  try{
    mysql.query("UPDATE AnsibleForms.`jobs` set status='abort' WHERE id=? AND status='running'", [id], function (err, res) {
        if(err) {
            //lib/logger.error(err)
            result(err, null);
        }
        else{
            if(res.changedRows==1){
                result(null, res);
            }else{
                result("This job cannot be aborted",null)
            }
        }
    });
  }catch(err){
    result(err, null);
  }
};
Job.createOutput = function (record, result) {
  // logger.debug(`Creating job output`)
  try{
    if(record.output){
      // insert output and return status in 1 go
      mysql.query("INSERT INTO AnsibleForms.`job_output` set ?;SELECT status FROM AnsibleForms.`jobs` WHERE id=?;", [record,record.job_id], function (err, res) {
          if(err) {
              result(err, null);
          }
          else{
            if(res.length==2){
              result(null, res[1][0].status);
            }else{
              result("Failed to get job status",null)
            }
          }
          // UPDATE AnsibleForms.`jobs` set status='running' WHERE id=?;
      });
    }else{
      // no output, just return status
      mysql.query("SELECT status FROM AnsibleForms.`jobs` WHERE id=?;", record.job_id, function (err, res) {
          if(err) {
              result(err, null);
          }
          else{
              result(null, res[0].status);
          }
          // UPDATE AnsibleForms.`jobs` set status='running' WHERE id=?;
      });
    }

  }catch(err){
    result(err, null);
  }
};
Job.delete = function(id, result){
  logger.info(`Deleting job ${id}`)
  try{
    mysql.query("DELETE FROM AnsibleForms.`jobs` WHERE id = ?;UPDATE AnsibleForms.`jobs` set parent_id = NULL WHERE parent_id = ?", [id,id], function (err, res) {
        if(err) {
            logger.error(err)
            result(err, null);
        }
        else{
            result(null, res);
        }
    });
  }catch(err){
    result(err, null);
  }
};
Job.findAll = function (user,records,result) {
    logger.info("Finding all jobs")
    var query
    if(user.roles.includes("admin")){
      query = "SELECT id,form,target,status,start,end,user,user_type,job_type,parent_id FROM AnsibleForms.`jobs` ORDER BY id DESC LIMIT " +records + ";"
    }else{
      query = "SELECT id,form,target,status,start,end,user,user_type,job_type,parent_id FROM AnsibleForms.`jobs` WHERE user=? AND user_type=? ORDER BY id DESC LIMIT " +records + ";"
    }

    try{
      mysql.query(query,[user.username,user.type], function (err, res) {
          if(err) {
              result(err, null);
          }
          else{
              result(null, res);
          }
      });
    }catch(err){
      result(err, null);
    }
};
Job.findById = function (user,id,text,result) {
    logger.info(`Finding job ${id}` )
    try{
      var query
      if(user.roles.includes("admin")){
        query = "SELECT `form`,`status`,`extravars`,`credentials`,`job_type` FROM AnsibleForms.`jobs` WHERE jobs.id=?;"
      }else{
        query = "SELECT `form`,`status`,`extravars`,`credentials`,`job_type` FROM AnsibleForms.`jobs` WHERE jobs.id=? AND user=? AND user_type=?;"
      }
      // get normal data
      mysql.query(query,[id,user.username,user.type], function (err, res) {
          if(err) {
              result(err, null);
          }else if(res.length!=1){
              result(`Job ${id} not found, or access denied`,null)
          }
          else{
            var status=res[0].status
            var form=res[0].form
            var extravars=res[0].extravars
            var credentials=res[0].credentials
            var job_type=res[0].job_type
            var output=[]
            var line
            if(res.length>0){
              // get output summary
              mysql.query("SELECT COALESCE(output,'') output,COALESCE(`timestamp`,'') `timestamp`,COALESCE(output_type,'stdout') output_type FROM AnsibleForms.`job_output` WHERE job_id=? ORDER by job_output.order;",id, function (err, res) {
                if(err) {
                    result(err, null);
                }
                else{
                  res.forEach(function(el){
                    var addedTimestamp=false
                    var output2=[]
                    var lineoutput=[]
                    var matchfound=false
                    var record = el.output.trim('\r\n').replace(/\r/g,'')
                    var lines = record.split('\n')
                    var previousformat=""
                    lines.forEach((line,i)=>{
                      matchfound=false
                      if(!text){
                        if(el.output_type=="stderr"){
                          // mark errors
                          if(line.match(/^\[WARNING\].*/g) || previousformat=="warning"){
                            previousformat="warning"
                            matchfound=true
                            line = "<span class='has-text-warning'>"+line+"</span>"
                          }else{
                            previousformat="danger"
                            matchfound=true
                            line = "<span class='has-text-danger'>"+line+"</span>"
                          }
                          lineoutput.push(line)
                        }else{
                          if(line.match(/^\[WARNING\].*/g)){
                            previousformat="warning"
                            matchfound=true
                            line = "<span class='has-text-warning'>"+line+"</span>"
                          }
                          if(line.match(/^\[ERROR\].*/g)){
                            previousformat="danger"
                            matchfound=true
                            line = "<span class='has-text-danger'>"+line+"</span>"
                          }
                          // mark play / task lines as bold
                          if(line.match(/^([A-Z\s]*)[^\*]*(\*+)$/g)){
                            previousformat=""
                            matchfound=true
                            if(i>1){
                              line = "<strong>" + line + "</strong>"
                            }else{
                              // it's a fresh line/// ansible output assumed
                              line = "\n<strong>" + line + "</strong>"
                            }
                          }

                          // mark succes lines
                          if(line.match(/^(ok): \[([^\]]*)\].*/g)){
                            matchfound=true
                            previousformat="success"
                            line = "<span class='has-text-success'>" + line + "</span>"
                          }
                          // mark change lines
                          if(line.match(/^(changed): \[([^\]]*)\].*/g)){
                            previousformat="warning"
                            matchfound=true
                            line = "<span class='has-text-warning'>" + line + "</span>"
                          }
                          // mark skip lines
                          if(line.match(/^(skipping): \[([^\]]*)\].*/g)){
                            previousformat="info"
                            matchfound=true
                            line = "<span class='has-text-info'>" + line + "</span>"
                          }
                          // if line continues on next line, give same format
                          if(!matchfound && previousformat){
                            line = `<span class='has-text-${previousformat}'>${line}</span>`
                          }
                          // summary line ?
                          if(line.match('ok=.*failed.*')){
                            matchfound=true
                            previousformat=""
                            line=line.replace(/(ok=[1-9]+[0-9]*)/g, "<span class='tag is-success'>$1</span>")
                                        .replace(/(changed=[1-9]+[0-9]*)/g, "<span class='tag is-warning'>$1</span>")
                                        .replace(/(failed=[1-9]+[0-9]*)/g, "<span class='tag is-warning'>$1</span>")
                                        .replace(/(unreachable=[1-9]+[0-9]*)/g, "<span class='tag is-warning'>$1</span>")
                                        .replace(/(skipped=[1-9]+[0-9]*)/g, "<span class='tag is-info'>$1</span>")
                          }

                          lineoutput.push(line)
                        }
                      }else{
                        lineoutput.push(line)
                      }
                    })
                    line=lineoutput.join('\n')
                    line.split('\n').forEach(function(el2,i){
                      if(el2!="" && !addedTimestamp && !text){
                        el2+=" <span class='tag is-info is-light'>"+el.timestamp+"</span>"
                        addedTimestamp=true
                      }
                      output2.push(el2)
                    })
                    output.push(output2.join("\r\n"))

                  })
                  result(null, [{form:form,status:status,extravars:extravars,credentials:credentials,job_type:job_type,output:output.join('\r\n')}]);
                }
              })
            }else{
              result(null, []);
            }
          }
      });
    }catch(err){
       logger.error(err)
       result(null,[])
    }
};
Job.promise = async function(form,formObj,user,creds,extravars,res,next){
  return new Promise(async (resolve,reject) => {
    var restResult = new RestResult("info","","","")
    Job.launch(form,formObj,user,creds,extravars,function(err,out){
      if(err){
         restResult.status = "error"
         restResult.message = "error occured launching form " + form
         restResult.data.error = err
         if(next)
           next("error " + err.toString(),null)
         reject(err.toString())
      }else{
         restResult.message = "succesfully launched form " + form
         restResult.data.output = out
         if(next)
           next(null,out)
      }
      // send response
      if(res)
        res.json(restResult);
    },()=>{
      resolve(true)
    },(err)=>{
      reject(err)
    })
  })
}
Job.launchMultistep = async function(form,steps,user,extravars,creds,jobid,success,failed){
  // create a new job in the database
  var counter=0
  var ok=0
  var failed=0
  var skipped=0
  var aborted=false
  try{
    var finalSuccessStatus=true  // multistep success from start to end ?
    var partialstatus=false      // was there a step that failed and had continue ?
    steps.reduce(     // loop promises of the steps
      async (promise,step)=>{    // we get the promise of the previous step and the new step
        return promise.then(async (previousSuccess) =>{ // we don't actually use previous success
          var result=false
          logger.notice("Running step " + step.name)
          // print title and check abort
          Job.printJobOutput(`STEP [${step.name}] ${'*'.repeat(72-step.name.length)}`,"stdout",jobid,++counter,null,()=>{
            // if abort, then step aborted flag, and change status to aborting
            aborted=true
            Job.printJobOutput(`Abort is requested`,"stderr",jobid,++counter)
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
              var ev = {...extravars}
              if(step.key && ev[step.key]){
                // logger.warning(step.key + " exists using it")
                ev = ev[step.key]
              }
              // wait the promise of step
              result= await Job.promise(form,step,user,creds,ev,null,function(err,job){
                if(err){
                  // unlikely, would mean we could not create a job
                  Job.printJobOutput(err,"stderr",jobid,++counter)
                }else{
                  // job created, set parent id
                  Job.setParentId(jobid,job.id,function(error,res){ if(error){ logger.error(error) }})
                  Job.printJobOutput(`ok: [Launched step ${step.name} with jobid '${job.id}']`,"stdout",jobid,++counter)
                }
              })
              // AWX job is done
              logger.debug("Result from step = " + result)
              // check again for abort
              Job.printJobOutput(null,null,jobid,++counter,null,()=>{
                aborted=true
                Job.printJobOutput(`Abort is requested`,"stderr",jobid,++counter)
                Job.update({status:"aborting",end:moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')},jobid,function(error,res){
                  if(error){
                    logger.error(error)
                  }
                })
              })
              ok++
              // exit step and return promise true
              return true

          }else{ // previous was not success or there was fail in other steps
            // skip this step
            skipped++
            logger.debug("skipping: step " + step.name)
            finalSuccessStatus=false
            Job.printJobOutput("skipping: [due to previous failure]","stdout",jobid,++counter)
            // fail this step
            return false
          }
        }).catch((err)=>{
          // step failed in promise - something was wrong
          failed++
          logger.error("Failed step " + step.name)
          Job.printJobOutput("[ERROR]: Failed step "+ step.name + " : " + err,"stderr",jobid,++counter)
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
      Job.printJobOutput("Failed step "+ steps[-1].name + " : " + err,"stderr",jobid,++counter)

    }).then((success)=>{ // last step success
      logger.debug("Last step => " + success)
    }).finally(()=>{ // finally create recap
      // create recap
      Job.printJobOutput(`MULTISTEP RECAP ${'*'.repeat(64)}`,"stdout",jobid,++counter)
      Job.printJobOutput(`localhost   : ok=${ok}    failed=${failed}    skipped=${skipped}`,"stdout",jobid,++counter)
      if(finalSuccessStatus){
        // if multistep was success
        if(partialstatus){
          // but a step failed with continue => mark as warning
          Job.endJobStatus(jobid,++counter,"stdout","warning","[WARNING]: Finished multistep with warnings")
        }else{
          // mark as full success
          Job.endJobStatus(jobid,++counter,"stdout","success","ok: [Finished multistep successfully]")
        }

      }else{  // no multistep success
        if(aborted){
          // if aborted mark as such
          Job.endJobStatus(jobid,++counter,"stderr","aborted","multistep was aborted")
        }else{
          // else, mark failed
          Job.endJobStatus(jobid,++counter,"stderr","failed","[ERROR]: Finished multistep with errors")
        }
      }
    })

  }catch(e){
    // a final catch for fatal errors // should not occur if properly coded
    logger.error(e)
    Job.endJobStatus(jobid,++counter,"stderr","failed",e)
  }
}
Job.launch = function(form,formObj,user,creds,extravars, result,success,failed) {
  var formObj
  if(!formObj){
    // we load it, it's an actual form
    formObj = Form.loadByName(form,user)
    if(!formObj){
      result("No such form or access denied")
      return false
    }
  }
  // console.log(formObj)
  // we have form and we have access
  var jobtype=formObj.type
  var target
  if(jobtype=="ansible"){
    target=formObj.playbook
  }
  if(jobtype=="awx"){
    target=formObj.template
  }
  if(jobtype=="git"){
    target=formObj?.repo?.file
  }
  if(jobtype=="multistep"){
    target=formObj.name
  }
  if(!target){
    result("Invalid form or step info")
    return false
  }
  // create a new job in the database
  Job.create(
    new Job({form:form,target:target,user:user.username,user_type:user.type,status:"running",job_type:jobtype,extravars:JSON.stringify(extravars),credentials:JSON.stringify(creds)}),
    async (error,jobid)=>{
      var counter=0
      if(error){
        logger.error(error)
        result(error,null)
        if(failed)failed(error)
      }else{
        logger.debug(`Job id ${jobid} is created`)
        // job created - return to client
        result(null,{id:jobid})
        // the rest is now happening in the background
        // if credentials are requested, we now get them.
        var credentials={}
        if(creds){
          for (const [key, value] of Object.entries(creds)) {
            if(value=="__self__"){
              credentials[key]={
                host:dbConfig.host,
                user:dbConfig.user,
                port:dbConfig.port,
                password:dbConfig.password
              }
            }else{
              try{
                credentials[key]=await Credential.findByName(value)
              }catch(err){
                logger.error(err)
              }

            }
          }
        }

        if(jobtype=="ansible")

          Ansible.launch(
            formObj.playbook,
            extravars,
            formObj.inventory,
            formObj.tags,
            formObj.check,
            formObj.diff,
            formObj.key,
            credentials,
            jobid,
            success,failed)
        if(jobtype=="awx"){
          Awx.launch(
            formObj.template,
            extravars,
            formObj.inventory,
            formObj.tags,
            formObj.check,
            formObj.diff,
            formObj.key,
            credentials,
            jobid,
            success,
            failed
          )
        }
        if(jobtype=="git"){
          Git.push(formObj.repo,extravars,formObj.key,jobid,success,failed)
        }
        if(jobtype=="multistep"){
          Job.launchMultistep(form,formObj.steps,user,extravars,creds,jobid,success,failed)
        }

      }
    }
  )
};
Job.relaunch = function(id,user,result){
  Job.findById(user,id,true,function(err,job){
    if(err){
      result(err)
    }else{
      if(job.length==1){
        var j=job[0]
        var extravars = {}
        if(j.extravars){
          extravars = JSON.parse(j.extravars)
        }
        if(!j.status.match(/ing$/)){
          logger.notice(`Relaunching job ${id} with form ${j.form}`)
          Job.launch(j.form,null,user,j.credentials,extravars,result)
        }else{
          result(`Job ${id} is not in a status to be relaunched (status=${j.status})`)
        }

      }
    }
  })
}
// Ansible stuff
var Ansible = function(){}
Ansible.launch=(playbook,ev,inv,tags,c,d,key,credentials,jobid,success,failed)=>{
  var counter=0 // a counter to order the output entries in the database, in case it goes fast
  var extravars={...ev}
  // ansible can have multiple inventories
  var inventory = []
  if(inv){
    inventory.push(inv) // push the main inventory
  }
  if(extravars["__inventory__"]){
      ([].concat(extravars["__inventory__"])).forEach((item, i) => {
        if(typeof item=="string"){
          inventory.push(item) // add extra inventories
        }else{
          logger.warning("Non-string inventory entry")
        }
      });
  }
  // check could be controlled from extravars
  var check = c || extravars?.__check__
  // diff could be controlled from extravars
  var diff = d || extravars?.__diff__
  if(key && ev[key]){
    extravars = extravars[key]  // only pick a part of it
  }
  // merge credentials now
  extravars = {...extravars,...credentials}
  // convert to string for the command
  extravars = JSON.stringify(extravars)
  // prepare my ansible command
  var command = `ansible-playbook -e '${extravars}'`
  inventory.forEach((item, i) => {  command += ` -i '${item}'` });
  if(tags){ command += ` -t '${tags}'` }
  if(check){ command += ` --check` }
  if(diff){ command += ` --diff` }
  command += ` ${playbook}`
  var directory = ansibleConfig.path
  var cmdObj = {directory:directory,command:command,description:"Running playbook",task:"Playbook"}

  logger.notice("Running playbook : " + playbook)
  logger.debug("extravars : " + extravars)
  logger.debug("inventory : " + inventory)
  logger.debug("check : " + check)
  logger.debug("diff : " + diff)
  logger.debug("tags : " + tags)
  // in the background, start the commands
  Exec.executeCommand(cmdObj,jobid,counter,(jobid,counter)=>{
    if(success)success()
  },(jobid,counter)=>{
    if(failed)failed("Job failed")
  },(jobid,counter)=>{
    if(failed)failed("Job was aborted")
  })
}

// awx stuff, interaction with awx
var Awx = function(){}
Awx.getConfig = require('./awx.model').getConfig
Awx.abortJob = function (id, next) {

  Awx.getConfig(function(err,awxConfig){

    if(err){
      logger.error(err)
      next(`failed to get AWX configuration`)
    }else{

      var message=""
      logger.info(`aborting awx job ${id}`)
      const axiosConfig = {
        headers: {
          Authorization:"Bearer " + awxConfig.token
        },
        httpsAgent: getHttpsAgent(awxConfig)
      }
      // we first need to check if we CAN cancel
      axios.get(awxConfig.uri + "/api/v2/jobs/" + id + "/cancel/",axiosConfig)
        .then((axiosnext)=>{
          var job = axiosnext.data
          if(job && job.can_cancel){
              logger.info(`can cancel job id = ${id}`)
              axios.post(awxConfig.uri + "/api/v2/jobs/" + id + "/cancel/",{},axiosConfig)
                .then((axiosnext)=>{
                  job = axiosnext.data
                  next(null,job)
                })
                .catch(function (error) {
                  logger.error(error.message)
                  next(`failed to abort awx job ${id}`)
                })
          }else{
              message=`cannot cancel job id ${id}`
              logger.error(message)
              next(message)
          }
        })
        .catch(function (error) {
          logger.error(error.message)
          next(`failed to abort awx job ${id}`)
        })
    }
  })
};
Awx.launch = function (template,ev,inv,tags,c,d,key,credentials,jobid,success,failed){
  var message=""
  var counter=0
  Awx.findJobTemplateByName(template, function(err, jobTemplate) {
      if (err){
        message="failed to find awx template " + template + "\n" + err
        Job.endJobStatus(jobid,++counter,"stdout","failed",message)
        failed(message)
      }else{
        logger.debug("Found jobtemplate, id = " + jobTemplate.id)
        if(inv){
          Awx.findInventoryByName(inv,function(err,inventory){
            if (err){
              message="failed to find inventory " + inv + "\n" + err
              Job.endJobStatus(jobid,++counter,"stdout","failed",message)
              failed(message)
            }else{
              logger.debug("Found inventory, id = " + inventory.id)
              Awx.launchTemplate(jobTemplate,ev,inventory,tags,c,d,key,credentials,jobid,success,failed)
            }
          })
        }else{
          logger.debug("running without inventory")
          Awx.launchTemplate(jobTemplate,ev,undefined,tags,c,d,key,credentials,jobid,success,failed)
        }
      }
  })
}
Awx.launchTemplate = function (template,ev,inventory,tags,c,d,key,credentials,jobid,success,failed) {
  var message=""
  var counter=0
  Awx.getConfig(function(err,awxConfig){

    if(err){
      logger.error(err)
      message= `failed to get AWX configuration`
      Job.endJobStatus(jobid,++counter,"stderr",status,message)
      failed(message)
    }else{
      var extravars={...ev} // we make a copy of the main extravars
      // check could be controlled from extravars
      var check = c || extravars?.__check__
      // diff could be controlled from extravars
      var diff = d || extravars?.__diff__
      if(key && ev[key]){
        extravars = extravars[key]  // only pick a part of it if requested
      }
      // merge credentials now
      extravars = {...extravars,...credentials}
      extravars = JSON.stringify(extravars)
      // prep the post data
      var postdata = {
        extra_vars:extravars,
        job_tags:tags
      }
      // inventory needs to be looked up first
      if(inventory){ postdata.inventory=inventory.id }
      if(check){ postdata.job_type="check" }
        else{ postdata.job_type="run" }
      if(diff){ postdata.diff_mode=true }
        else{ postdata.diff_mode=false }
      if(tags){ postdata.job_tags=tags }

      logger.notice("Running template : " + template.name)
      logger.info("extravars : " + extravars)
      logger.info("inventory : " + inventory)
      logger.info("check : " + check)
      logger.info("diff : " + diff)
      logger.info("tags : " + tags)
      // post
      if(template.related===undefined){
        message=`Failed to launch, no launch attribute found for template ${template.name}`
        logger.error(message)
        Job.endJobStatus(jobid,++counter,"stderr",status,message)
        failed(message)
      }else{
        // prepare axiosConfig
        const axiosConfig = {
          headers: {
            Authorization:"Bearer " + awxConfig.token
          },
          httpsAgent: getHttpsAgent(awxConfig)
        }
        logger.debug("Lauching awx with data : " + JSON.stringify(postdata))
        // launch awx job
        axios.post(awxConfig.uri + template.related.launch,postdata,axiosConfig)
          .then((axiosresult)=>{
            // get awx job (= remote job !!)
            var job = axiosresult.data
            if(job){
              logger.info(`awx job id = ${job.id}`)
              // log launch
              Job.printJobOutput(`Launched template ${template.name} with jobid ${job.id}`,"stdout",jobid,counter,(jobid,counter)=>{
                // track the job in the background
                Awx.trackJob(job,jobid,counter,
                  function(j,jobid,counter){
                    // if success, end with success
                    Job.endJobStatus(jobid,counter,"stdout","success",`Successfully completed template ${template.name}`)
                    if(success)success(true)
                  },
                  function(e,jobid,counter){
                    // if error, end with status (aborted or failed)
                    var status="failed"
                    var message=`Template ${template.name} completed with status ${e}`
                    if(e=="canceled"){
                      status="aborted"
                      message=`Template ${template.name} was aborted`
                    }
                    Job.endJobStatus(jobid,counter,"stderr",status,message)
                    if(failed)failed(message)
                  })
              })
            }else{
              // no awx job, end failed
              message=`could not launch job template ${template.name}`
              Job.endJobStatus(jobid,counter,"stderr","failed",`Failed to launch template ${template.name}`)
              if(failed)failed(message)
              logger.error(message)
            }
          })
          .catch(function (error) {
            var message=`failed to launch ${template.name}`
            if(error.response){
                logger.error(error.response.data)
                message+="\r\n" + YAML.stringify(error.response.data)
                Job.endJobStatus(jobid,counter,"stderr","success",`Failed to launch template ${template.name}. ${message}`)
                if(failed)failed(message)
            }else{
                logger.error(error)
                Job.endJobStatus(jobid,counter,"stderr","success",`Failed to launch template ${template.name}. ${error}`)
                if(failed)failed(error)
            }
          })
      }
    }
  })
};
Awx.trackJob = function (job,jobid,counter, success,failed,previousoutput) {
  Awx.getConfig(function(err,awxConfig){
    if(err){
      logger.error(err)
      failed(`failed to get AWX configuration`,jobid,counter)
    }else{
      var message=""
      logger.info(`searching for job with id ${job.id}`)
      // prepare axiosConfig
      const axiosConfig = {
        headers: {
          Authorization:"Bearer " + awxConfig.token
        },
        httpsAgent: getHttpsAgent(awxConfig)
      }
      axios.get(awxConfig.uri + job.url,axiosConfig)
        .then((axiosresult)=>{
          var j = axiosresult.data;
          if(j){
            logger.debug(`awx job status : ` + j.status)
            Awx.getJobTextOutput(job,(o)=>{
                var output=o
                // AWX has incremental output, but we always need to substract previous output
                // if previous output is part of this one, substract it (for awx output)
                if(output && previousoutput && output.indexOf(previousoutput)==0){
                  output = output.substring(previousoutput.length)
                }
                Job.printJobOutput(output,"stdout",jobid,counter,(jobid,counter)=>{
                  if(j.finished){
                    if(j.status==="successful"){
                      success(j,jobid,counter)
                    }else{
                      failed(j.status,jobid,counter)
                    }
                  }else{
                    // not finished, try again
                    setTimeout(()=>{Awx.trackJob(j,jobid,counter,success,failed,o)},1000)
                  }
                },(jobid,counter)=>{
                   Job.printJobOutput("Abort requested","stderr",jobid,counter)
                   Job.update({status:"aborting",end:moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')},jobid,function(error,res){
                     if(error){
                       logger.error(error)
                     }
                   })
                   Awx.abortJob(j.id,(error,res)=>{
                     if(error){
                       Job.endJobStatus(jobid,++counter,"stderr","failed","Abort failed \n"+error)
                     }else{
                       Job.endJobStatus(jobid,++counter,"stderr","aborted","Aborted job")
                     }
                   })
                })
            })
          }else{
            message=`could not find job with id ${job.id}`
            logger.error(message)
            failed(message,jobid,counter)
          }
        })
        .catch(function (error) {
          logger.error(error.message)
          failed(error.message)
        })
    }
  })
};
Awx.getJobTextOutput = function (job, result) {
  Awx.getConfig(function(err,awxConfig){
    if(err){
      logger.error(err)
      result(`failed to get AWX configuration`)
    }else{
      var message=""
      if(job.related===undefined){
        result(null,"")
      }else{
        // prepare axiosConfig
        const axiosConfig = {
          headers: {
            Authorization:"Bearer " + awxConfig.token
          },
          httpsAgent: getHttpsAgent(awxConfig)
        }
        axios.get(awxConfig.uri + job.related.stdout + "?format=txt",axiosConfig)
          .then((axiosresult)=>{
            var jobstdout = axiosresult.data;
            result(jobstdout)
          })
          .catch(function (error) {
            logger.error(error.message)
            result(error.message)
          })
      }
    }
  })
};
Awx.findJobTemplateByName = function (name,result) {
  Awx.getConfig(function(err,awxConfig){
    // logger.debug(awxConfig)
    if(err){
      logger.error(err)
      result(`failed to get AWX configuration`)
    }else{
      var message=""
      logger.info(`searching job template ${name}`)
      // prepare axiosConfig
      const axiosConfig = {
        headers: {
          Authorization:"Bearer " + awxConfig.token
        },
        httpsAgent: getHttpsAgent(awxConfig)
      }
      axios.get(awxConfig.uri + "/api/v2/job_templates/?name=" + encodeURI(name),axiosConfig)
        .then((axiosresult)=>{
          var job_template = axiosresult.data.results.find(function(jt, index) {
            if(jt.name == name)
              return true;
          });
          if(job_template){
            result(null,job_template)
          }else{
            message=`could not find job template ${name}`
            logger.error(message)
            result(message,null)
          }
        })
        .catch(function (error) {
          logger.error(error.message)
          result(error.message,null)
        })
    }
  })

};
Awx.findInventoryByName = function (name,result) {
  Awx.getConfig(function(err,awxConfig){

    if(err){
      logger.error(err)
      result(`failed to get AWX configuration`)
    }else{
      var message=""
      logger.info(`searching inventory ${name}`)
      // prepare axiosConfig
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false
      })
      const axiosConfig = {
        headers: {
          Authorization:"Bearer " + awxConfig.token
        },
        httpsAgent:httpsAgent
      }
      axios.get(awxConfig.uri + "/api/v2/inventories/?name=" + encodeURI(name),axiosConfig)
        .then((axiosresult)=>{
          var inventory = axiosresult.data.results.find(function(jt, index) {
            if(jt.name == name)
              return true;
          });
          if(inventory){
            result(null,inventory)
          }else{
            message=`could not find inventory ${name}`
            logger.error(message)
            result(message,null)
          }
        })
        .catch(function (error) {
          logger.error(error.message)
          result(error.message,null)
        })
    }
  })

};

// git stuff
var Git=function(){};
Git.push = function (repo,ev,key,jobid,success,failed) {
    var counter=0
    var extravars
    if(key && ev[key]){
      extravars = ev[key]  // only pick a part of it if requested
    }
    try{
      // save the extravars as file - we do this in sync, should be fast
      Job.printJobOutput(`TASK [Writing YAML to local repo] ${'*'.repeat(72-26)}`,"stdout",jobid,++counter)
      var yaml = YAML.stringify(extravars)
      fs.writeFileSync(path.join(appConfig.repoPath,repo.dir,repo.file),yaml)
      // log the save
      Job.printJobOutput(`ok: [Extravars Yaml file created : ${repo.file}]`,"stdout",jobid,++counter)
      Job.printJobOutput(`TASK [Committing changes] ${'*'.repeat(72-18)}`,"stdout",jobid,++counter)
      // start commit
      var command = `git commit --allow-empty -am "update from ansibleforms" && ${repo.push}`
      var directory = path.join(appConfig.repoPath,repo.dir)
      Exec.executeCommand({directory:directory,command:command,description:"Pushing to git",task:"Git push"},jobid,counter,(jobid,counter)=>{
        if(success)success()
      },(jobid,counter)=>{
        if(failed)failed("Job failed")
      },(jobid,counter)=>{
        if(failed)failed("Job was aborted")
      })

    }catch(e){
      logger.error(e)
      Job.endJobStatus(jobid,counter,"stderr","failed",e)
      if(failed)failed(e)
    }
};
module.exports= Job;
