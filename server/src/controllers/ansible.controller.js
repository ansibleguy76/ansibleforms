'use strict';
const Ansible = require('../models/ansible.model');
const Job = require('../models/job.model');
var RestResult = require('../models/restResult.model');
const Credential = require('../models/credential.model');
const logger=require("../lib/logger");
const dbConfig = require('../../config/db.config')

async function getCredential(name){

}

exports.run = async function(req, res) {
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
        for (const [key, value] of Object.entries(req.body.ansibleCredentials)) {
          if(value=="__self__"){
            req.body.ansibleExtraVars[key]={
              host:dbConfig.host,
              user:dbConfig.user,
              port:dbConfig.port,
              password:dbConfig.password
            }
          }else{
            try{
              req.body.ansibleExtraVars[key]=await Credential.findByName(value)
            }catch(err){
              logger.error(err)
            }

          }
        }
        var extraVars = JSON.stringify(req.body.ansibleExtraVars);
        var user = req.user.user

        var restResult = new RestResult("info","","","")

        if(!playbook){
          // wrong implementation -> send 400 error
          res.json(new RestResult("error","no ansiblePlaybook","","ansiblePlaybook is a required field"));
        }else{
          logger.info("Running playbook : " + playbook)
          logger.silly("extravars : " + extraVars)
          logger.silly("inventory : " + inventory)
          logger.silly("tags : " + tags)
          Ansible.run(form,playbook,inventory,tags,extraVars,user,function(err,out){
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
