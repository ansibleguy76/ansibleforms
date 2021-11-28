'use strict';
const Ansible = require('../models/ansible.model');
const Job = require('../models/job.model');
var RestResult = require('../models/restResult.model');
const logger=require("../lib/logger");

exports.run = function(req, res) {
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        // wrong implementation -> send 400 error
        res.json(new RestResult("error","no data was sent","",""));
    }else{
        // get the form data
        var form = req.body.ansibleForm;
        var playbook = req.body.ansiblePlaybook;
        var inventory = req.body.ansibleInventory;
        var tags = req.body.ansibleTags;
        var extraVars = JSON.stringify(req.body);

        var restResult = new RestResult("info","","","")

        if(!playbook){
          // wrong implementation -> send 400 error
          res.json(new RestResult("error","no ansiblePlaybook","","ansiblePlaybook is a required field"));
        }else{
          logger.info("Running playbook : " + playbook)
          logger.debug("extravars : " + extraVars)
          logger.debug("inventory : " + inventory)
          logger.debug("tags : " + tags)
          Ansible.run(form,playbook,inventory,tags,extraVars,function(err,out){
            if(err){
               restResult.status = "error"
               restResult.message = "error occured while running playbook " + playbook
               restResult.data.error = err.toString()
            }else{
               restResult.message = "succesfully launched playbook"
               restResult.data.output = out

            }
            // send response
            res.json(restResult);
          })
        }

    }
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
exports.abortJob = function(req, res) {
    Job.update({status:"abort"},req.params.id, function(err, job) {
        if (err){
            res.json(new RestResult("error","failed to abort job",null,err))
        }else{
            res.json(new RestResult("success","job aborted",null,""));
        }
    });
};
exports.getJob = function(req, res) {
    Job.findById(req.params.id, function(err, job) {
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
              restResult.data.output = job[0].output
              res.json(restResult);
            }else{
              res.json(new RestResult("error","failed to find job",null,"No such job"))
            }
        }
    });
};
