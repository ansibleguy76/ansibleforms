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
  // One statement, so the next queue number is read and written atomically.
  //
  // It used to SELECT MAX(queue_id)+1 and UPDATE with it separately. Two things went
  // wrong with that: the cron tick and a manual queue interleaving both read the same
  // MAX and wrote the same queue_id, losing the FIFO order the processor relies on
  // (ORDER BY queue_id LIMIT 1); and MAX(...)+1 over an all-NULL column is NULL, not 1,
  // so on a fresh install the first datasource was queued with no queue number at all.
  // The schedule sibling avoids the NULL with Math.max(0, ...) - this avoids both.
  //
  // The derived table is required: MySQL refuses a subquery reading the same table an
  // UPDATE targets unless it is wrapped one level deeper.
  await mysql.do(
    "UPDATE AnsibleForms.`datasource` SET state='queued', queue_id=(SELECT n FROM (SELECT COALESCE(MAX(queue_id),0)+1 AS n FROM AnsibleForms.`datasource`) t) " +
    "WHERE id=? AND COALESCE(state,'')<>'queued' AND COALESCE(state,'')<>'running'", [id])
  logger.info(`Queued datasource ${id}`)
}
Ds.import = async function(id){
  var status="success"
  var output
  var ds = await Ds.findById(id)
  if(ds.length==0){
    throw `Datasource with id '${id}' not found`
  }
  ds=ds[0]

  // Claim the row before doing any work - the same three faults Schedule.launch had.
  //
  // Nothing ever wrote state='running', so the queue processor's "is one still running"
  // guard (init/index.js) never matched, and the row stayed 'queued' for the whole run.
  await mysql.do("update AnsibleForms.`datasource` set state='running' where id = ?",[id])

  try{
    // All of this is inside the try now. Parsing used to happen before it, so a
    // datasource whose extra_vars were not a mapping - malformed yaml, a scalar, or a
    // document that parses to null - threw out of import() with the row still 'queued'.
    // The processor selects ORDER BY queue_id LIMIT 1, so that one row was retried every
    // 10 seconds for ever AND head-of-line blocked every other datasource behind it.
    // get the form data
    var form = ds.form
    // var extravars = ds
    var user = {}
    var extravars = yaml.parse(ds.extra_vars || '{}')
    // null and arrays are also typeof 'object' ; those reached the assignment below and
    // died with an unhelpful TypeError
    if (typeof extravars !== 'object' || extravars === null || Array.isArray(extravars)) {
      throw new Error("Extra vars is not a valid dictionary.")
    }
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
    // Job.launch is fire-and-forget and returns { id } - always truthy - so the else
    // below was unreachable and a datasource whose playbook failed still read 'success'
    // (with a literal "Result : [object Object]" in the output). Report what is actually
    // known: the job was STARTED, and name it so the operator can follow it.
    const launched = await Job.launch({ form, user, extravars })
    if(launched?.id){
      output = `The datasource started job ${launched.id}.\nThis says the job was launched, not that the data is correct - open that job to see how it ended.`
    }else{
      output = `The datasource ran but no job was created.\nCheck the job log that launched the datasource for more details.`
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
