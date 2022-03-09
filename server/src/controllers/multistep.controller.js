'use strict';
const Multistep = require('../models/multistep.model');
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
        var steps = req.body.multiSteps;
        var extraVars = req.body.multiExtraVars;
        var user = req.user.user
        var creds = req.body.credentials

        if(!steps){
          // wrong implementation -> send 400 error
          res.json(new RestResult("error","no steps","","steps is a required field"));
        }else{
          logger.info("Launching workflow : " + JSON.stringify(steps))
          Multistep.launch(form,steps,extraVars,user,creds,function(err,job){
              if (err){
                restResult.status = "error"
                restResult.message = "failed to launch multistep " + form
                restResult.data.error = err
              }else{
                restResult.message = "successfully launched multistep " + form
                restResult.data.output = job
              }
              res.json(restResult)
          })
        }

    }
};
