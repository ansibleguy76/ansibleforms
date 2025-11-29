'use strict';

import logger from "../lib/logger.js";
import Job from "./job.model.js";
import yaml from "yaml";
import mysql from "./db.model.js";

//user object create
var Ds=function(ds){
  this.name = ds.name
  this.schema = ds.schema
  this.extra_vars = ds.extra_vars
  this.form = ds.form
  this.cron = ds.cron;
};
Ds.create = async function (record) {
  logger.info(`Creating datasource ${record.name}`)
  const result = await mysql.do("INSERT INTO AnsibleForms.`datasource` set ?", record)
  return result.insertId
};
Ds.update = async function (record,id) {
  logger.info(`Updating datasource ${(record.name)?record.name:id}`)
  return await mysql.do("UPDATE AnsibleForms.`datasource` set ? WHERE id=?", [record,id])
};
Ds.delete = async function(id){
  logger.info(`Deleting datasource ${id}`)
  
  return await mysql.do("DELETE FROM AnsibleForms.`datasource` WHERE id = ?", [id])
};
Ds.findAll = async function () {
  logger.info("Finding all datasources")
  return await mysql.do("SELECT * FROM AnsibleForms.`datasource`;")
};
Ds.findById = async function (id) {
  logger.info(`Finding datasource ${id}`)
  return await mysql.do("SELECT * FROM AnsibleForms.`datasource` WHERE id=?;",id)
};
Ds.findByName = async function (name) {
  logger.info(`Finding datasource ${name}`)
  return await mysql.do("SELECT * FROM AnsibleForms.`datasource` WHERE name=?;",name)
};
Ds.queue = async function(id){
  // set to queued
  logger.info(`Queuing datasource ${id}`)
  const queue = await mysql.do("SELECT MAX(queue_id)+1 as queue_id FROM AnsibleForms.`datasource`")
  const queue_id = queue[0].queue_id
  await mysql.do("UPDATE AnsibleForms.`datasource` set state='queued',queue_id=? WHERE id=? AND COALESCE(state,'')<>'queued' AND COALESCE(state,'')<>'running'", [queue_id,id])  
  logger.info(`Queued datasource ${id}`)
}
Ds.import = async function(id){
  var status="success"
  var output=""
  var ds = await Ds.findById(id)
  if(ds.length==0){
    throw `Datasource with id '${id}' not found`
  }
  ds=ds[0]
  
  // get the form data
  var form = ds.form
  // var extravars = ds
  var user = {}
  var extravars = yaml.parse(ds.extra_vars || '{}')
  user.id = 0
  user.username = 'Datasource Service'
  user.type = 'datasource'
  user.groups = []
  user.roles = ['admin']    
  extravars.datasource = ds
  delete extravars.datasource.output
  delete extravars.datasource.status
  delete extravars.datasource.state
  delete extravars.datasource.last_run
  delete extravars.datasource.cron
  delete extravars.datasource.extra_vars

  extravars.ansibleforms_user = user
  try{
    const success = await Job.launch(form,null,user,null,extravars,null)
    if(success){
      output = `The datasource has been successfully run.\nThis is not a guarantee that the data is correct, only that the process has completed.\nCheck the job log that launched the datasource for more details.\nResult : ${success}`
    }else{
      output = `The datasource has been run but there was an error.\nCheck the job log that launched the datasource for more details.\nResult : ${success}`
      status = "failed"
    }
  }catch(err){
    logger.error("Errors in ds import : ", err)
    output = "Failed to launch : "+err.message
    status = "failed"
  }  
  await mysql.do("update AnsibleForms.`datasource` set output = ?,status = ?,state='idle',last_run=NOW() where id = ?",[output,status,id])
  
}


export default  Ds;
