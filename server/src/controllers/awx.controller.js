'use strict';
const Awx = require('../models/awx.model');
var RestResult = require('../models/restResult.model');
const logger=require("../lib/logger");

exports.getJob = function(req,res){

    // return the awx job with stdout
    Awx.findJobById(req.params.id,function(err,job){
       if(err){
          res.json(new RestResult("error","could not find job with id " + req.params.id,"",err))
       }else{
           var jobStatus = job.status
           var status = "info"
           if(jobStatus===undefined){
             jobStatus = "pending"
           }
           var message = "job is " + jobStatus
           if(jobStatus=="successful"){
             status = "success"
             message = "job ran successfully"
           }
           if(jobStatus=="failed"){
             status = "error"
             message = "job failed"
           }

           // init result
           var restResult = new RestResult(status,message,"","")

           // get stdout
           Awx.findJobStdout(job,function(err,jobstdout){

              if(err){
                 restResult.data.error = err
              }if(job.status=="failed"){
                 restResult.data.error = jobstdout
              }else{
                 restResult.data.output = jobstdout
              }
              // send response
              res.json(restResult)
           })

       }
    })

}
exports.launch = function(req, res) {
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).json(RestResult("error","no data was sent","",""));
    }else{
        // get the form data
        var jobTemplateName = req.body.awxJobTemplate;
        var inventory = req.body.awxInventory;
        var jobTags = req.body.awxJobTags;
        var extraVars = JSON.stringify(req.body);

        logger.info("Running template : " + jobTemplateName)
        logger.debug("extravars : " + extraVars)
        logger.debug("inventory : " + inventory)
        logger.debug("tags : " + jobTags)

        var restResult = new RestResult("info","")

        if(!jobTemplateName){
          // wrong implementation -> send 400 error
          res.status(400).json(new RestResult("error","no awxJobTemplate","","awxJobTemplate is a required field"));
        }else{

          Awx.findJobTemplateByName(jobTemplateName, function(err, jobTemplate) {
              if (err){
                restResult.status = "error"
                restResult.message = "failed to find jobtemplate " + jobTemplateName
                restResult.data.error = err
                // send response
                res.json(restResult)
              }else{
                Awx.launch(jobTemplate,inventory,jobTags,extraVars,function(err,job){
                    if (err){
                      restResult.status = "error"
                      restResult.message = "failed to launch jobtemplate " + jobTemplate.name
                      restResult.data.error = err
                    }else{
                      restResult.message = "successfully launched jobtemplate " + jobTemplate.name
                      restResult.data.output = job
                    }
                    res.json(restResult)
                })
              }
          })
        }
    }
};
