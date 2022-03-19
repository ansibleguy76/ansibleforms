'use strict';
const Job = require('../models/job.model');
var RestResult = require('../models/restResult.model');
const Credential = require('../models/credential.model');
const logger=require("../lib/logger");
const dbConfig = require('../../config/db.config')

exports.abortJob = function(req, res) {
  var jobid = req.params.id;
  if(!jobid){
    res.json(new RestResult("error","You must provide a jobid","",""));
    return false
  }
    Job.abort(jobid, function(err, job) {
        if (err){
            res.json(new RestResult("error","failed to abort job",null,err))
        }else{
            res.json(new RestResult("success","job aborted",null,""));
        }
    });
};
exports.updateJob = function(req, res) {
    Job.update(new Job(req.body),req.params.id, function(err, job) {
        if (err){
            res.json(new RestResult("error","failed to update job",null,err))
        }else{
            res.json(new RestResult("success","job updated",null,""));
        }
    });
};
exports.getJob = function(req, res) {
  var user = req.user.user
    Job.findById(user,req.params.id,(req.query.text=="true"), function(err, job) {
        if (err){
            res.json(new RestResult("error","failed to find job",null,err))
        }else{
            if(job.length>0){
              var restResult = new RestResult("info","job is running",null,null)
              var jobStatus = job[0].status
              var message = ""
              var status = ""
              if(jobStatus=="success"){
                restResult.status = "success"
                restResult.message = "job ran successfully"
              }
              if(jobStatus=="warning"){
                restResult.status = "success"
                restResult.message = "job ran partially successful"
              }
              if(jobStatus=="failed"){
                restResult.status = "error"
                restResult.message = "job failed"
              }
              if(jobStatus=="aborted"){
                restResult.status = "warning"
                restResult.message = "job aborted"
              }
              restResult.data = job[0]
              res.json(restResult);
            }else{
              res.json(new RestResult("error","failed to find job",null,"No such job"))
            }
        }
    },true); // mask passwords if requested externally
};
exports.findAllJobs = function(req, res) {
    var user = req.user.user
    var records = req.query.records || 500
    Job.findAll(user,records,function(err, job) {
        if (err){
          res.json(new RestResult("error","failed to find jobs",null,err))
        }else{
          res.json(new RestResult("success","jobs found",job,""));
        }
    });
};
exports.deleteJob = function(req, res) {
    Job.delete( req.params.id, function(err, job) {
        if (err){
            res.json(new RestResult("error","failed to delete job",null,err))
        }else{
            res.json(new RestResult("success","job deleted",null,""));
        }

    });
};
// this is the main launch code for everything
exports.launch = async function(req, res) {
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        // wrong implementation -> send 400 error
        res.json(new RestResult("error","no data was sent","",""));
    }else{
        // get the form data
        var form = req.body.formName;
        var extravars = req.body.extravars
        var creds = req.body.credentials
        var user = req.user.user
        Job.promise(form,null,user,creds,extravars,res)
          .catch((e)=>{
            logger.error(e)
            //res.json(new RestResult("error",e,"",""));
        })
    }
};

exports.relaunchJob = async function(req, res) {

    // get the form data
    var jobid = req.params.id;
    if(!jobid){
      res.json(new RestResult("error","You must provide a jobid","",""));
      return false
    }
    var user = req.user.user
    Job.relaunch(user,jobid,function(err,result){
      if(err){
        res.json(new RestResult("error",err,"",""));
      }else{
        res.json(new RestResult("success",`Job has been relaunched with job id ${result.id}`,"",""));
      }
    })
};
