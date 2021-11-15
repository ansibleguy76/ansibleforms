'use strict';
const logger=require("../lib/logger");
const authConfig = require('../../config/auth.config')
const helpers = require('../lib/common.js')
const appConfig = require('../../config/app.config')
const mysql = require('../lib/mysql')

//job object create
var Job=function(job){
    if(job.command && job.command!=""){
      this.command = job.command;
    }
    if(job.status && job.status!=""){
      this.status = job.status;
    }
};
Job.create = function (record, result) {
  logger.debug(`Creating job`)
  try{
    mysql.query("ANSIBLEFORMS_DATABASE","INSERT INTO AnsibleForms.`jobs` set ?", record, function (err, res) {
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
    mysql.query("ANSIBLEFORMS_DATABASE","UPDATE AnsibleForms.`jobs` set ? WHERE id=?", [record,id], function (err, res) {
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
Job.createOutput = function (record, result) {
  // logger.silly(`Creating job output`)
  try{
    mysql.query("ANSIBLEFORMS_DATABASE","INSERT INTO AnsibleForms.`job_output` set ?", record, function (err, res) {
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
    mysql.query("ANSIBLEFORMS_DATABASE","DELETE FROM AnsibleForms.`jobs` WHERE id = ? AND jobname<>'admin'", [id], function (err, res) {
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
    var query = "SELECT * FROM AnsibleForms.`jobs` limit 20 ORDER BY id DESC;"
    try{
      mysql.query("ANSIBLEFORMS_DATABASE",query,null, function (err, res) {
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
Job.findById = function (id,result) {
    logger.debug(`Finding job ${id}`)
    try{
      mysql.query("ANSIBLEFORMS_DATABASE","SELECT `status`,output,`timestamp`,output_type FROM AnsibleForms.`jobs` INNER JOIN AnsibleForms.`job_output` ON jobs.id=job_output.job_id WHERE jobs.id=? ORDER by job_output.id;",id, function (err, res) {
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
                el.output.trim('\r\n').replace('\r\n','\n').split('\n').forEach(function(el2,i){
                  if(el2!="" && !addedTimestamp){
                    el2+=" <span class='tag is-info is-light'>"+el.timestamp+"</span>"
                    addedTimestamp=true
                  }
                  if(el.output_type=="stderr"){
                    el2 = "<span style='color:red'>"+el2+"</span>"
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
