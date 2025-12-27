'use strict';
import Job from '../models/job.model.js';
import RestResultv2 from '../models/restResult.model.v2.js';
import logger from "../lib/logger.js";
import stream from 'stream';

const abortJob = async function(req, res) {
  var jobid = req.params.id;
  if(!jobid){
    res.status(409).json(RestResultv2.error("You must provide a jobid"));
    return false
  }
  try {
    await Job.abort(jobid);
    res.status(200).json(RestResultv2.single({ message: "Job abort requested" }));
  } catch (err) {
    if (err.name === 'NotFoundError') {
      res.status(404).json(RestResultv2.error(err.message));
    } else if (err.name === 'ConflictError') {
      res.status(409).json(RestResultv2.error(err.message));
    } else if (err.name === 'AccessDeniedError') {
      res.status(403).json(RestResultv2.error(err.message));
    } else {
      res.status(500).json(RestResultv2.error("Failed to abort job", err.toString()));
    }
  }
};
const getJob = async function(req, res) {
  var user = req.user.user
  try {
    const job = await Job.findById(user, req.params.id, (req.query.text == "true"), true)
    var restData = job
    restData.extravars = JSON.parse(job.extravars || "{}")
    restData.credentials = JSON.parse(job.credentials || "{}")
    restData.approval = JSON.parse(job.approval || "{}")
    restData.notifications = JSON.parse(job.notifications || "{}")
    restData.subjobs = (job.subjobs || "").split(",").filter(x => x != "").map(x => parseInt(x))
    res.status(200).json(RestResultv2.single(restData));
  } catch (err) {
    if (err.name === 'NotFoundError') {
      res.status(404).json(RestResultv2.error(err.message));
    } else if (err.name === 'AccessDeniedError') {
      res.status(403).json(RestResultv2.error(err.message));
    } else {
      res.status(500).json(RestResultv2.error("Failed to retrieve job", err.toString()));
    }
  }
};
const findAllJobs = async function(req, res) {
    var user = req?.user?.user || {}
    var records = req.query.records || 500
    try{
      const jobs = await Job.findAll(user,records)
      res.status(200).json(RestResultv2.list(jobs));
    }catch(err){
      res.status(500).json(RestResultv2.error("Failed to retrieve jobs", err.toString()));
    }
};
const findApprovals = async function(req, res) {
    var user = req.user.user
    try{
      const count = await Job.findApprovals(user)
      res.status(200).json(RestResultv2.single(count));
    }catch(err){
      res.status(500).json(RestResultv2.error("Failed to retrieve approval jobs", err.toString()));
    }
};
const download = async function(req,res){
  try{
    var user = req.user.user
    var job = await Job.findById(user,req.params.id,true,true)

    var fileName = `ansibleforms-job-${job.id}.txt`;
    var joboutput = job.output || ""
    // convert output string to stream

    var readStream = new stream.PassThrough();
    readStream.write(joboutput);
    readStream.end();
  
    res.set('Content-disposition', 'attachment; filename="' + fileName + '"');
    res.set('Content-Type', 'text/plain');
  
    readStream.pipe(res);

  }catch (err) {
    if (err.name === 'NotFoundError') {
      res.status(404).json(RestResultv2.error(err.message));
    } else if (err.name === 'AccessDeniedError') {
      res.status(403).json(RestResultv2.error(err.message));
    } else {
      res.status(500).json(RestResultv2.error("Failed to retrieve job", err.toString()));
    }
  }
}
const getRawFormData = async function(req, res) {
  try {
    var user = req.user.user;
    const rawFormData = await Job.getRawFormData(user, req.params.id);
    res.status(200).json(RestResultv2.single(rawFormData));
  } catch (err) {
    if (err.name === 'NotFoundError') {
      res.status(404).json(RestResultv2.error(err.message));
    } else if (err.name === 'AccessDeniedError' || err.name === 'ForbiddenError') {
      res.status(403).json(RestResultv2.error(err.message));
    } else if (err.name === 'BadRequestError') {
      res.status(400).json(RestResultv2.error(err.message));
    } else {
      res.status(500).json(RestResultv2.error("Failed to retrieve raw form data", err.toString()));
    }
  }
};
const deleteJob = async function(req, res) {
  try {
    var user = req?.user?.user || {};
    await Job.delete(user, req.params.id);
    res.status(200).json(RestResultv2.single({ message: "job deleted" }));
  } catch (err) {
    if (err.name === 'NotFoundError') {
      res.status(404).json(RestResultv2.error(err.message));
    } else if (err.name === 'AccessDeniedError') {
      res.status(403).json(RestResultv2.error(err.message));
    } else {
      res.status(500).json(RestResultv2.error("Failed to delete job", err.toString()));
    }
  }
};
// this is the main launch code for everything
const launch = async function(req, res) {
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        // wrong implementation -> send 409 error
        res.status(409).json(RestResultv2.error("No data was sent"));
    }else{
        // get the form data
        var form = req.body.formName || "";
        var extravars = req.body.extravars || {}
        var creds = req.body.credentials || {}
        var rawFormData = req.body.rawFormData || {}
        // new in 4.0.16, awxCreds are extracted from form and extravars
        var user = req?.user?.user || {}
        extravars.ansibleforms_user = user
        try{
          const job = await Job.launch(form,null,user,creds,extravars,null,rawFormData);
          res.status(200).json(RestResultv2.single(job));
        }catch(err){
          logger.error("Errors in job launch : ", err)
          try{
            res.status(500).json(RestResultv2.error("Failed to launch form", err.toString()));
          }catch(e){}
        }
    }
};
const relaunchJob = async function(req, res) {

    // get the form data
    var jobid = req.params.id;
    var verbose = (req.query.verbose || "false")=="true"
    if(!jobid){
      res.status(409).json(RestResultv2.error("You must provide a jobid"));
      return false
    }
    var user = req?.user?.user || {}
    try{
      const job = await Job.relaunch(user, jobid, verbose);
      res.status(200).json(RestResultv2.single({ message: `Job has been relaunched with job id ${job.id}`, id: job.id }));
    } catch(err) {
      if (err.name === 'NotFoundError') {
        res.status(404).json(RestResultv2.error(err.message));
      } else if (err.name === 'AccessDeniedError' || err.name === 'ForbiddenError') {
        res.status(403).json(RestResultv2.error(err.message));
      } else if (err.name === 'ConflictError') {
        res.status(409).json(RestResultv2.error(err.message));
      } else {
        logger.error("Error relaunching job: ", err);
        res.status(500).json(RestResultv2.error("Failed to relaunch job", err.toString()));
      }
    }
};
const approveJob = async function(req, res) {

    // get the form data
    var jobid = req.params.id;
    if(!jobid){
      res.status(409).json(RestResultv2.error("You must provide a jobid"));
      return false
    }
    var user = req?.user?.user || {}
    try{
      await Job.approve(user,jobid);
      res.status(200).json(RestResultv2.single({ message: `Job ${jobid} has been approved` }));
    }catch(err){
      logger.error("Error : ", err)
      res.status(500).json(RestResultv2.error("Failed to approve job", err.toString()));
    }    
};
const rejectJob = async function(req, res) {

    // get the form data
    var jobid = req.params.id;
    if(!jobid){
      res.status(409).json(RestResultv2.error("You must provide a jobid"));
      return false
    }
    var user = req?.user?.user || {}
    try{
      await Job.reject(user,jobid)
      res.status(200).json(RestResultv2.single({ message: `Job ${jobid} has been rejected` }));
    }catch(err){
      logger.error("Error : ", err)
      res.status(500).json(RestResultv2.error("Failed to reject job", err.toString()));
    }    

};

export default {
  abortJob,
  getJob,
  findAllJobs,
  findApprovals,
  download,
  getRawFormData,
  deleteJob,
  launch,
  relaunchJob,
  approveJob,
  rejectJob
};