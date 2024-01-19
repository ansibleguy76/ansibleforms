'use strict';
const axios=require('axios')
const fs=require('fs')
const path=require('path')
const YAML = require('yaml')
const moment= require('moment')
const {exec} = require('child_process');
const Helpers = require('../lib/common.js')
const Settings = require('./settings.model')
const logger=require("../lib/logger");
const ansibleConfig = require('../../config/ansible.config.js')
const dbConfig = require('../../config/db.config')
const appConfig = require('../../config/app.config.js')
const Repository = require('./repository.model.js')
const mysql = require('./db.model')
const Form = require('./form.model')
const Credential = require('./credential.model');
const { getAuthorization } = require('./awx.model');

function pushForminfoToExtravars(formObj,extravars,creds={}){
  // push top form fields to extravars
  // change in 4.0.16 => easier to process & available in playbook, might be handy
  // no credentials added here, because then can also come from asCredential property and these would get lost.
  const topFields=['template','playbook','tags','limit','executionEnvironment','check','diff','verbose','keepExtravars','credentials','inventory','awxCredentials','ansibleCredentials','instanceGroups']
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

      var child = exec(command,{cwd:directory,encoding: "UTF-8"});

      // add output eventlistener to the process to save output
      child.stdout.on('data',function(data){
        // save the output ; but whilst saving, we quickly check the status to detect abort
        Job.createOutput({output:data,output_type:"stdout",job_id:jobid,order:++counter})
          .then((status)=>{
            // if abort request found ; kill the process
            if(status=="abort"){
              logger.warning("Abort is requested, killing child")
              process.kill(child.pid,"SIGTERM");
            }
          })
          .catch((error)=>{logger.error("Failed to create output : ", error)})
      })
      // add error eventlistener to the process to save output
      child.stderr.on('data',function(data){
        // save the output ; but whilst saving, we quickly check the status to detect abort
        Job.createOutput({output:data,output_type:"stderr",job_id:jobid,order:++counter})
          .then((status)=>{
            // if abort request found ; kill the process
            if(status=="abort"){
              logger.warning("Abort is requested, killing child")
              process.kill(child.pid,"SIGTERM");
            }
          })
          .catch((error)=>{logger.error("Failed to create output: ", error)})
      })
      // add exit eventlistener to the process to handle status update
      child.on('exit',function(data){
        // if the exit was an actual request ; set aborted
        if(child.signalCode=='SIGTERM'){
          Job.endJobStatus(jobid,++counter,"stderr","aborted",`${task} was aborted by operator`)
          reject(`${task} was aborted by operator`)
        }else{ // if the exit was natural; set the jobstatus (either success or failed)
          if(data!=0){
            jobstatus="failed"
            logger.error(`[${jobid}] Failed with code ${data}`)
            Job.endJobStatus(jobid,++counter,"stderr",jobstatus,`[ERROR]: ${task} failed with status (${data})`)
            reject(`${task} failed with status (${data})`)
          }else{
            Job.endJobStatus(jobid,++counter,"stdout",jobstatus,`ok: [${task} finished] with status (${data})`)
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
      child.on('error',function(data){
        Job.endJobStatus(jobid,++counter,"stderr","failed",`${task} failed : `+data)
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
      this.start = moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')
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
  var sql = "UPDATE AnsibleForms.`jobs` set status='abandoned' where (status='running' or status='abort') " // remove all jobs
  if(!all){
    sql = sql + "and (start >= (NOW() - INTERVAL 1 DAY))" // remove jobs that are 1 day old
  }
  const res = await mysql.do(sql)
  return res.changedRows
};
Job.update = async function (record,id) {
  logger.notice(`Updating job ${id} ${record.status}`)
  try{
    await mysql.do("UPDATE AnsibleForms.`jobs` set ? WHERE id=?", [record,id])
  }catch(error){
    logger.error("Failed to update job",error)
  }
};
Job.endJobStatus = async (jobid,counter,stream,status,message) => {
  // logger.error("------------------------------+++++++++++++++++++++++++++++++----------------------")
  // logger.error(`jobid = ${jobid} ; counter = ${counter} ; status = ${status} ; message = ${message}`)
  // logger.error("------------------------------+++++++++++++++++++++++++++++++----------------------")
  try{
    await Job.createOutput({output:message,output_type:stream,job_id:jobid,order:counter})
    await Job.update({status:status,end:moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')},jobid)
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
Job.abort = async function (id) {
  logger.notice(`Aborting job ${id}`)
  const res = await mysql.do("UPDATE AnsibleForms.`jobs` set status='abort' WHERE id=? AND status='running'", [id])
  if(res.changedRows==1){
      return res
  }else{
      throw new Error("This job cannot be aborted")
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
    const res = await mysql.do("SELECT status FROM AnsibleForms.`jobs` WHERE id=?;INSERT INTO AnsibleForms.`job_output` set ?;", [record.job_id,record])

    if(res.length==2){
      return res[0][0].status
    }else{
      throw "Failed to get job status"
    }

  }else{
    // no output, just return status
    const res = await mysql.do("SELECT status FROM AnsibleForms.`jobs` WHERE id=?;", record.job_id)
    return res[0].status
  }
};
Job.delete = async function(id){
  logger.notice(`Deleting job ${id}`)
  return await mysql.do("DELETE FROM AnsibleForms.`jobs` WHERE id = ? OR parent_id = ?", [id,id])
}
Job.findAll = async function (user,records) {
    logger.info("Finding all jobs")
    var query
    if(user.roles.includes("admin")){
      query = "SELECT id,form,target,status,start,end,user,user_type,job_type,parent_id,approval FROM AnsibleForms.`jobs` ORDER BY id DESC LIMIT " +records + ";"
    }else{
      query = "SELECT id,form,target,status,start,end,user,user_type,job_type,parent_id,approval FROM AnsibleForms.`jobs` WHERE (user=? AND user_type=?) OR (status='approve') ORDER BY id DESC LIMIT " +records + ";"
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
          throw `Job ${id} not found, or access denied`
      }
      var job = res[0]
      // mask passwords
      if(logSafe) job.extravars=Helpers.logSafe(job.extravars)
      // get output summary
      res = await mysql.do("SELECT COALESCE(output,'') output,COALESCE(`timestamp`,'') `timestamp`,COALESCE(output_type,'stdout') output_type FROM AnsibleForms.`job_output` WHERE job_id=? ORDER by job_output.order;",id,true)
      return [{...job,...{output:Helpers.formatOutput(res,asText)}}]

    }catch(err){
      logger.error("Error : ", err)
      return []
    }
};
Job.launch = async function(form,formObj,user,creds,extravars,parentId=null,next) {
  // a formobj can be a full step pushed
  if(!formObj){
    // we load it, it's an actual form
    formObj = await Form.loadByName(form,user)
    if(!formObj){
      throw "No such form or access denied"
    }
  }

  pushForminfoToExtravars(formObj,extravars,creds)

  // we have form and we have access
  var notifications=formObj.notifications || {}
  var jobtype=formObj.type
  var target=formObj.name

  if(!target){
    throw "Invalid form or step info"
  }

  // create a new job in the database
  // if reuseId is passed, we don't create a new job and continue the existing one (for approve)
  logger.notice(`Launching form ${form}`)
  var jobid
  try{
    jobid = await Job.create(new Job({form:form,target:target,user:user.username,user_type:user.type,status:"running",job_type:jobtype,parent_id:parentId,extravars:JSON.stringify(extravars),credentials:JSON.stringify(creds),notifications:JSON.stringify(notifications)}))
  }catch(err){
    logger.error("Failed to create job",err)
    throw err
  }

  logger.debug(`Job id ${jobid} is created`)
  extravars["__jobid__"]=jobid
  // job created - return to client
  if(next)next({id:jobid})

  // the rest is now happening in the background
  // if credentials are requested, we now get them.
  var credentials={}

  // perhaps credentials were pass through extravars, they have precedence over the others !
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
  formObj = await Form.loadByName(form,user,true)
  if(!formObj){
    throw "No such form or access denied"
  }

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
    throw "Invalid form or step info"
    return false
  }
  var res = await Job.findById(user,jobid,true)

  if(res.length>0){
    var step=res[0].step
    var counter=res[0].counter
    await Job.printJobOutput(`changed: [approved by ${user.username}]`,"stdout",jobid,++counter)

    res = await Job.update({status:"running"},jobid)

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
              // If value contains a comma, split it and call with two parameters
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

  }else{
    logger.error("No job found with id " + jobid)
  }

};
Job.relaunch = async function(user,id,next){
  const job = await Job.findById(user,id,true)

  if(job.length==1){
    var j=job[0]
    var extravars = {}
    var credentials = {}
    if(j.extravars){
      extravars = JSON.parse(j.extravars)
    }
    if(j.credentials){
      credentials = JSON.parse(j.credentials)
    }
    if(!["running","aborting","abort"].includes(j.status)){
      logger.notice(`Relaunching job ${id} with form ${j.form}`)
      await Job.launch(j.form,null,user,credentials,extravars,null,(out)=>{
        next(out)
      })
    }else{
      throw `Job ${id} is not in a status to be relaunched (status=${j.status})`
    }
  }else{
    throw `Job ${id} not found`
  }

}
Job.approve = async function(user,id,next){
  const job = await Job.findById(user,id,true)

  if(job.length==1){
    var j=job[0]
    var approval=JSON.parse(j.approval)
    if(approval){
      var access = approval?.roles.filter(role => user?.roles?.includes(role))
      if(access?.length>0 || user?.roles?.includes("admin")){
        logger.notice(`Approve allowed for user ${user.username}`)
      }else {
        logger.warning(`Approve denied for user ${user.username}`)
        throw `Approve denied for user ${user.username}`
      }
    }
    var extravars = {}
    var credentials = {}
    if(j.extravars){
      extravars = JSON.parse(j.extravars)
    }
    if(j.credentials){
      credentials = JSON.parse(j.credentials)
    }
    if(j.status=="approve"){
      logger.notice(`Approving job ${id} with form ${j.form}`)
      await Job.continue(j.form,user,credentials,extravars,id,(job)=>{
          next(job)
      })
      .catch((err)=>{logger.error("Failed to continue the job : ", err)})
    }else{
      throw `Job ${id} is not in approval status (status=${j.status})`
    }
  }else{
    throw `Job ${id} not found`
  }

}
Job.sendApprovalNotification = async function(approval,extravars,jobid){
  if(!approval?.notifications?.length>0)return false
  try{
    const config = await Settings.find()
    const url = config.url?.replace(/\/$/g,'') // remove trailing slash if present

    var subject = Helpers.replacePlaceholders(approval.title,extravars) || "AnsibleForms Approval Request"
    var buffer = fs.readFileSync(`${__dirname}/../templates/approval.html`)
    var message = buffer.toString()
    var color = "#158cba"
    var color2 = "#ffa73b"
    var logo = `${url}${appConfig.baseUrl}assets/img/logo.png`
    var approvalMessage = Helpers.replacePlaceholders(approval.message,extravars)
    message = message.replace("${message}",approvalMessage)
                    .replaceAll("${url}",url)
                    .replaceAll("${baseurl",appConfig.baseUrl)
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

    logger.notice(`Finding jobid ${jobid}`)
    const j = await Job.findById(user,jobid,false,true)  // first get job

    if(!j.length==1){
      logger.error(`No job found with jobid ${jobid}`)
      return false
    }
    var job=j[0]
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
      const config = await Settings.find()
      const url = config.url?.replace(/\/$/g,'') // remove trailing slash if present

      if(!url){
        logger.warn(`Host URL is not set, no status mail can be sent. Go to 'settings' to correct this.`)
        return false
      }
      var subject = `AnsibleForms '${job.form}' [${job.job_type}] (${jobid}) - ${job.status} `
      var buffer = fs.readFileSync(`${__dirname}/../templates/jobstatus.html`)
      var message = buffer.toString()
      var color = "#158cba"
      var color2 = "#ffa73b"
      var logo = `${url}${appConfig.baseUrl}assets/img/logo.png`
      message = message.replace("${message}",job.output.replaceAll("\r\n","<br>"))
                      .replaceAll("${url}",url)
                      .replaceAll("${baseurl",appConfig.baseUrl)
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

  if(job.length==1){
    var j=job[0]
    var approval=JSON.parse(j.approval)
    if(approval){
      var access = approval?.roles.filter(role => user?.roles?.includes(role))
      if(access?.length>0 || user?.roles?.includes("admin")){
        logger.notice(`Reject allowed for user ${user.username}`)
      }else {
        logger.warning(`Reject denied for user ${user.username}`)
        throw `Reject denied for user ${user.username}`
      }
    }
    var counter=j.counter
    if(j.status=="approve"){
      logger.notice(`Rejecting job ${id} with form ${j.form}`)
      await Job.printJobOutput(`changed: [rejected by ${user.username}]`,"stderr",id,++counter)
      return await Job.update({status:"rejected",end:moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')},id)
    }else{
      throw `Job ${id} is not in rejectable status (status=${j.status})`
    }
  }else{
    throw `Job ${id} not found`
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
      await Job.update({status:"approve",approval:JSON.stringify(approval),end:moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')},jobid)
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
  var aborted=false

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
                await Job.update({status:"approve",approval:JSON.stringify(step.approval),end:moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')},jobid)
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
          const status = await Job.printJobOutput(`STEP [${step.name}] ${'*'.repeat(72-step.name.length)}`,"stdout",jobid,++counter)
          if(status=="abort"){
            aborted=true
          }
  
          // if aborted is requested, stop the flow
          if(aborted){
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
                  await Job.launch(form,step,user,creds,ev,jobid,function(job){
                      Job.printJobOutput(`ok: [Launched step ${step.name} with jobid '${job.id}']`,"stdout",jobid,++counter)
                  })
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
        if(aborted){
          // if aborted mark as such
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
  if(approval){
    if(!approved){
      await Job.sendApprovalNotification(approval,ev,jobid)
      await Job.printJobOutput(`APPROVE [${playbook}] ${'*'.repeat(69-playbook.length)}`,"stdout",jobid,++counter)
      await Job.update({status:"approve",approval:JSON.stringify(approval),end:moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')},jobid)
      return true
    }else{
      logger.notice("Continuing ansible " + playbook + " it has been approved")
    }
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

  // merge credentials now
  extravars = {...extravars,...credentials}
  // convert to string for the command
  extravars = JSON.stringify(extravars)
  // define hiddenExtravars
  var hiddenExtravars={}
  if(ansibleCredentials){ 
    const runCredential = await Credential.findByName(ansibleCredentials)
    hiddenExtravars.ansible_user = runCredential.user
    hiddenExtravars.ansible_password = runCredential.password
  }
  // convert to string for the command
  hiddenExtravars = JSON.stringify(hiddenExtravars)  

  // make extravars file
  const extravarsFileName = `extravars_${jobid}.json`;
  const hiddenExtravarsFileName = `he_${extravarsFileName}`
  logger.debug(`Extravars File: ${extravarsFileName}`);
  // prepare my ansible command

  var command = `ansible-playbook -e '@${extravarsFileName}' -e '@${hiddenExtravarsFileName}'`
  
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
Awx.getConfig = require('./awx.model').getConfig
Awx.getAuthorization= require('./awx.model').getAuthorization
Awx.abortJob = async function (id, next) {

  const awxConfig = await Awx.getConfig()
  if(!awxConfig)throw new Error("Failed to get AWX configuration")
  var message=""
  logger.info(`aborting awx job ${id}`)
  const axiosConfig = getAuthorization(awxConfig)
  // we first need to check if we CAN cancel
  try{
    const axiosResult = await axios.get(awxConfig.uri + "/api/v2/jobs/" + id + "/cancel/",axiosConfig)
    var job = axiosResult.data
    if(job && job.can_cancel){
        logger.info(`can cancel job id = ${id}`)
        const axiosResult = await axios.post(awxConfig.uri + "/api/v2/jobs/" + id + "/cancel/",{},axiosConfig)
        job = axiosResult.data
        next(null,job)
    }else{
        message=`cannot cancel job id ${id}`
        logger.error(message)
        next(message)
    }
  }catch(error) {
      logger.error("Failed to abort awx job : ", error)
      next(`failed to abort awx job ${id}`)
  }

};
Awx.launch = async function (ev,credentials,jobid,counter,approval,approved=false){
    var message=""
    if(!counter){
      counter=0
    }else{
      counter++
    }
    if(approval){
      if(!approved){
        await Job.sendApprovalNotification(approval,ev,jobid)
        await Job.printJobOutput(`APPROVE [${template}] ${'*'.repeat(69-template.length)}`,"stdout",jobid,++counter)
        await Job.update({status:"approve",approval:JSON.stringify(approval),end:moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')},jobid)
        return true
      }else{
        logger.notice("Continuing awx " + template + " it has been approved")
      }
    }
    // we make a copy, we don't mutate the original
    var extravars={...ev}

    // get awx data from the extravars
    var invent = extravars?.__inventory__
    var execenv = extravars?.__executionEnvironment__
    var instanceGroups = extravars?.__instanceGroups__
    var tags = extravars?.__tags__ || ""
    var check = extravars?.__check__ || false
    var verbose = extravars?.__verbose__ || false  
    var limit = extravars?.__limit__ || ""
    var diff = extravars?.__diff__ || false  
    var template = extravars?.__template__ 
    var awxCredentials = extravars?.__awxCredentials__ || []

    try{
      const jobTemplate = await Awx.findJobTemplateByName(template)
      logger.debug("Found jobtemplate, id = " + jobTemplate.id)
      await Awx.launchTemplate(jobTemplate,ev,invent,tags,limit,check,diff,verbose,credentials,awxCredentials,execenv,instanceGroups,jobid,++counter)
      return true
    }catch(err){
      message="failed to launch awx template " + template + "\n" + err.message
      // any error, we just end the job, no need to throw an error.
      await Job.endJobStatus(jobid,++counter,"stdout","failed",message)
      throw new Error(message)
    } 
}
Awx.launchTemplate = async function (template,ev,invent,tags,limit,check,diff,verbose,credentials,awxCredentials,execenv,instanceGroups,jobid,counter) {
  var message=""
  if(!counter){
    counter=0
  }
  // get existing credentials in the template, and then add the external ones.
  var awxCredentialList=[]
  try{
    awxCredentialList=await Awx.findCredentialsByTemplate(template.id)
    logger.notice(`Found ${awxCredentialList.length} existing creds`)
  }catch(e){
    logger.warning("No credentials available... could be workflow template")
  }
  // add external ones
  for(let i=0;i<awxCredentials.length;i++){
      var ac=awxCredentials[i]
      var credId=await Awx.findCredentialByName(ac)
      logger.debug(`Found awx credential '${ac}'; id = ${credId}`)
      awxCredentialList.push(credId)
  }
  awxCredentialList=[...new Set(awxCredentialList)]

  // get inventory
  var inventory=await Awx.findInventoryByName(invent)
  // get execution environment
  var executionEnvironment=await Awx.findExecutionEnvironmentByName(execenv)

  // get instance groups
  var instanceGroupIds=[]
  for (let index = 0; index < instanceGroups.length; index++) {
    instanceGroupIds.push(await Awx.findInstanceGroupByName(instanceGroups[index]))
  };

  // get config and go
  const awxConfig = await Awx.getConfig()
  if(!awxConfig)throw new Error("Failed to get AWX configuration")

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
  if(instanceGroupIds.length>0){ postdata.instance_groups = instanceGroupIds}
  if(inventory){ postdata.inventory=inventory.id }
  if(check){ postdata.job_type="check" } else{ postdata.job_type="run" }
  if(diff){ postdata.diff_mode=true } else{ postdata.diff_mode=false }
  if(verbose) { postdata.verbosity=3}
  if(limit){ postdata.limit=limit}
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
  // post
  if(template.related===undefined){
    message=`Failed to launch, no launch attribute found for template ${template.name}`
    logger.error(message)
    await Job.endJobStatus(jobid,++counter,"stderr","failed",message)
    throw new Error(message)
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
          message+="\r\n" + YAML.stringify(error.response.data)
          await Job.endJobStatus(jobid,++counter,"stderr","success",`Failed to launch template ${template.name}. ${message}`)
      }else{
          logger.error("Failed to launch : ", error)
          await Job.endJobStatus(jobid,++counter,"stderr","success",`Failed to launch template ${template.name}. ${error}`)
      }
      throw new Error(message)
    }

    // get awx job (= remote job !!)
    var job = axiosResult.data
    if(job){
      logger.info(`awx job id = ${job.id}`)
      // log launch
      await Job.printJobOutput(`Launched template ${template.name} with jobid ${job.id}`,"stdout",jobid,++counter)
      // track the job in the background
      return Awx.trackJob(job,jobid,++counter)
    }else{
      // no awx job, end failed
      message=`could not launch job template ${template.name}`
      await Job.endJobStatus(jobid,counter,"stderr","failed",`Failed to launch template ${template.name}`)
      logger.error(message)
      throw new Error(message)
    }

  }

};
Awx.trackJob = async function (job,jobid,counter,previousoutput,previousoutput2=undefined,lastrun=false,retryCount=0) {
  const awxConfig = await Awx.getConfig()
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
        const o = await Awx.getJobTextOutput(job)

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
                // here we have an output problem, the incremental of AWX can sometime deviate
                // and the last output was wrong, in this case we remove the last output from the db and take the second last output
                // as last reference.
                incrementIssue=true
                // logger.error("Incremental problem")
                output = output.substring(previousoutput2.length)
              }
            }
        }
        // the increment issue (if true) will remove the last entry before add the new (corrected) one.
        const dbjobstatus = await Job.printJobOutput(output,"stdout",jobid,++counter,incrementIssue)
        if(dbjobstatus && dbjobstatus=="abort"){
          await Job.printJobOutput("Abort requested","stderr",jobid,++counter)
          await Job.update({status:"aborting",end:moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')},jobid)
          await Awx.abortJob(j.id,(error,res)=>{
            if(error){
              Job.endJobStatus(jobid,++counter,"stderr","failed","Abort failed \n"+error)
            }else{
              Job.endJobStatus(jobid,++counter,"stderr","aborted","Aborted job")
            }
          })
          return "Abort requested"
        }else{
          if(j.finished && lastrun){
            if(j.status==="successful"){
              await Job.endJobStatus(jobid,++counter,"stdout","success",`Successfully completed template ${j.name}`)
              return true
            }else{
              // if error, end with status (aborted or failed)
              var status="failed"
              var message=`Template ${j.name} completed with status ${j.status}`
              if(j.status=="canceled"){
                status="aborted"
                message=`Template ${j.name} was aborted`
              }
              await Job.endJobStatus(jobid,++counter,"stderr",status,message)
              return message
            }
          }else{
            // not finished, try again
            return await delay(1000).then(async ()=>{
              if(j.finished){
                logger.debug("Getting final stdout")
              }
              if(incrementIssue){
                return await Awx.trackJob(j,jobid,++counter,o,previousoutput2,j.finished)
              }
              return await Awx.trackJob(j,jobid,++counter,o,previousoutput,j.finished)
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
          return await Awx.trackJob(job,jobid,counter,previousoutput,previousoutput2,lastrun,retryCount)
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
        return await Awx.trackJob(job,jobid,counter,previousoutput,previousoutput2,lastrun,retryCount)
      }
    }
  }catch(e){
    logger.error("Failed to track job : ",e)
    return e.message
  }  

};
Awx.getJobTextOutput = async function (job) {
  if(!job)return undefined
  const awxConfig = await Awx.getConfig()
  if(!awxConfig)throw new Error("Failed to get AWX configuration")
  if(job.related===undefined){
    throw "No such job"
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
Awx.findJobTemplateByName = async function (name) {
  if(!name)return undefined
  const awxConfig = await Awx.getConfig()
  if(!awxConfig)throw new Error("Failed to get AWX configuration")
  var message=""
  logger.info(`searching job template ${name}`)
  // prepare axiosConfig
  const axiosConfig = Awx.getAuthorization(awxConfig)
  var axiosResult = await axios.get(awxConfig.uri + "/api/v2/job_templates/?name=" + encodeURI(name),axiosConfig)
  var job_template = axiosResult.data.results.find(function(x, index) { return x.name == name })
  if(job_template){
    return job_template
  }else{
    logger.info("Template not found, looking for workflow job template")
    // trying workflow job templates
    axiosResult = await axios.get(awxConfig.uri + "/api/v2/workflow_job_templates/?name=" + encodeURI(name),axiosConfig)
    var job_template = axiosResult.data.results.find(function(x, index) { return x.name == name })
    if(job_template){
      return job_template
    }else{
      message=`could not find job template ${name}`
      logger.error(message)
      throw new Error(message)
    }
  }
};
Awx.findCredentialByName = async function (name) {
  if(!name)return undefined
  const awxConfig = await Awx.getConfig()
  if(!awxConfig)throw new Error("Failed to get AWX configuration")
  var message=""
  logger.info(`searching credential ${name}`)
  // prepare axiosConfig
  const axiosConfig = Awx.getAuthorization(awxConfig)
  const axiosResult = await axios.get(awxConfig.uri + "/api/v2/credentials/?name=" + encodeURI(name),axiosConfig)
  var credential = axiosResult.data.results.find(function(x, index) { return x.name == name })
  if(credential){
    return credential.id
  }else{
    message=`could not find credential ${name}`
    logger.error(message)
    throw new Error(message)
  }
};
Awx.findExecutionEnvironmentByName = async function (name) {
  if(!name)return undefined
  const awxConfig = await Awx.getConfig()
  if(!awxConfig)throw new Error("Failed to get AWX configuration")
  var message=""
  logger.info(`searching execution environment ${name}`)
  // prepare axiosConfig
  const axiosConfig = Awx.getAuthorization(awxConfig)
  message=`could not find execution environment ${name}`
  var axiosResult
  try{
    axiosResult = await axios.get(awxConfig.uri + "/api/v2/execution_environments/?name=" + encodeURI(name),axiosConfig)
  }catch(error){
    throw new Error(`${message}, ${error.message}`)
  }            
  var execution_environment = axiosResult.data.results.find(function(x, index) { return x.name == name })
  if(execution_environment){
    return execution_environment
  }else{

    logger.error(message)
    throw new Error(message)
  }
};
Awx.findInstanceGroupByName = async function (name) {
  if(!name)return undefined
  const awxConfig = await Awx.getConfig()
  if(!awxConfig)throw new Error("Failed to get AWX configuration")
  var message=""
  logger.info(`searching instance group ${name}`)
  // prepare axiosConfig
  const axiosConfig = Awx.getAuthorization(awxConfig)
  message=`could not find instance group ${name}`
  var axiosResult
  try{
    axiosResult = await axios.get(awxConfig.uri + "/api/v2/instance_groups/?name=" + encodeURI(name),axiosConfig)
  }catch(error){
    throw new Error(`${message}, ${error.message}`)
  }        
  var instance_group = axiosResult.data.results.find(function(x, index) { return x.name == name })
  if(instance_group){
    return instance_group
  }else{
    logger.error(message)
    throw new Error(message)
  }
};
Awx.findCredentialsByTemplate = async function (id) {
  const awxConfig = await Awx.getConfig()
  if(!awxConfig)throw new Error("Failed to get AWX configuration")
  logger.info(`searching credentials for template id ${id}`)
  // prepare axiosConfig
  const axiosConfig = Awx.getAuthorization(awxConfig)
  const axiosResult = await axios.get(awxConfig.uri + "/api/v2/job_templates/"+id+"/credentials/",axiosConfig)
  if(axiosResult.data?.results?.length){
    return axiosResult.data.results.map(x=>x.id)
  }
  return []
};
Awx.findInventoryByName = async function (name) {
  if(!name)return undefined
  const awxConfig = await Awx.getConfig()
  if(!awxConfig)throw new Error("Failed to get AWX configuration")
  var message=""
  logger.info(`searching inventory ${name}`)
  // prepare axiosConfig
  const axiosConfig = Awx.getAuthorization(awxConfig)
  message=`could not find inventory ${name}`
  var axiosResult
  try{
    axiosResult = await axios.get(awxConfig.uri + "/api/v2/inventories/?name=" + encodeURI(name),axiosConfig)
  }catch(error){
    throw new Error(`${message}, ${error.message}`)
  }    
  var inventory = axiosResult.data.results.find(function(x, index) { return x.name == name })
  if(inventory){
    return inventory
  }else{
    logger.error(message)
    throw new Error(message)
  }


};

module.exports= Job;
