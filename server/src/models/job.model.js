'use strict';
const logger=require("../lib/logger");
const authConfig = require('../../config/auth.config')
const helpers = require('../lib/common.js')
const appConfig = require('../../config/app.config')
const mysql = require('./db.model')

//job object create
var Job=function(job){
    if(job.form && job.form!=""){ // first time insert
      this.form = job.form;
      this.playbook = job.playbook;
      this.user = job.user;
      this.user_type = job.user_type;
    }
    if(job.status && job.status!=""){ // allow single status update
      this.status = job.status;
    }
    if(job.end && job.end!=""){ // allow single status update
      this.end = job.end;
    }
};
Job.create = function (record, result) {
  logger.debug(`Creating job`)
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
  logger.silly(`Updating job ${id}`)
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
Job.abort = function (id, result) {
  logger.silly(`Updating job ${id}`)
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
  // logger.silly(`Creating job output`)
  try{
    mysql.query("INSERT INTO AnsibleForms.`job_output` set ?;SELECT status FROM AnsibleForms.`jobs` WHERE id=?;", [record,record.job_id], function (err, res) {
        if(err) {
            result(err, null);
        }
        else{
            result(null, res);
        }
        // UPDATE AnsibleForms.`jobs` set status='running' WHERE id=?;
    });
  }catch(err){
    result(err, null);
  }
};
Job.delete = function(id, result){
  logger.debug(`Deleting job ${id}`)
  try{
    mysql.query("DELETE FROM AnsibleForms.`jobs` WHERE id = ?", [id], function (err, res) {
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
Job.findAll = function (result) {
    logger.debug("Finding all jobs")
    var query = "SELECT * FROM AnsibleForms.`jobs` ORDER BY id DESC LIMIT 500;"
    try{
      mysql.query(query,null, function (err, res) {
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
Job.findById = function (id,text,result) {
    logger.debug(`Finding job ${id} | ${text}` )
    try{
      mysql.query("SELECT `status`,COALESCE(output,'') output,COALESCE(`timestamp`,'') `timestamp`,COALESCE(output_type,'stdout') output_type FROM AnsibleForms.`jobs` LEFT JOIN AnsibleForms.`job_output` ON jobs.id=job_output.job_id WHERE jobs.id=? ORDER by job_output.order;",id, function (err, res) {
          if(err) {
              result(err, null);
          }
          else{
            if(res.length>0){
              var status=res[0].status
              var output=[]
              res.forEach(function(el){
                var addedTimestamp=false
                var output2=[]
                var record = el.output.trim('\r\n')
                if(!text){
                  if(el.output_type=="stderr"){
                    // mark errors
                    if(record.match(/^\[WARNING\].*/gm)){
                      record = "<span class='has-text-warning'>"+record+"</span>"
                    }else{
                      record = "<span class='has-text-danger'>"+record+"</span>"
                    }

                  }else{
                    // mark play / task lines as bold
                    if(record.match(/^([A-Z]*) \[([^\]]*)\] (\**)$/gm)){
                      record = "<strong>" + record + "</strong>"
                    }
                    // mark succes lines
                    if(record.match(/^(ok): \[([^\]]*)\].*/gm)){
                      record = "<span class='has-text-success'>" + record + "</span>"
                    }
                    // mark change lines
                    if(record.match(/^(changed): \[([^\]]*)\].*/gm)){
                      record = "<span class='has-text-warning'>" + record + "</span>"
                    }
                    // mark skip lines
                    if(record.match(/^(skipping): \[([^\]]*)\].*/gm)){
                      record = "<span class='has-text-info'>" + record + "</span>"
                    }
                    // summary line ?
                    record=record.replace(/(ok=[1-9]+[0-9]*)/g, "<span class='tag is-success'>$1</span>")
                                .replace(/(changed=[1-9]+[0-9]*)/g, "<span class='tag is-warning'>$1</span>")
                                .replace(/(failed=[1-9]+[0-9]*)/g, "<span class='tag is-warning'>$1</span>")
                                .replace(/(unreachable=[1-9]+[0-9]*)/g, "<span class='tag is-warning'>$1</span>")
                                .replace(/(skipped=[1-9]+[0-9]*)/g, "<span class='tag is-info'>$1</span>")
                  }
                }

                record.replace('\r\n','\n').split('\n').forEach(function(el2,i){
                  if(el2!="" && !addedTimestamp && !text){
                    el2+=" <span class='tag is-info is-light'>"+el.timestamp+"</span>"
                    addedTimestamp=true
                  }
                  output2.push(el2)
                })
                output.push(output2.join("\r\n"))
              })
              result(null, [{status:status,output:output.join('\r\n\r\n')}]);
            }else{
              result(null, []);
            }
          }
      });
    }catch(err){
      result(err, null);
    }
};

module.exports= Job;
