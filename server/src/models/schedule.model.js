'use strict';

import logger from "../lib/logger.js";
import Job from "./job.model.js";
import yaml from 'yaml';
import mysql from './db.model.js';

//user object create
var Schedule=function(schedule){
  this.name = schedule.name
  this.extra_vars = schedule.extra_vars
  this.form = schedule.form
  this.cron = schedule.cron;
};
Schedule.create = async function (record) {
  logger.info(`Creating schedule ${record.name}`)
  const result = await mysql.do("INSERT INTO AnsibleForms.`schedule` set ?", record)
  return result.insertId
};
Schedule.update = async function (record,id) {
  logger.info(`Updating schedule ${(record.name)?record.name:id}`)
  return await mysql.do("UPDATE AnsibleForms.`schedule` set ? WHERE id=?", [record,id])
};
Schedule.delete = async function(id){
  logger.info(`Deleting schedule ${id}`)
  
  return await mysql.do("DELETE FROM AnsibleForms.`schedule` WHERE id = ?", [id])
};
Schedule.findAll = async function () {
  logger.info("Finding all schedules")
  return await mysql.do("SELECT * FROM AnsibleForms.`schedule`;")
};
Schedule.findById = async function (id) {
  logger.info(`Finding schedule ${id}`)
  return await mysql.do("SELECT * FROM AnsibleForms.`schedule` WHERE id=?;",id)
};
Schedule.findByName = async function (name) {
  logger.info(`Finding schedule ${name}`)
  return await mysql.do("SELECT * FROM AnsibleForms.`schedule` WHERE name=?;",name)
};
Schedule.queue = async function(id){
  // set to queued
  logger.info(`Queuing schedule ${id}`)
  const queue = await mysql.do("SELECT MAX(queue_id)+1 as queue_id FROM AnsibleForms.`schedule`")
  const queue_id = queue[0].queue_id
  await mysql.do("UPDATE AnsibleForms.`schedule` set state='queued',queue_id=? WHERE id=? AND COALESCE(state,'')<>'queued' AND COALESCE(state,'')<>'running'", [queue_id,id])  
  logger.info(`Queued schedule ${id}`)
}
Schedule.launch = async function(id){
  var status="success"
  var output=""
  var schedule = await Schedule.findById(id)
  if(schedule.length==0){
    throw `Datasource with id '${id}' not found`
  }
  schedule=schedule[0]
  
  // get the form data
  var form = schedule.form
  // var extravars = schedule
  var user = {}
  var extravars = yaml.parse(schedule.extra_vars || '{}')
  user.id = 0
  user.username = 'Schedule Service'
  user.type = 'schedule'
  user.groups = []
  user.roles = ['admin']    
  extravars.schedule = schedule
  delete extravars.schedule.output
  delete extravars.schedule.status
  delete extravars.schedule.state
  delete extravars.schedule.last_run
  delete extravars.schedule.cron
  delete extravars.schedule.extra_vars

  extravars.ansibleforms_user = user
  try{
    const success = await Job.launch(form,null,user,null,extravars,null,null,true)
    if(success){
      output = `The schedule has been successfully run.\nThis is not a guarantee that the data is correct, only that the process has completed.\nCheck the job log that launched the schedule for more details.\nResult : ${success}`
    }else{
      output = `The schedule has been run but there was an error.\nCheck the job log that launched the schedule for more details.\nResult : ${success}`
      status = "failed"
    }
  }catch(err){
    logger.error("Errors : ", err)
    output = "Failed to launch : "+err.message
    status = "failed"
  }  
  await mysql.do("update AnsibleForms.`schedule` set output = ?,status = ?,state='idle',last_run=NOW() where id = ?",[output,status,id])
  
}


export default  Schedule;
