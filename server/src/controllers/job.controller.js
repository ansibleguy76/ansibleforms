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
    Job.abort(jobid)
     .then((job)=>{res.json(new RestResult("success","job aborted",null,""))})
     .catch((err)=>{res.json(new RestResult("error","failed to abort job",null,err.toString()))})
};
exports.updateJob = function(req, res) {
    Job.update(new Job(req.body),req.params.id)
      .then(()=>{res.json(new RestResult("success","job updated",null,""))})
      .catch((err)=>{res.json(new RestResult("error","failed to update job",null,err.toString()))})
};
exports.getJob = function(req, res) {
  var user = req.user.user
    Job.findById(user,req.params.id,(req.query.text=="true"),true)
      .then((job)=>{
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
          if(jobStatus=="approve"){
            restResult.status = "warning"
            restResult.message = "job is waiting for approval"
          }
          if(jobStatus=="rejected"){
            restResult.status = "warning"
            restResult.message = "job is rejected"
          }
          restResult.data = job[0]
          res.json(restResult);
        }else{
          res.json(new RestResult("error","failed to find job",null,"No such job"))
        }
      })
      .catch((err)=>{res.json(new RestResult("error","failed to find job",null,err.toString()))})

};
exports.findAllJobs = function(req, res) {
    var user = req?.user?.user || {}
    var records = req.query.records || 500
    Job.findAll(user,records)
    .then((jobs)=>{res.json(new RestResult("success","jobs found",jobs,""))})
    .catch((err)=>{res.json(new RestResult("error","failed to find jobs",null,err.toString()))})
};
exports.findApprovals = function(req, res) {
    var user = req.user.user
    Job.findApprovals(user)
    .then((count)=>{
      if(count){
        res.json(new RestResult("success","approval jobs found",count,""));
      }else{
        res.json(new RestResult("success","no approval jobs found",0,""));
      }
    })
    .catch((err)=>{res.json(new RestResult("error","failed to find approval jobs",null,err))})
};
exports.deleteJob = function(req, res) {
    Job.delete( req.params.id)
    .then((job)=>{res.json(new RestResult("success","job deleted",null,""))})
    .catch((err)=>{res.json(new RestResult("error","failed to delete job",null,err))})
};
// this is the main launch code for everything
exports.launch = async function(req, res) {
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        // wrong implementation -> send 400 error
        res.json(new RestResult("error","no data was sent","",""));
    }else{
        // get the form data
        var form = req.body.formName || "";
        var extravars = req.body.extravars || {}
        var creds = req.body.credentials || {}
        // new in 4.0.16, awxCreds are extracted from form and extravars
        var user = req?.user?.user || {}
        extravars.ansibleforms_user = user
        try{
          await Job.launch(form,null,user,creds,extravars,null,function(job){
            res.json(new RestResult("success","succesfully launched form",job,""))
          })
        }catch(err){
          logger.error("Errors : ", err)
          try{
            res.json(new RestResult("success","failed to launch form",null,err.toString()))
          }catch(e){}
        }
    }
};
exports.relaunchJob = async function(req, res) {

    // get the form data
    var jobid = req.params.id;
    if(!jobid){
      res.json(new RestResult("error","You must provide a jobid","",""));
      return false
    }
    var user = req?.user?.user || {}
    try{
      await Job.relaunch(user,jobid,(job)=>{
        res.json(new RestResult("success",`Job has been relaunched with job id ${job.id}`,"",""))
      })
    }catch(err){
      logger.error("Error : ", err)
      res.json(new RestResult("error",`Failed to relaunch : ${err.toString()}`,"",""))
    }
};
exports.approveJob = async function(req, res) {

    // get the form data
    var jobid = req.params.id;
    if(!jobid){
      res.json(new RestResult("error","You must provide a jobid","",""));
      return false
    }
    var user = req?.user?.user || {}
    try{
      await Job.approve(user,jobid,(job)=>{
        res.json(new RestResult("success",`Job ${jobid} has been approved`,"",""))
      })
    }catch(err){
      logger.error("Error : ", err)
      res.json(new RestResult("error",`Failed to approve : ${err.toString()}`,"",""))
    }    
};
exports.rejectJob = async function(req, res) {

    // get the form data
    var jobid = req.params.id;
    if(!jobid){
      res.json(new RestResult("error","You must provide a jobid","",""));
      return false
    }
    var user = req?.user?.user || {}
    try{
      await Job.reject(user,jobid)
      res.json(new RestResult("success",`Job ${jobid} has been rejected`,"",""))
    }catch(err){
      logger.error("Error : ", err)
      res.json(new RestResult("error",`Failed to reject : ${err.toString()}`,"",""))
    }    

};
