'use strict';
import axios from 'axios';
import fs from 'fs';
import yaml from 'yaml';
import moment from 'moment';
import { exec } from 'child_process';
import Helpers from '../lib/common.js';
import Errors from '../lib/errors.js';
import Settings from './settings.model.js';
import logger from "../lib/logger.js";
import ansibleConfig from '../../config/ansible.config.js';
import loggerConfig from '../../config/log.config.js';
import dbConfig from '../../config/db.config.js';
import appConfig from '../../config/app.config.js';
import Repository from './repository.model.js';
import mysql from './db.model.js';
import Form from './form.model.js';
import Credential from './credential.model.js';
import AwxModel from './awx.model.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


function pushForminfoToExtravars(formObj,extravars,creds={}){
  // push top form fields to extravars
  // change in 4.0.16 => easier to process & available in playbook, might be handy
  // no credentials added here, because then can also come from asCredential property and these would get lost.
  const topFields=['template','awx','playbook','tags','limit','executionEnvironment','check','diff','verbose','keepExtravars','credentials','inventory','awxCredentials','ansibleCredentials','vaultCredentials','instanceGroups','scmBranch']
  for (const fieldName of topFields) {
    // Check if the field exists in formObj and if the property is not present in extravars
    if (formObj.hasOwnProperty(fieldName) && extravars[`__${fieldName}__`] === undefined) {
      extravars[`__${fieldName}__`] = formObj[fieldName];
    }
  }
  // console.log(creds)
  extravars['__credentials__']={...extravars['__credentials__'],...creds}
  // console.log(extravars)
}
function delay(t, v) {
    return new Promise(resolve => setTimeout(resolve, t, v));
}

function getTimestamp(){
  return moment.utc(Date.now()).format('YYYY-MM-DD HH:mm:ss')
}

var Exec = function(){}
// start a command with db output
Exec.executeCommand = (cmd,jobid,counter) => {
  // a counter to order the output (as it's very fast and the database can mess up the order)
  var jobstatus = "success"
  var command = cmd.command
  var directory = cmd.directory
  var description = cmd.description
  var extravars = cmd.extravars
  var hiddenExtravars = cmd.hiddenExtravars
  var extravarsFileName = cmd.extravarsFileName
  var hiddenExtravarsFileName = cmd.hiddenExtravarsFileName
  var keepExtravars = cmd.keepExtravars
  var task = cmd.task
  const ac = new AbortController()

  // execute the procces
  return new Promise((resolve,reject)=>{
    logger.debug(`${description}, ${directory} > ${Helpers.logSafe(command)}`)
    try{


      if(extravarsFileName){
        logger.debug(`Storing extravars to file ${extravarsFileName}`)
        var filepath=path.join(directory,extravarsFileName)
        fs.writeFileSync(filepath,extravars) 

        logger.debug(`Storing hidden extravars to file ${hiddenExtravarsFileName}`)
        var he_filepath=path.join(directory,hiddenExtravarsFileName)
        fs.writeFileSync(he_filepath,hiddenExtravars)         
      }else{
        logger.warning("No filename was given")
      }

      // adding abort signal
      var child = exec(command,{cwd:directory,signal:ac.signal,maxBuffer:appConfig.processMaxBuffer,encoding: "UTF-8"});

      // capture the abort event, logging only
      ac.signal.addEventListener('abort', (event) => {
        logger.warning("Operator aborted the process")
      }, { once: true });

      // add output eventlistener to the process to save output
      child.stdout.on('data',function(data){
        // save the output ; but whilst saving, we quickly check the status to detect abort
        Job.createOutput({output:data,output_type:"stdout",job_id:jobid,order:++counter})
          .then((abort_requested)=>{
            // if abort request found ; kill the process
            if(abort_requested){
              logger.warning("Abort is requested, aborting child")
              ac.abort("Aborted by operator")
            }
          })
          .catch((error)=>{logger.error("Failed to create output : ", error)})
      })
      // add error eventlistener to the process to save output
      child.stderr.on('data',async function(data){
        // save the output ; but whilst saving, we quickly check the status to detect abort
        try {
          const abort_requested = await Job.createOutput({output:data,output_type:"stderr",job_id:jobid,order:++counter});
          // if abort request found ; kill the process
          if(abort_requested){
            logger.warning("Abort is requested, aborting child")
            ac.abort("Aborted by operator")
          }
        } catch (error) {
          logger.error("Failed to create output: ", error)
        }
      })



      // add exit eventlistener to the process to handle status update
      child.on('exit',async function(data){
        // if the exit was an actual request ; set aborted
        if(child.signalCode=='SIGTERM'){
          const abort_requested = await Job.isAbortRequested(jobid)    
          if(abort_requested){    
            await Job.resetAbortRequested(jobid) // reset the abort requested flag
            await Job.endJobStatus(jobid,++counter,"stderr","aborted",`${task} was aborted by the operator`)
            reject(`${task} was aborted by the operator`)
          }else{
            await Job.endJobStatus(jobid,++counter,"stderr","failed",`${task} was aborted by the main process.  Likely some buffer or memory error occured.  Also check the maxBuffer option.`)
            reject(`${task} was aborted by the main process`)
          }
        }else{ // if the exit was natural; set the jobstatus (either success or failed)
          if(data!=0){
            jobstatus="failed"
            logger.error(`[${jobid}] Failed with code ${data}`)
            await Job.endJobStatus(jobid,++counter,"stderr",jobstatus,`[ERROR]: ${task} failed with status (${data})`)
            reject(`${task} failed with status (${data})`)
          }else{
            await Job.endJobStatus(jobid,++counter,"stdout",jobstatus,`ok: [${task} finished] with status (${data})`)
            resolve(true)
          }
        }
        if(extravarsFileName && !keepExtravars){
          logger.debug(`Removing extavars file ${filepath}`)
          fs.unlinkSync(filepath)    
        }
        if(hiddenExtravarsFileName){
          fs.unlinkSync(he_filepath) 
        }
             
      })
      // add error eventlistener to the process; set failed
      child.on('error',async function(data){
        await Job.endJobStatus(jobid,++counter,"stderr","failed",`${task} failed : `+data)
      })

    }catch(e){
      Job.endJobStatus(jobid,++counter,"stderr","failed",`${task} failed : `+e)
      reject()
    }
  })
}
//job stuff... interaction with job database
var Job=function(job){
    if(job.form && job.form!=""){ // first time insert
      this.form = job.form;
      this.target = job.target;
      this.user = job.user;
      this.user_type = job.user_type;
      this.job_type = job.job_type;
      this.start = getTimestamp();
      this.extravars = job.extravars;
      this.credentials = job.credentials;
      this.notifications = job.notifications;
    }
    if(job.step && job.step!=""){ // allow single step update
      this.step = job.step
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
Job.create = async function (record) {
  // create job
  logger.notice(`Creating job`)
  const res = await mysql.do("INSERT INTO AnsibleForms.`jobs` set ?", record)
  return res.insertId
};
Job.abandon = async function (all=false) {
  // abandon jobs
  logger.notice(`Abandoning jobs`)
  var sql = "UPDATE AnsibleForms.`jobs` set status='abandoned',abort_requested=0 where (status='running' or abort_requested) " // remove all jobs
  if(!all){
    sql = sql + "and (start >= (NOW() - INTERVAL 1 DAY))" // remove jobs that are 1 day old
  }
  const res = await mysql.do(sql)
  return res.changedRows
};
Job.resetAbortRequested = async function (id) {
  logger.debug(`Resetting abort requested for job ${id}`)
  const res = await mysql.do("UPDATE AnsibleForms.`jobs` set abort_requested=0 WHERE id=?", [id])
}

Job.update = async function (record,id) {
  logger.notice(`Updating job ${id} -> status=${record.status}`)
  try{
    await mysql.do("UPDATE AnsibleForms.`jobs` set ? WHERE id=?", [record,id])
  }catch(error){
    logger.error("Failed to update job",error)
  }
};
Job.endJobStatus = async (jobid,counter,stream,status,message,awx_artifacts={}) => {
  // logger.error("------------------------------+++++++++++++++++++++++++++++++----------------------")
  // logger.error(`jobid = ${jobid} ; counter = ${counter} ; status = ${status} ; message = ${message}`)
  // logger.error("------------------------------+++++++++++++++++++++++++++++++----------------------")
  try{
    await Job.createOutput({output:message,output_type:stream,job_id:jobid,order:counter})
    await Job.update({status:status,end:getTimestamp(),awx_artifacts:JSON.stringify(awx_artifacts)},jobid)
    return await Job.sendStatusNotification(jobid)
  }catch(error){
    logger.error("Failed to create joboutput.", error)
  }
}
Job.printJobOutput = async(data,type,jobid,counter,incrementIssue) => {
    if(incrementIssue){
      await Job.deleteOutput({job_id:jobid})
    }
    return await Job.createOutput({output:data,output_type:type,job_id:jobid,order:counter})
}
Job.isAbortRequested = async function(id){
  const res = await mysql.do("SELECT abort_requested FROM AnsibleForms.`jobs` WHERE id=?;", [id])
  return !!res[0].abort_requested
}
Job.abort = async function (id) {
  logger.notice(`Aborting job ${id}`)
  const abort_requested = await Job.isAbortRequested(id)
  if(abort_requested){
    throw new Errors.ConflictError("Abort already requested for this job")
  }
  const res = await mysql.do("UPDATE AnsibleForms.`jobs` set abort_requested=1 WHERE id=? AND status='running'", [id])
  if(res.changedRows==1){
      return res
  }else{
      throw new Errors.ConflictError("This job was not running")
  }
};
Job.deleteOutput = async function (record) {
  // delete last output
  await mysql.do("DELETE FROM AnsibleForms.`job_output` WHERE job_id=? ORDER BY `order` DESC LIMIT 1", [record.job_id])
};
Job.createOutput = async function (record) {
  // logger.debug(`Creating job output`)
  if(record.output){
    // insert output and return status in 1 go
    const check = await Job.checkExists(record.job_id)
    const dummy = await mysql.do("INSERT INTO AnsibleForms.`job_output` set ?;", [record])
  }
  return await Job.isAbortRequested(record.job_id)
};
Job.delete = async function(id){
  logger.notice(`Deleting job ${id}`)
  return await mysql.do("DELETE FROM AnsibleForms.`jobs` WHERE id = ? OR parent_id = ?", [id,id])
}
Job.checkExists = async function(id){
  const res = await mysql.do("SELECT id FROM AnsibleForms.`jobs` WHERE id = ?", [id])
  if(res.length==1){
    return
  }else{
    throw new Errors.NotFoundError(`Job ${id} not found`)
  }
}
Job.findAll = async function (user,records) {
    logger.info("Finding all jobs")
    var query
    if(user.roles.includes("admin") || user.options?.showAllJobLogs){
      query = "SELECT id,form,target,status,CONVERT_TZ(start, 'UTC', '"+ loggerConfig.tz +"') AS start,CONVERT_TZ(end, 'UTC', '"+ loggerConfig.tz +"') AS end,user,user_type,job_type,parent_id,approval FROM AnsibleForms.`jobs` ORDER BY id DESC LIMIT " +records + ";"
    }else{
      query = "SELECT id,form,target,status,CONVERT_TZ(start, 'UTC', '"+ loggerConfig.tz +"') AS start,CONVERT_TZ(end, 'UTC', '"+ loggerConfig.tz +"') AS end,user,user_type,job_type,parent_id,approval FROM AnsibleForms.`jobs` WHERE (user=? AND user_type=?) OR (status='approve') ORDER BY id DESC LIMIT " +records + ";"
    }
    return await mysql.do(query,[user.username,user.type],true)
};
Job.findApprovals = async function (user) {
    logger.debug("Finding all approval jobs")
    var count=0
    var query = "SELECT approval FROM AnsibleForms.`jobs` WHERE status='approve' AND approval IS NOT NULL;"
    const res = await mysql.do(query,undefined,true)

    if(user.roles.includes("admin")){
      return res.length
    }else{
      res.forEach((item, i) => {
        //
        var matches = item.approval.match(/\"roles\":\[([^\]]*)\]/)[1].replaceAll('"','').split(",").filter(x=>user.roles.includes(x))
        if(matches.length>0)count++
      });
      return count
    }

};
Job.findById = async function (user,id,asText,logSafe=false) {
    logger.info(`Finding job ${id}` )
    var query
    var params
    const check = await Job.checkExists(id)
    if(user.roles.includes("admin")){
      query = "SELECT j.*,sj.subjobs,j2.no_of_records,o.counter FROM AnsibleForms.jobs j LEFT JOIN (SELECT parent_id,GROUP_CONCAT(id separator ',') subjobs FROM AnsibleForms.jobs GROUP BY parent_id) sj ON sj.parent_id=j.id,(SELECT COUNT(id) no_of_records FROM AnsibleForms.jobs)j2,(SELECT max(`order`)+1 counter FROM AnsibleForms.job_output WHERE job_output.job_id=?)o WHERE j.id=?;"
      params = [id,id,user.username,user.type]
    }else{
      query = "SELECT j.*,sj.subjobs,j2.no_of_records,o.counter FROM AnsibleForms.jobs j LEFT JOIN (SELECT parent_id,GROUP_CONCAT(id separator ',') subjobs FROM AnsibleForms.jobs GROUP BY parent_id) sj ON sj.parent_id=j.id,(SELECT COUNT(id) no_of_records FROM AnsibleForms.jobs WHERE user=? AND user_type=?)j2,(SELECT max(`order`)+1 counter FROM AnsibleForms.job_output WHERE job_output.job_id=?)o WHERE j.id=? AND ((j.user=? AND j.user_type=?) OR (j.status='approve'));"
      params = [user.username,user.type,id,id,user.username,user.type]
    }
    // get normal data
    try{
      var res = await mysql.do(query,params,true)

      if(res.length!=1){
          throw new Errors.AccessDeniedError(`You do not have access to job ${id}`)
      }
      var job = res[0]
      // convert artifacts
      job.awx_artifacts = JSON.parse(job.awx_artifacts || "{}")
      // mask passwords
      if(logSafe) job.extravars=Helpers.logSafe(job.extravars)
      // get output summary
      res = await mysql.do(
        `SELECT 
          COALESCE(output,'') output,
          COALESCE(CONVERT_TZ(\`timestamp\`, 'UTC', '${loggerConfig.tz}'), '') \`timestamp\`,
          COALESCE(output_type,'stdout') output_type 
        FROM AnsibleForms.\`job_output\` 
        WHERE job_id=? 
        ORDER BY job_output.order;`,
        id,
        true
      )
      return {...job,...{output:Helpers.formatOutput(res,asText)}}

    }catch(err){
      logger.error("Error : ", err)
      return []
    }
};
Job.launch = async function(form,formObj,user,creds,extravars,parentId=null,next,async=false) {

  // a formobj can be a full step pushed
  if(!formObj){
    // we load it, it's an actual form
    const formConfig = await Form.load(user?.roles,form)
    if(formConfig.forms.length==0){
      throw new Errors.NotFoundError(`No such form '${form}'`)
    }
    formObj = formConfig.forms[0] // we take the first one, as it should be the only one
  }

  pushForminfoToExtravars(formObj,extravars,creds)

  // we have form and we have access
  var notifications=formObj.notifications || {}
  var jobtype=formObj.type
  var target=formObj.name

  if(!target){
    throw new Errors.ConflictError("Invalid form or step info")
  }

  // create a new job in the database
  // if reuseId is passed, we don't create a new job and continue the existing one (for approve)
  logger.notice(`Launching form ${form}`)
  var jobid
  try{
    jobid = await Job.create(new Job({form:form,target:target,user:user.username,user_type:user.type,status:"running",job_type:jobtype,parent_id:parentId,extravars:JSON.stringify(extravars),credentials:JSON.stringify(creds),notifications:JSON.stringify(notifications)}))
  }catch(err){
    logger.error("Failed to create job",err)
    throw new Errors.ApiError(`Failed to create job for form ${form} : ${err.message}`)
  }

  logger.debug(`Job id ${jobid} is created`)
  extravars["__jobid__"]=jobid
  // job created - return to client
  if(next && !async)
    next({id:jobid})

  // the rest is now happening in the background
  // if credentials are requested, we now get them.
  var credentials={}

  // perhaps credentials were passed through extravars, they have precedence over the others !
  try{
    const afCreds = extravars.__credentials__ || creds || {}
    if(afCreds){
      for (const [key, value] of Object.entries(afCreds)) {

        if(value=="__self__"){
          credentials[key]={
            host:dbConfig.host,
            user:dbConfig.user,
            port:dbConfig.port,
            password:dbConfig.password
          }
        }else{
          logger.notice(`found cred for key ${key}`)

          // if it were AF credentials, we get the credential now
          try{
            
            if (value.includes(',')) {
              // If value contains a comma, split it and call with two parameters
              const [part1, part2] = value.split(',').map(val => val.trim());
              credentials[key] = await Credential.findByName(part1, part2);
            } else {
              // If no comma, call with one parameter
              credentials[key] = await Credential.findByName(value)
            }
          }catch(err){
            logger.error("Cannot get credential." + err)
          }

        }
      }
    }
  }catch(err){
    var message = `Failed to process credentials : ${err.message}`
    logger.error(message)
  }

  if(jobtype=="ansible"){
    return await Ansible.launch(
      extravars,
      credentials,
      jobid,
      null,
      (parentId)?null:formObj.approval // if multistep: no individual approvals checks
    )
  }
  if(jobtype=="awx"){
    return await Awx.launch(
      extravars,
      credentials,
      jobid,
      null,
      (parentId)?null:formObj.approval, // if multistep: no individual approvals checks,
      null,
      notifications
    )
  }
  if(jobtype=="multistep"){
    return await Multistep.launch(
      form,
      formObj.steps,
      user,
      extravars,
      creds,
      jobid,
      null,
      formObj.approval
    )
  }

};
Job.continue = async function(form,user,creds,extravars,jobid,next) {
  var formObj
  // we load it, it's an actual form
  const check = await Job.checkExists(jobid)
  const formConfig = await Form.load(user?.roles,form)
  if(formConfig.forms.length==0){
    throw new Errors.NotFoundError(`No such form '${form}'`)
  }
  formObj = formConfig.forms[0] // we take the first one, as it should be the only one

  pushForminfoToExtravars(formObj,extravars,creds)
  extravars["__jobid__"]=jobid

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
  if(jobtype=="multistep"){
    target=formObj.name
  }
  if(!target){
    // throw "Invalid form or step info"
    throw new Errors.ConflictError("Invalid form or step info")
  }
  const job = await Job.findById(user,jobid,true)

  var step=job.step
  var counter=job.counter
  await Job.printJobOutput(`changed: [approved by ${user.username}]`,"stdout",jobid,++counter)
  await Job.update({status:"running"},jobid)

  next({id:jobid}) // continue result for feedback

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
          if (value.includes(',')) {
            // If value contains a comma, split it and call with two parameters (fall back credential)
            const parts = value.split(',').map(val => val.trim());
            credentials[key] = await Credential.findByName(parts[0], parts[1]);
          } else {
            // If no comma, call with one parameter
            credentials[key] = await Credential.findByName(value)
          }
        }catch(err){
          logger.error("Failed to find credentials by name : ", err)
        }
      }
    }
  }

  if(jobtype=="ansible"){
    return await Ansible.launch(
      extravars,
      credentials,
      jobid,
      ++counter,
      formObj.approval,
      true
    )
  }
  if(jobtype=="awx"){
    return await Awx.launch(
      extravars,
      credentials,
      jobid,
      ++counter,
      formObj.approval,
      true
    )
  }
  if(jobtype=="multistep"){
    return await Multistep.launch(form,formObj.steps,user,extravars,creds,jobid,++counter,formObj.approval,step,true)
  }

};
Job.relaunch = async function(user,id,verbose,next){

  const job = await Job.findById(user,id,true)
  var extravars = {}
  var credentials = {}
  if(job.extravars){
    extravars = JSON.parse(job.extravars)
  }
  if(verbose){
    extravars["__verbose__"]=true
  }
  if(job.credentials){
    credentials = JSON.parse(job.credentials)
  }
  if(job.status!="running" && !job.abort_requested){
    logger.notice(`Relaunching job ${id} with form ${job.form}`)
    await Job.launch(job.form,null,user,credentials,extravars,null,(out)=>{
      next(out)
    })
  }else{
    throw new Errors.ConflictError(`Job ${id} is not in a status to be relaunched (status=${job.status})`)
  }


}
Job.approve = async function(user,id,next){

  const job = await Job.findById(user,id,true)

  var approval=JSON.parse(job.approval)
  if(approval){
    var access = approval?.roles.filter(role => user?.roles?.includes(role))
    if(access?.length>0 || user?.roles?.includes("admin")){
      logger.notice(`Approve allowed for user ${user.username}`)
    }else {
      logger.warning(`Approve denied for user ${user.username}`)
      throw new Errors.AccessDeniedError(`Approve denied for user ${user.username}`)
    }
  }
  var extravars = {}
  var credentials = {}
  if(job.extravars){
    extravars = JSON.parse(job.extravars)
  }
  if(job.credentials){
    credentials = JSON.parse(job.credentials)
  }
  if(job.status=="approve"){
    logger.notice(`Approving job ${id} with form ${job.form}`)
    await Job.continue(job.form,user,credentials,extravars,id,(job)=>{
        next(job)
    })
    .catch((err)=>{logger.error("Failed to continue the job : ", err)})
  }else{
    throw new Errors.ConflictError(`Job ${id} is not in approval status (status=${job.status})`)
  }

}
Job.sendApprovalNotification = async function(approval,extravars,jobid){
  if(!approval?.notifications?.length>0)return false
  try{
    const config = await Settings.findUrl()
    const url = config.url?.replace(/\/$/g,'') // remove trailing slash if present

    var subject = Helpers.replacePlaceholders(approval.title,extravars) || "AnsibleForms Approval Request"
    var buffer = fs.readFileSync(`${__dirname}/../templates/approval.html`)
    var message = buffer.toString()
    var color = "#158cba"
    var color2 = "#ffa73b"
    var logo = `${url}/assets/img/logo.png`
    var approvalMessage = Helpers.replacePlaceholders(approval.message,extravars)
    message = message.replace("${message}",approvalMessage)
                    .replaceAll("${url}",url)
                    .replaceAll("${jobid}",jobid)
                    .replaceAll("${title}",subject)
                    .replaceAll("${logo}",logo)
                    .replaceAll("${color}",color)
                    .replaceAll("${color2}",color2)
    const messageid = await Settings.mailsend(approval.notifications.join(","),subject,message)
    logger.notice("Approval mail sent to " + approval.notifications.join(",") + " with id " + messageid)
  }catch(err){
    logger.error("Failed : ", err)
  }
}
Job.sendStatusNotification = async function(jobid){
  try{
    logger.notice(`Sending status mail for jobid ${jobid}`)
    var user={
      roles:["admin"]
    }

    const job = await Job.findById(user,jobid,false,true)  // first get job
    var notifications=JSON.parse(job.notifications) // get notifications if any
    if(notifications && notifications.on){
      logger.warning("Deprecated property 'on'.  Use 'onStatus' instead.  This property will be removed in future versions.")
    }
    if(notifications && !notifications.on && !notifications.onStatus){
      notifications.onStatus=['any']
    }
    if(!notifications.recipients){
      logger.notice("No notifications set")
      return false
    }else if(!notifications.on?.includes(job.status) && !notifications.on?.includes("any") && !notifications.onStatus?.includes(job.status) && !notifications.onStatus?.includes("any")){
      logger.notice(`Skipping notification for status ${job.status}`)
      return false
    }else{
      // we have notifications, correct status => let's send the mail
      const config = await Settings.findUrl()
      const url = config.url?.replace(/\/$/g,'') // remove trailing slash if present

      if(!url){
        logger.warning(`Host URL is not set, no status mail can be sent. Go to 'settings' to correct this.`)
        return false
      }
      var subject = `AnsibleForms '${job.form}' [${job.job_type}] (${jobid}) - ${job.status} `
      var buffer = fs.readFileSync(`${__dirname}/../templates/jobstatus.html`)
      var message = buffer.toString()
      var color = "#158cba"
      var color2 = "#ffa73b"
      var logo = `${url}/assets/img/logo.png`
      message = message.replace("${message}",job.output.replaceAll("\r\n","<br>"))
                      .replaceAll("${url}",url)

                      .replaceAll("${jobid}",jobid)
                      .replaceAll("${title}",subject)
                      .replaceAll("${logo}",logo)
                      .replaceAll("${color}",color)
                      .replaceAll("${color2}",color2)
      const messageid = await Settings.mailsend(notifications.recipients.join(","),subject,message)

      if(!messageid){
        logger.notice("No status mail sent")
      } else {
        logger.notice("Status mail sent with id " + messageid)
      }
    }
  }catch(err){
    logger.error("Failed : ", err)
  }
    
}
Job.reject = async function(user,id){

  const job = await Job.findById(user,id,true)

  var approval=JSON.parse(job.approval)
  if(approval){
    var access = approval?.roles.filter(role => user?.roles?.includes(role))
    if(access?.length>0 || user?.roles?.includes("admin")){
      logger.notice(`Reject allowed for user ${user.username}`)
    }else {
      logger.warning(`Reject denied for user ${user.username}`)
      throw new Errors.AccessDeniedError(`Reject denied for user ${user.username}`)
    }
  }
  var counter=job.counter
  if(job.status=="approve"){
    logger.notice(`Rejecting job ${id} with form ${job.form}`)
    await Job.printJobOutput(`changed: [rejected by ${user.username}]`,"stderr",id,++counter)
    return await Job.update({status:"rejected",end:getTimestamp()},id)
  }else{
    throw new Errors.ConflictError(`Job ${id} is not in rejectable status (status=${job.status})`)
  }


}
// Multistep stuff
var Multistep = function(){}

Multistep.launch = async function(form,steps,user,extravars,creds,jobid,counter,approval,fromStep,approved=false){
  // create a new job in the database
  if(!counter){
    counter=0
  }else{
    counter++
  }
  // global approval
  if(!fromStep && approval){
    if(!approved){
      await Job.sendApprovalNotification(approval,extravars,jobid)
      await Job.printJobOutput(`APPROVE [${form}] ${'*'.repeat(69-form.length)}`,"stdout",jobid,++counter)
      await Job.update({status:"approve",approval:JSON.stringify(approval),end:getTimestamp()},jobid)
      return true

    }else{
      logger.notice("Continuing multistep " + form + " it has been approved")
      // reset flag for steps
      approved=false
    }
  }
  var ok=0
  var failed=0
  var skipped=0
  var abort_requested=false

  try{
    var finalSuccessStatus=true  // multistep success from start to end ?
    var partialstatus=false      // was there a step that failed and had continue ?
    var approve=false            // flag to halt at approval
    for await (const step of steps){
        try{

          // HANDLE SKIPPING --------------------------------
          // console.log("fromstep : " + fromStep)
          if(fromStep && fromStep!=step.name){
            // Job.printJobOutput(`STEP [${step.name}] ${'*'.repeat(72-step.name.length)}`,"stdout",jobid,++counter)
            // Job.printJobOutput(`skipped: due to continue`,"stdout",jobid,++counter)
            logger.info("Skipping step " + step.name + " - in continue phase")
            // skipped++
            continue // next step
          }
          // reset from step
          fromStep=undefined
          if(approve && !approved){
            // Job.printJobOutput(`STEP [${step.name}] ${'*'.repeat(72-step.name.length)}`,"stdout",jobid,++counter)
            // Job.printJobOutput(`skipped: due to approval`,"stdout",jobid,++counter)
            logger.info("Skipping step " + step.name + " due to approval")
            // skipped++
            continue
          }
          if(step.ifExtraVar && extravars[step.ifExtraVar]!==true){
            await Job.printJobOutput(`STEP [${step.name}] ${'*'.repeat(72-step.name.length)}`,"stdout",jobid,++counter)
            await Job.printJobOutput(`skipped: due to condition`,"stdout",jobid,++counter)
            logger.info("Skipping step " + step.name + " due to condition")
            skipped++
            continue
          }
          // ------- SKIPPING HANDLED -----------------------
          logger.notice("Running step " + step.name)
          await Job.update({step:step.name,status:"running"},jobid)
  
          // set step in parent
          // if this step has an approval
          if(step.approval){
            if(!approved){
              logger.notice("Approve needed for " + step.name)
              await Job.sendApprovalNotification(step.approval,extravars,jobid)
              await Job.printJobOutput(`APPROVE [${step.name}] ${'*'.repeat(69-step.name.length)}`,"stdout",jobid,++counter)
              try{
                await Job.update({status:"approve",approval:JSON.stringify(step.approval),end:getTimestamp()},jobid)
              }catch(error){
                logger.error("Failed to update job", error)
              }
              approve=true // set approve flag
              continue // complete this step
            }else{
              approved=false // approved is done, reset approved flag
            }
          }
          // print title of new step and check abort
          var abort_requested = await Job.printJobOutput(`STEP [${step.name}] ${'*'.repeat(72-step.name.length)}`,"stdout",jobid,++counter)

            // if aborted is requested, stop the flow
          if(abort_requested){
              skipped++
              logger.debug("skipping: step " + step.name)
              finalSuccessStatus=false
              await Job.printJobOutput("skipping: [Abort is requested]","stdout",jobid,++counter)
              // fail this step
              continue
          } // fail step due to abort
          else{
              // if the previous steps were ok (or failed with continue) OR step has always:true
              if(finalSuccessStatus || step.always){
                  // filter the extravars with "key"
                  var ev = {...extravars}
                  // steps can have a key, we then take a partial piece of the extravars to send to the step
                  if(step.key && ev[step.key]){
                    // logger.warning(step.key + " exists using it")
                    ev = ev[step.key]
                    // we copy the user profile in the step data
                    ev.ansibleforms_user = extravars.ansibleforms_user
                  }
                  // wait the promise of step
                  if(!finalSuccessStatus){
                    await Job.printJobOutput(`ALWAYS step ${step.name}`,"stdout",jobid,++counter)
                  }
                  var jobSuccess = await Job.launch(form,step,user,creds,ev,jobid,function(job){
                      Job.printJobOutput(`ok: [Launched step ${step.name} with jobid '${job.id}']`,"stdout",jobid,++counter)
                  })
                  if(!jobSuccess){
                    throw new Errors.ApiError(`Check the step-logs for jobid '${jobid}' for more information`)
                  }
                  // job was success
                  ok++
                  continue
              }else{ // previous was not success or there was fail in other steps
                // skip this step
                skipped++
                logger.debug("skipping: step " + step.name)
                finalSuccessStatus=false
                await Job.printJobOutput("skipping: [due to previous failure]","stdout",jobid,++counter)
                // fail this step
                continue
              }
          }
        }catch(error){
          // step failed - something was wrong
          failed++
          logger.error("Failed step " + step.name + " : ",error)
          await Job.printJobOutput("[ERROR]: Failed step "+ step.name + " : " + error.message,"stderr",jobid,++counter)
          // if continue, we mark partial and mark as success
          if(step.continue){
            await Job.printJobOutput(`CONTINUE on failure`,"stdout",jobid,++counter)
            partialstatus=true
            continue
          }else{  // no continue, we fail the multistep
            finalSuccessStatus=false
            continue
          }          
        }
    }

    // create recap
    if(!approve){
      await Job.printJobOutput(`MULTISTEP RECAP ${'*'.repeat(64)}`,"stdout",jobid,++counter)
      await Job.printJobOutput(`localhost   : ok=${ok}    failed=${failed}    skipped=${skipped}`,"stdout",jobid,++counter)
      if(finalSuccessStatus){
        // if multistep was success
        if(partialstatus){
          // but a step failed with continue => mark as warning
          await Job.endJobStatus(jobid,++counter,"stdout","warning","[WARNING]: Finished multistep with warnings")
        }else{
          // mark as full success
          await Job.endJobStatus(jobid,++counter,"stdout","success","ok: [Finished multistep successfully]")
        }

      }else{  // no multistep success
        if(abort_requested){
          // if aborted mark as such
          await Job.resetAbortRequested(jobid)
          await Job.endJobStatus(jobid,++counter,"stderr","aborted","multistep was aborted")
        }else{
          // else, mark failed
          await Job.endJobStatus(jobid,++counter,"stderr","failed","[ERROR]: Finished multistep with errors")
        }
      }
    }
  }catch(err){
    logger.error("Error in multistep, this should not happen : ",err)
  }
}
// Ansible stuff
var Ansible = function(){}
Ansible.launch=async (ev,credentials,jobid,counter,approval,approved=false)=>{
  if(!counter){
    counter=0
  }else{
    counter++
  }

  // we make a copy, we don't want to mutate the original
  var extravars={...ev}
  // ansible can have multiple inventories
  var inventory = []
  var invent = extravars?.__inventory__
  if(invent){
    inventory.push(invent) // push the main inventory
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
  
  var playbook = extravars?.__playbook__ 
  var tags = extravars?.__tags__ || ""
  var check = extravars?.__check__ || false
  var verbose = extravars?.__verbose__ || false  
  var limit = extravars?.__limit__ || ""
  var keepExtravars = extravars?.__keepExtravars__ || false    
  var diff = extravars?.__diff__ || false  
  var ansibleCredentials = extravars?.__ansibleCredentials__ || ""  
  var vaultCredentials = extravars?.__vaultCredentials__ || ""
  if(approval){
    if(!approved){
      await Job.sendApprovalNotification(approval,ev,jobid)
      await Job.printJobOutput(`APPROVE [${playbook}] ${'*'.repeat(69-playbook.length)}`,"stdout",jobid,++counter)
      await Job.update({status:"approve",approval:JSON.stringify(approval),end:getTimestamp()},jobid)
      return true
    }else{
      logger.notice("Continuing ansible " + playbook + " it has been approved")
    }
  }
  // merge credentials now
  extravars = {...extravars,...credentials}
  // convert to string for the command
  extravars = JSON.stringify(extravars)
  // define hiddenExtravars
  var hiddenExtravars={}
  try{
    if(ansibleCredentials){ 
      const runCredential = await Credential.findByName(ansibleCredentials)
      hiddenExtravars.ansible_user = runCredential.user
      hiddenExtravars.ansible_password = runCredential.password
    }
    // convert to string for the command
    hiddenExtravars = JSON.stringify(hiddenExtravars)  
  }catch(err){
    logger.error("Failed to get ansible credentials : ",err)
    await Job.endJobStatus(jobid,++counter,"stderr","failed","[ERROR]: Failed to get ansible credentials")
    return false
  }
  // define vaultPassword
  var vaultPassword=""
  try{
    if(vaultCredentials){
      const vaultCredential = await Credential.findByName(vaultCredentials)
      vaultPassword = vaultCredential.password
    }
  }catch(err){
    logger.error("Failed to get vault credentials : ",err)
    await Job.endJobStatus(jobid,++counter,"stderr","failed","[ERROR]: Failed to get vault credentials")
    return false
  }
  // make extravars file
  const extravarsFileName = `extravars_${jobid}.json`;
  const hiddenExtravarsFileName = `he_${extravarsFileName}`
  logger.debug(`Extravars File: ${extravarsFileName}`);
  // prepare my ansible command

  var command
  if(!vaultPassword){
    command = `ansible-playbook -e '@${extravarsFileName}' -e '@${hiddenExtravarsFileName}'`
  }else{
    command = `echo ${Buffer.from(vaultPassword).toString('base64')} | base64 -d | ansible-playbook -e '@${extravarsFileName}' -e '@${hiddenExtravarsFileName}' --vault-password-file=/bin/cat`
  }

  inventory.forEach((item, i) => {  command += ` -i '${item}'` });
  if(tags){ command += ` -t '${tags}'` }
  if(check){ command += ` --check` }
  if(diff){ command += ` --diff` }
  if(verbose){ command += ` -vvv`}
  if(limit){ command += ` --limit '${limit}'`}
   
  command += ` ${playbook}`
  var directory = await Repository.getAnsiblePath()
  var directory = directory || ansibleConfig.path
  var cmdObj = {directory:directory,command:command,description:"Running playbook",task:"Playbook",extravars:extravars,hiddenExtravars:hiddenExtravars,extravarsFileName:extravarsFileName,hiddenExtravarsFileName:hiddenExtravarsFileName,keepExtravars:keepExtravars}

  logger.notice("Running playbook : " + playbook)
  logger.debug("extravars : " + extravars)
  logger.debug("inventory : " + inventory)
  logger.debug("check : " + check)
  logger.debug("diff : " + diff)
  logger.debug("tags : " + tags)
  logger.debug("limit : " + limit)
  // in the background, start the commands
  try{
    await Exec.executeCommand(cmdObj,jobid,counter)
    return true
  }catch(err){
    logger.error("Ansible job failed : ",err)
    return false
  }
}

// awx stuff, interaction with awx
var Awx = function(){}
Awx.getConfig = AwxModel.getConfig;
Awx.getAuthorization = AwxModel.getAuthorization;
Awx.abortJob = async function (awxName,id) {

  const awxConfig = await Awx.getConfig(awxName)
  if(!awxConfig)throw new Errors.ApiError("Failed to get AWX configuration")
  var message=""
  logger.info(`aborting awx job ${id}`)
  const axiosConfig = Awx.getAuthorization(awxConfig)
  try {
    const axiosResult = await axios.post(awxConfig.uri + appConfig.awxApiPrefix + "/jobs/" + id + "/cancel/",{},axiosConfig);
    const job = axiosResult.data;
    return job;
  } catch (error) {
    if (error.response && error.response.status === 405) {
      const message = `cannot cancel job id ${id}`;
      logger.error(message);
      throw new Errors.ConflictError(message);
    } else {
      logger.error("Failed to abort awx job : ", error);
      throw new Errors.ApiError(`Failed to abort awx job ${id} : ${error.message}`);
    }
  }

};
Awx.launch = async function (ev,credentials,jobid,counter,approval,approved=false){
    var message=""
    if(!counter){
      counter=0
    }else{
      counter++
    }

    // we make a copy, we don't mutate the original
    var extravars={...ev}

    // get awx data from the extravars
    var invent = extravars?.__inventory__
    var execenv = extravars?.__executionEnvironment__
    var instanceGroups = [].concat(extravars?.__instanceGroups__ || []) // always array ! force to array
    var tags = extravars?.__tags__ || ""
    var scmBranch = extravars?.__scmBranch__ || ""
    var check = extravars?.__check__ || false
    var verbose = extravars?.__verbose__ || false  
    var limit = extravars?.__limit__ || ""
    var diff = extravars?.__diff__ || false  
    var template = extravars?.__template__ 
    var awxName = extravars?.__awx__ || ""
    logger.debug("awxName : " + awxName)
    var awxCredentials = extravars?.__awxCredentials__ || []
    if(approval){
      if(!approved){
        await Job.sendApprovalNotification(approval,ev,jobid)
        await Job.printJobOutput(`APPROVE [${template}] ${'*'.repeat(69-template.length)}`,"stdout",jobid,++counter)
        await Job.update({status:"approve",approval:JSON.stringify(approval),end:getTimestamp()},jobid)
        return true
      }else{
        logger.notice("Continuing awx " + template + " it has been approved")
      }
    }
    try{
      const jobTemplate = await Awx.findJobTemplateByName(awxName,template)
      logger.debug("Found jobtemplate, id = " + jobTemplate.id)
      await Awx.launchTemplate(awxName,jobTemplate,ev,invent,tags,limit,check,diff,verbose,credentials,awxCredentials,execenv,instanceGroups,scmBranch,jobid,++counter)
      return true
    }catch(err){
      message="failed to launch awx template " + template + "\n" + err.message
      // any error, we just end the job, no need to throw an error.
      await Job.endJobStatus(jobid,++counter,"stdout","failed",message)
      throw new Errors.ApiError(message)
    } 
}
Awx.launchTemplate = async function (awxName,template,ev,invent,tags,limit,check,diff,verbose,credentials,awxCredentials,execenv,instanceGroups,scmBranch,jobid,counter) {
  var message=""
  if(!counter){
    counter=0
  }
  // get existing credentials in the template, and then add the external ones.
  var awxCredentialList=[]
  try{
    awxCredentialList=await Awx.findCredentialsByTemplate(awxName,template.id)
    logger.notice(`Found ${awxCredentialList.length} existing creds`)
  }catch(e){
    logger.warning("No credentials available... could be workflow template")
  }
  // add external ones
  for(let i=0;i<awxCredentials.length;i++){
      var ac=awxCredentials[i]
      var credId=await Awx.findCredentialByName(awxName,ac)
      logger.debug(`Found awx credential '${ac}'; id = ${credId}`)
      awxCredentialList.push(credId)
  }
  awxCredentialList=[...new Set(awxCredentialList)]

  // get inventory
  var inventory=await Awx.findInventoryByName(awxName,invent)
  // get execution environment
  var executionEnvironment=await Awx.findExecutionEnvironmentByName(awxName,execenv)

  // get instance groups
  var instanceGroupIds=[]
  for (let index = 0; index < instanceGroups.length; index++) {
    instanceGroupIds.push(await Awx.findInstanceGroupByName(awxName,instanceGroups[index]))
  };

  // get config and go
  const awxConfig = await Awx.getConfig(awxName)
  if(!awxConfig)throw new Errors.ApiError("Failed to get AWX configuration")

  var extravars={...ev} // we make a copy of the main extravars
  // merge credentials now
  extravars = {...extravars,...credentials}
  extravars = JSON.stringify(extravars)
  // prep the post data
  var postdata = {
    extra_vars:extravars
  }
  if(awxCredentialList.length>0){ postdata.credentials=awxCredentialList }
  if(executionEnvironment){ postdata.execution_environment=executionEnvironment.id }
  if(instanceGroups){ postdata.instance_groups = instanceGroupIds.map(x => x.id)}
  if(inventory){ postdata.inventory=inventory.id }
  if(check){ postdata.job_type="check" } else{ postdata.job_type="run" }
  if(diff){ postdata.diff_mode=true } else{ postdata.diff_mode=false }
  if(verbose) { postdata.verbosity=3}
  if(limit){ postdata.limit=limit}
  if(scmBranch){ postdata.scm_branch=scmBranch}
  if(tags){ postdata.job_tags=tags }

  logger.notice("Running template : " + template.name)
  logger.info("extravars : " + extravars)
  logger.info("inventory : " + inventory)
  logger.info("execution_environment : " + executionEnvironment)
  logger.info("instance_groups : " + instanceGroups)
  logger.info("credentials : " + awxCredentialList)
  logger.info("check : " + check)
  logger.info("diff : " + diff)
  logger.info("verbose : " + verbose)      
  logger.info("tags : " + tags)
  logger.info("limit : " + limit)
  logger.info("scm_branch : " + scmBranch)
  // post
  if(template.related===undefined){
    message=`Failed to launch, no launch attribute found for template ${template.name}`
    logger.error(message)
    await Job.endJobStatus(jobid,++counter,"stderr","failed",message)
    throw new Errors.ConflictError(message)
  }else{
    // prepare axiosConfig
    const axiosConfig = Awx.getAuthorization(awxConfig)
    // logger.debug("Lauching awx with data : " + JSON.stringify(postdata))
    logger.debug("Launching awx template")
    // launch awx job
    var axiosResult
    try{
      axiosResult = await axios.post(awxConfig.uri + template.related.launch,postdata,axiosConfig)
    }catch(error){
      var message=`failed to launch ${template.name}`
      if(error.response){
          logger.error("",error.response.data)
          message+="\r\n" + yaml.stringify(error.response.data)
          await Job.endJobStatus(jobid,++counter,"stderr","success",`Failed to launch template ${template.name}. ${message}`)
      }else{
          logger.error("Failed to launch : ", error)
          await Job.endJobStatus(jobid,++counter,"stderr","success",`Failed to launch template ${template.name}. ${error}`)
      }
      throw new Errors.ApiError(message)
    }

    // get awx job (= remote job !!)
    var job = axiosResult.data
    if(job){
      logger.info(`awx job id = ${job.id}`)
      // log launch
      await Job.update({awx_id:job.id},jobid)
      await Job.printJobOutput(`Launched template ${template.name} with jobid ${job.id}`,"stdout",jobid,++counter)
      // track the job in the background
      return Awx.trackJob(awxName,job,jobid,++counter)
    }else{
      // no awx job, end failed
      message=`could not launch job template ${template.name}`
      await Job.endJobStatus(jobid,counter,"stderr","failed",`Failed to launch template ${template.name}`)
      logger.error(message)
      throw new Errors.ApiError(message)
    }

  }

};

Awx.trackJob = async function (awxName,job,jobid,counter,previousoutput,previousoutput2=undefined,lastrun=false,retryCount=0) {
  const awxConfig = await Awx.getConfig(awxName)
  if(!awxConfig)throw new Error("Failed to get AWX configuration")
  var message=""
  logger.info(`searching for job with id ${job.id}`)
  // prepare axiosConfig
  const axiosConfig = Awx.getAuthorization(awxConfig)
  try{
    // get job info
    const axiosResult = await axios.get(awxConfig.uri + job.url,axiosConfig)
    var j = axiosResult.data;
    if(j){
      // logger.debug(inspect(j))
      logger.debug(`awx job status : ` + j.status)
      try{
        // get text output
        const o = await Awx.getJobTextOutput(awxName,job)

        var incrementIssue=false
        var output=o
        // AWX has no incremental output, so we always need to substract previous output
        // we substract the previous output
        if(output && previousoutput){
            // does the previous output fit in the new
            if(output.includes(previousoutput)){
              output = output.substring(previousoutput.length)
            }else{
              if(output && previousoutput2){
                // here we have an output problem, the incremental of AWX can sometimes deviate
                // and the last output was wrong, in this case we remove the last output from the db and take the second last output
                // as last reference.
                incrementIssue=true
                // logger.error("Incremental problem")
                output = output.substring(previousoutput2.length)
              }
            }
        }
        // the increment issue (if true) will remove the last entry before add the new (corrected) one.
        const abort_requested = await Job.printJobOutput(output,"stdout",jobid,++counter,incrementIssue)
        if(abort_requested){
          await Job.printJobOutput("Abort requested","stderr",jobid,++counter)
          try{
            // we try to abort the job
            await Awx.abortJob(awxName,j.id)
            await Job.resetAbortRequested(jobid)
            await Job.endJobStatus(jobid,++counter,"stderr","aborted","Aborted job",j.artifacts)
            return "Aborted job"
          }catch (error){
              // abort failed... , revert abort request
              await Job.printJobOutput("Abort request denied, reverting abort request","stderr",jobid,++counter)
              await Job.resetAbortRequested(jobid)
              return Awx.trackJob(awxName,j,jobid,++counter,o,previousoutput,j.finished)
          }
          
        }else{
          if(j.finished && lastrun){
            if(j.status==="successful"){
              await Job.endJobStatus(jobid,++counter,"stdout","success",`Successfully completed template ${j.name}`,j.artifacts)
              return true
            }else{
              // if error, end with status (aborted or failed)
              var status="failed"
              var message=`Template ${j.name} completed with status ${j.status}`
              if(j.status=="canceled"){
                status="aborted"
                message=`Template ${j.name} was aborted`
                await Job.resetAbortRequested(jobid)
              }
              await Job.endJobStatus(jobid,++counter,"stderr",status,message,j.artifacts)
              return message
            }
          }else{
            // not finished, try again
            return await delay(1000).then(async ()=>{
              if(j.finished){
                logger.debug("Getting final stdout")
              }
              if(incrementIssue){
                return await Awx.trackJob(awxName,j,jobid,++counter,o,previousoutput2,j.finished)
              }
              return await Awx.trackJob(awxName,j,jobid,++counter,o,previousoutput,j.finished)
            })
          }
        }

      }catch(err){
        message = err.toString()
        logger.error(message)
        retryCount++
        if(retryCount==10){
          return Promise.resolve(message)
        }else{
          logger.warning(`Retrying jobid ${jobid} [${retryCount}]`)
          await delay(1000)
          return await Awx.trackJob(awxName,job,jobid,counter,previousoutput,previousoutput2,lastrun,retryCount)
        }
      }
    }else{
      message=`could not find job with id ${job.id}`
      logger.error(message)
      retryCount++
      if(retryCount==10){
        return Promise.resolve(message)
      }else{
        logger.warning(`Retrying jobid ${jobid} [${retryCount}]`)
        await delay(1000)
        return await Awx.trackJob(awxName,job,jobid,counter,previousoutput,previousoutput2,lastrun,retryCount)
      }
    }
  }catch(e){
    logger.error("Failed to track job : ",e)
    return e.message
  }  

};
Awx.getJobTextOutput = async function (awxName,job) {
  if(!job)return undefined
  const awxConfig = await Awx.getConfig(awxName)
  if(!awxConfig)throw new Errors.ApiError("Failed to get AWX configuration")
  if(job.related===undefined){
    throw new Errors.ConflictError("No related attribute found for job " + job.id)
  }else{
    if(!job.related.stdout){
      // workflow job... just return status
      return job.status
    }
    // prepare axiosConfig
    const axiosConfig = Awx.getAuthorization(awxConfig)
    const axiosResult = await axios.get(awxConfig.uri + job.related.stdout + "?format=txt",axiosConfig)
    return axiosResult.data 
  }

};
Awx.findJobTemplateByName = async function (awxName,name) {
  if(!name)return undefined
  const awxConfig = await Awx.getConfig(awxName)
  if(!awxConfig)throw new Errors.ApiError("Failed to get AWX configuration")
  var message=""
  logger.info(`searching job template ${name}`)
  // prepare axiosConfig
  const axiosConfig = Awx.getAuthorization(awxConfig)
  var axiosResult = await axios.get(awxConfig.uri  + appConfig.awxApiPrefix + "/job_templates/?name=" + encodeURI(name),axiosConfig)
  var job_template = axiosResult.data.results.find(function(x, index) { return x.name == name })
  if(job_template){
    return job_template
  }else{
    logger.info("Template not found, looking for workflow job template")
    // trying workflow job templates
    axiosResult = await axios.get(awxConfig.uri + appConfig.awxApiPrefix + "/workflow_job_templates/?name=" + encodeURI(name),axiosConfig)
    var job_template = axiosResult.data.results.find(function(x, index) { return x.name == name })
    if(job_template){
      return job_template
    }else{
      message=`could not find job template ${name}`
      logger.error(message)
      throw new Errors.NotFoundError(message)
    }
  }
};
Awx.findCredentialByName = async function (awxName,name) {
  if(!name)return undefined
  const awxConfig = await Awx.getConfig(awxName)
  if(!awxConfig)throw new Errors.ApiError("Failed to get AWX configuration")
  var message=""
  logger.info(`searching credential ${name}`)
  // prepare axiosConfig
  const axiosConfig = Awx.getAuthorization(awxConfig)
  const axiosResult = await axios.get(awxConfig.uri + appConfig.awxApiPrefix + "/credentials/?name=" + encodeURI(name),axiosConfig)
  var credential = axiosResult.data.results.find(function(x, index) { return x.name == name })
  if(credential){
    return credential.id
  }else{
    message=`could not find credential ${name}`
    logger.error(message)
    throw new Errors.NotFoundError(message)
  }
};
Awx.findExecutionEnvironmentByName = async function (awxName,name) {
  if(!name)return undefined
  const awxConfig = await Awx.getConfig(awxName)
  if(!awxConfig)throw new Errors.ApiError("Failed to get AWX configuration")
  var message=""
  logger.info(`searching execution environment ${name}`)
  // prepare axiosConfig
  const axiosConfig = Awx.getAuthorization(awxConfig)
  message=`could not find execution environment ${name}`
  var axiosResult
  try{
    axiosResult = await axios.get(awxConfig.uri + appConfig.awxApiPrefix + "/execution_environments/?name=" + encodeURI(name),axiosConfig)
  }catch(error){
    throw new Errors.ApiError(`${message}, ${error.message}`)
  }            
  var execution_environment = axiosResult.data.results.find(function(x, index) { return x.name == name })
  if(execution_environment){
    return execution_environment
  }else{

    logger.error(message)
    throw new Errors.NotFoundError(message)
  }
};
Awx.findInstanceGroupByName = async function (awxName,name) {
  if(!name)return undefined
  const awxConfig = await Awx.getConfig(awxName)
  if(!awxConfig)throw new Errors.ApiError("Failed to get AWX configuration")
  var message=""
  logger.info(`searching instance group ${name}`)
  // prepare axiosConfig
  const axiosConfig = Awx.getAuthorization(awxConfig)
  message=`could not find instance group ${name}`
  var axiosResult
  try{
    axiosResult = await axios.get(awxConfig.uri + appConfig.awxApiPrefix + "/instance_groups/?name=" + encodeURI(name),axiosConfig)
  }catch(error){
    throw new Errors.ApiError(`${message}, ${error.message}`)
  }        
  var instance_group = axiosResult.data.results.find(function(x, index) { return x.name == name })
  if(instance_group){
    return instance_group
  }else{
    logger.error(message)
    throw new Errors.NotFoundError(message)
  }
};
Awx.findCredentialsByTemplate = async function (awxName,id) {
  const awxConfig = await Awx.getConfig(awxName)
  if(!awxConfig)throw new Errors.ApiError("Failed to get AWX configuration")
  logger.info(`searching credentials for template id ${id}`)
  // prepare axiosConfig
  const axiosConfig = Awx.getAuthorization(awxConfig)
  const axiosResult = await axios.get(awxConfig.uri + appConfig.awxApiPrefix + "/job_templates/"+id+"/credentials/",axiosConfig)
  if(axiosResult.data?.results?.length){
    return axiosResult.data.results.map(x=>x.id)
  }
  return []
};
Awx.findInventoryByName = async function (awxName,name) {
  if(!name)return undefined
  const awxConfig = await Awx.getConfig(awxName)
  if(!awxConfig)throw new Errors.ApiError("Failed to get AWX configuration")
  var message=""
  logger.info(`searching inventory ${name}`)
  // prepare axiosConfig
  const axiosConfig = Awx.getAuthorization(awxConfig)
  message=`could not find inventory ${name}`
  var axiosResult
  try{
    axiosResult = await axios.get(awxConfig.uri + appConfig.awxApiPrefix + "/inventories/?name=" + encodeURI(name),axiosConfig)
  }catch(error){
    throw new Errors.ApiError(`${message}, ${error.message}`)
  }    
  var inventory = axiosResult.data.results.find(function(x, index) { return x.name == name })
  if(inventory){
    return inventory
  }else{
    logger.error(message)
    throw new Errors.NotFoundError(message)
  }


};

export default  Job;
