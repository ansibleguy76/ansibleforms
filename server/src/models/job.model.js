'use strict';
const logger=require("../lib/logger");
const authConfig = require('../../config/auth.config')
const Helpers = require('../lib/common.js')
const appConfig = require('../../config/app.config')
const mysql = require('./db.model')
const moment= require('moment')

//job object create
var Job=function(job){
    if(job.form && job.form!=""){ // first time insert
      this.form = job.form;
      this.target = job.target;
      this.user = job.user;
      this.user_type = job.user_type;
      this.job_type = job.job_type;
      this.start = moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')
      this.extravars = Helpers.logSafe(job.extravars);
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
    var query = "SELECT id,form,target,status,start,end,user,user_type,job_type FROM AnsibleForms.`jobs` ORDER BY id DESC LIMIT 500;"
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
      // get normal data
      mysql.query("SELECT `status`,`extravars`,`job_type` FROM AnsibleForms.`jobs` WHERE jobs.id=?;",id, function (err, res) {
          if(err) {
              result(err, null);
          }
          else{
            var status=res[0].status
            var extravars=res[0].extravars
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
                    if(!text){
                      var lines = record.split('\n')
                      var previousformat=""
                      lines.forEach((line,i)=>{
                        matchfound=false
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
                          if(line.match('ok=.*changed.*')){
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
                      })
                    }
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
                  result(null, [{status:status,extravars:extravars,job_type:job_type,output:output.join('\r\n')}]);
                }
              })
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
