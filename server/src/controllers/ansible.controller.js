'use strict';
const Ansible = require('../models/ansible.model');
var RestResult = require('../models/restResult.model');
const Credential = require('../models/credential.model');
const logger=require("../lib/logger");
const dbConfig = require('../../config/db.config')

exports.launch = async function(req, res) {
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        // wrong implementation -> send 400 error
        res.json(new RestResult("error","no data was sent","",""));
    }else{
        // get the form data
        var restResult = new RestResult("info","","","")
        var form = req.body.formName;
        var playbook = req.body.ansiblePlaybook;
        var inventory = []
        if(req.body.ansibleInventory){
          inventory.push(req.body.ansibleInventory)
        }
        if(req.body.ansibleExtraVars["__inventory__"]){
            ([].concat(req.body.ansibleExtraVars["__inventory__"])).forEach((item, i) => {
              if(typeof item=="string"){
                inventory.push(item)
              }else{
                logger.warning("Non-string inventory entry")
              }
            });
        }
        var check = req.body.ansibleCheck || req.body.ansibleExtraVars.__check__;
        var diff = req.body.ansibleDiff || req.body.ansibleExtraVars.__diff__;
        var tags = req.body.ansibleTags;
        if(req.body.credentials){
          for (const [key, value] of Object.entries(req.body.credentials)) {
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
        }
        var extraVars = JSON.stringify(req.body.ansibleExtraVars);
        var user = req.user.user



        if(!playbook){
          // wrong implementation -> send 400 error
          res.json(new RestResult("error","no ansiblePlaybook","","ansiblePlaybook is a required field"));
        }else{
          logger.info("Running playbook : " + playbook)
          logger.silly("extravars : " + extraVars)
          logger.silly("inventory : " + inventory)
          logger.silly("check : " + check)
          logger.silly("diff : " + diff)
          logger.silly("tags : " + tags)
          Ansible.launch(form,playbook,inventory,tags,check,diff,extraVars,user,function(err,out){
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
