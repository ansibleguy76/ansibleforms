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
    this.status = job.status;
    this.stdout = job.stdout;
    this.stderr job.stderr;
};
Job.create = function (record, result) {
    logger.debug(`Creating job`)
    mysql.query("ANSIBLEFORMS_DATABASE","INSERT INTO AnsibleForms.`jobs` set ?", record, function (err, res) {
        if(err) {
            result(err, null);
        }
        else{
            result(null, res.insertId);
        }
    });
};
Job.update = function (record,id, result) {
  logger.debug(`Updating job ${id}`)
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
      mysql.query("ANSIBLEFORMS_DATABASE","SELECT * FROM AnsibleForms.`jobs` WHERE id=?;",id, function (err, res) {
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

module.exports= Job;
