'use strict';
import Job from '../models/job.model.js';
import RestResult from '../models/restResult.model.js';
import logger from "../lib/logger.js";
import stream from 'stream';

const abortJob = function(req, res) {
  var jobid = req.params.id;
  if(!jobid){
    res.json(new RestResult("error","You must provide a jobid","",""));
    return false
  }
  Job.abort(jobid)
    .then((job)=>{res.json(new RestResult("success","job aborted",null,""))})
    .catch((err)=>{res.json(new RestResult("error","failed to abort job",null,err.toString()))})
};
const getJob = async function(req, res) {
  var user = req.user.user
  try {
    const job = await Job.findById(user,req.params.id,(req.query.text=="true"),true)

    var restResult = new RestResult("info","job is running",null,null)
    var jobStatus = job.status

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
    restResult.data = job
    // change in 5.0.2, result is now objects
    restResult.data.extravars = JSON.parse(job.extravars || "{}")
    restResult.data.credentials = JSON.parse(job.credentials || "{}")
    restResult.data.approval = JSON.parse(job.approval || "{}")
    restResult.data.notifications = JSON.parse(job.notifications || "{}")
    restResult.data.subjobs = (job.subjobs || "").split(",").filter(x=>x!="").map(x=>parseInt(x))
    res.json(restResult);
  }catch (err) {
    logger.error("Failed to retrieve job : ", err)
    res.json(new RestResult("error","Failed to retrieve job",null,err.toString()));
  }

};
const findAllJobs = function(req, res) {
    var user = req?.user?.user || {}
    var records = req.query.records || 500
    Job.findAll(user,records)
    .then((jobs)=>{res.json(new RestResult("success","jobs found",jobs,""))})
    .catch((err)=>{res.json(new RestResult("error","failed to find jobs",null,err.toString()))})
};
const findApprovals = function(req, res) {
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
const download = async function(req,res){
  try{
    var user = req.user.user
    const job = await Job.findById(user,req.params.id,true,true)

    var fileName = `ansibleforms-job-${job.id}.txt`;
    var joboutput = job.output || ""
    // convert output string to stream

    var readStream = new stream.PassThrough();
    readStream.write(joboutput);
    readStream.end();
  
    res.set('Content-disposition', 'attachment; filename="' + fileName + '"');
    res.set('Content-Type', 'text/plain');
  
    readStream.pipe(res);

  }catch(err){
      // return 404
      res.status(404).send(err.toString())
  }
}
const deleteJob = function(req, res) {
    var user = req?.user?.user || {};
    Job.delete(user, req.params.id)
    .then((job)=>{res.json(new RestResult("success","job deleted",null,""))})
    .catch((err)=>{res.json(new RestResult("error","failed to delete job",null,err))})
};
// this is the main launch code for everything
const launch = async function(req, res) {
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
          const job = await Job.launch(form,null,user,creds,extravars,null);
          res.json(new RestResult("success","succesfully launched form",job,""))
        }catch(err){
          logger.error("Errors in job launch : ", err)
          try{
            res.json(new RestResult("success","failed to launch form",null,err.toString()))
          }catch(e){}
        }
    }
};
const relaunchJob = async function(req, res) {

    // get the form data
    var jobid = req.params.id;
    var verbose = (req.query.verbose || "false")=="true"
    if(!jobid){
      res.json(new RestResult("error","You must provide a jobid","",""));
      return false
    }
    var user = req?.user?.user || {}
    try{
      const job = await Job.relaunch(user, jobid, verbose);
      res.json(new RestResult("success",`Job has been relaunched with job id ${job.id}`,"",""))
    }catch(err){
      logger.error("Error : ", err)
      res.json(new RestResult("error",`Failed to relaunch : ${err.toString()}`,"",""))
    }
};
const approveJob = async function(req, res) {

    // get the form data
    var jobid = req.params.id;
    if(!jobid){
      res.json(new RestResult("error","You must provide a jobid","",""));
      return false
    }
    var user = req?.user?.user || {}
    try{
      await Job.approve(user,jobid);
      res.json(new RestResult("success",`job ${jobid} has been approved`,null,""))
    }catch(err){
      logger.error("Error : ", err)
      res.json(new RestResult("error",`Failed to approve : ${err.toString()}`,"",""))
    }    
};
const rejectJob = async function(req, res) {

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

export default {
  abortJob,
  getJob,
  findAllJobs,
  findApprovals,
  download,
  deleteJob,
  launch,
  relaunchJob,
  approveJob,
  rejectJob
};