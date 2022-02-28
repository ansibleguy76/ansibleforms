'use strict';
const Awx = require('../models/awx.model');
var RestResult = require('../models/restResult.model');
var Credential = require('../models/credential.model');
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
           if(jobStatus=="canceled"){
             status = "warning"
             message = "job is canceled"
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
exports.check = function(req, res) {
  Awx.check(new Awx(req.body),function(err, awx) {
    if(err){
      res.json(new RestResult("error",err))
    }else{
      res.json(new RestResult("success",awx))
    }
  });

};
exports.do = async function(form,jobTemplateName,inventory,check,diff,jobTags,user,creds,ev,res,next){
  return new Promise(async (resolve,reject) => {
    var extraVars = {...ev}
    if(creds){
      for (const [key, value] of Object.entries(creds)) {
        if(value=="__self__"){
          extraVars[key]={
            host:dbConfig.host,
            user:dbConfig.user,
            port:dbConfig.port,
            password:dbConfig.password
          }
        }else{
          try{
            extraVars[key]=await Credential.findByName(value)
          }catch(err){
            logger.error(err)
          }

        }
      }
    }

    extraVars = JSON.stringify(extraVars);

    logger.info("Running template : " + jobTemplateName)
    logger.debug("extravars : " + extraVars)
    logger.debug("inventory : " + inventory)
    logger.debug("check : " + check)
    logger.debug("diff : " + diff)
    logger.debug("tags : " + jobTags)

    var restResult = new RestResult("info","")

    if(!jobTemplateName){
      // wrong implementation -> send 400 error
      if(res)
        res.status(400).json(new RestResult("error","no awxJobTemplate","","awxJobTemplate is a required field"));
      if(next)
        next("error no job template",null)
      reject(err)
    }else{

      Awx.findJobTemplateByName(jobTemplateName, function(err, jobTemplate) {
          if (err){

            restResult.status = "error"
            restResult.message = "failed to launch jobtemplate " + jobTemplateName
            restResult.data.error = err
            // send response
            if(res)
              res.json(restResult)
            if(next)
              next("error " + err,null)
            reject(err)
          }else{
              logger.silly("Found jobtemplate, id = " + jobTemplate.id)
              if(inventory){
                Awx.findInventoryByName(inventory,function(err,inventory){
                  if (err){
                    restResult.status = "error"
                    restResult.message = "failed to launch jobtemplate " + jobTemplate.name
                    restResult.data.error = err
                    if(res)
                      res.json(restResult)
                    if(next)
                      next("error " + err,null)
                    reject(err)
                  }else{
                    logger.silly("Found inventory, id = " + inventory.id)
                    Awx.launch(form,jobTemplate,inventory,jobTags,check,diff,extraVars,user,function(err,job){
                        if (err){
                          restResult.status = "error"
                          restResult.message = "failed to launch jobtemplate " + jobTemplate.name
                          restResult.data.error = err
                          if(next)
                            next("error " + err,null)
                          reject(err)
                        }else{
                          restResult.message = "successfully launched jobtemplate " + jobTemplate.name
                          restResult.data.output = job
                          if(next)
                            next(null,job)
                          resolve(true)
                        }
                        if(res)
                          res.json(restResult)
                    },()=>{
                      resolve(true)
                    },(err)=>{
                      reject(err)
                    })
                  }
                })
              }else{
                Awx.launch(form,jobTemplate,undefined,jobTags,check,diff,extraVars,user,function(err,job){
                    if (err){
                      restResult.status = "error"
                      restResult.message = "failed to launch jobtemplate " + jobTemplate.name
                      restResult.data.error = err
                      if(next)
                        next("error " + err,null)
                      reject(err)
                    }else{
                      restResult.message = "successfully launched jobtemplate " + jobTemplate.name
                      restResult.data.output = job
                      if(next)
                        next(null,job)

                    }
                    if(res)
                      res.json(restResult)
                },()=>{
                  resolve(true)
                },(err)=>{
                  reject(err)
                })
              }

          }
      })
    }
  })
}
exports.launch = async function(req, res) {
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).json(RestResult("error","no data was sent","",""));
    }else{
        // get the form data
        var form = req.body.formName;
        var jobTemplateName = req.body.awxTemplate;
        var inventory = req.body.awxInventory;
        var check = req.body.awxCheck || req.body.awxExtraVars.__check__;
        var diff = req.body.awxDiff || req.body.awxExtraVars.__diff__;
        var jobTags = req.body.awxTags;
        var user = req.user.user
        var creds = req.body.credentials
        var extraVars = req.body.awxExtraVars

        exports.do(form,jobTemplateName,inventory,check,diff,jobTags,user,creds,extraVars,res)
          .catch((e)=>{
            res.json(new RestResult("error",e,"",""));
          })

    }
};
exports.find = function(req, res) {
    Awx.find(function(err, awx) {
        if (err){
          res.json(new RestResult("error","Failed to find awx",null,err))
        }else{
          res.json(new RestResult("success","Awx found",awx,""));
        }
    });
};
exports.update = function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Awx.update(new Awx(req.body), function(err, awx) {
            if (err){
                res.json(new RestResult("error","Failed to update awx",null,err))
            }else{
                res.json(new RestResult("success","Awx updated",null,""));
            }
        });
    }
};
