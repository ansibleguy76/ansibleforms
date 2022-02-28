'use strict';
const Ansible = require('../models/ansible.model');
const Awx = require('../models/awx.model');
const Git = require('../models/git.model');
var RestResult = require('../models/restResult.model');
const logger=require("../lib/logger");


exports.launch = async function(req, res) {
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        // wrong implementation -> send 400 error
        res.json(new RestResult("error","no data was sent","",""));
    }else{
        // get the form data
        var restResult = new RestResult("info","","","")
        var form = req.body.formName;
        var workflow = req.body.workflow;
        var extraVars = JSON.stringify(req.body.extraVars);
        var user = req.user.user

        if(!workflow){
          // wrong implementation -> send 400 error
          res.json(new RestResult("error","no workflow","","workflow is a required field"));
        }else{
          logger.info("Launching workflow : " + JSON.stringify(workflow))
          logger.silly("extravars : " + extraVars)
          // workflow.
          // Workflow.launch(form,workflow,extraVars,user,function(err,out){
          //   if(err){
          //      restResult.status = "error"
          //      restResult.message = "error occured while launching workflow " + workflow.name
          //      restResult.data.error = err.toString()
          //   }else{
          //      restResult.message = "succesfully launched"
          //      restResult.data.output = out
          //
          //   }
          //   // send response
          //   res.json(restResult);
          // })
        }

    }
};
