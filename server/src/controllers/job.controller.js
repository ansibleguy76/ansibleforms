'use strict';
const Job = require('../models/job.model');
var RestResult = require('../models/restResult.model');
const Credential = require('../models/credential.model');
const logger=require("../lib/logger");
const dbConfig = require('../../config/db.config')

exports.abortJob = function(req, res) {
    Job.abort(req.params.id, function(err, job) {
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
    Job.findById(req.params.id,(req.query.text=="true"), function(err, job) {
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
    });
};
exports.findAllJobs = function(req, res) {
    Job.findAll(function(err, job) {
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
