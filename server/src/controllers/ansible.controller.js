'use strict';
const Ansible = require('../models/ansible.model');
var RestResult = require('../models/restResult.model');
const logger=require("../lib/logger");

exports.run = function(req, res) {
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        // wrong implementation -> send 400 error
        res.json(new RestResult("error","no data was sent","",""));
    }else{
        // get the form data
        var playbook = req.body.ansiblePlaybook;
        var inventory = req.body.ansibleInventory;
        var tags = req.body.ansibleTags;
        var extraVars = JSON.stringify(req.body);

        var restResult = new RestResult("success","","","")

        if(!playbook){
          // wrong implementation -> send 400 error
          res.json(new RestResult("error","no ansiblePlaybook","","ansiblePlaybook is a required field"));
        }else{
          logger.info("Running playbook : " + playbook)
          logger.debug("extravars : " + extraVars)
          logger.debug("inventory : " + inventory)
          logger.debug("tags : " + tags)
          Ansible.run(playbook,inventory,tags,extraVars,function(err,stdout,stderr){
            if(err){
               restResult.status = "error"
               restResult.message = "error occured while running playbook " + playbook
               restResult.data.error = err.toString()
            }else{
               restResult.message = "succesfully ran playbook"
               restResult.data.output = stdout
               restResult.data.error = stderr
            }
            // send response
            res.json(restResult);
          })
        }

    }
};
