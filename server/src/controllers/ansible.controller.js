'use strict';
const Ansible = require('../models/ansible.model');
var RestResult = require('../models/restResult.model');
const Credential = require('../models/credential.model');
const logger=require("../lib/logger");
const dbConfig = require('../../config/db.config')

exports.do = async function(form,playbook,inv,check,diff,tags,user,creds,ev,res,next){
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
    var inventory = []
    if(inv){
      inventory.push(inv)
    }
    if(extraVars["__inventory__"]){
        ([].concat(extraVars["__inventory__"])).forEach((item, i) => {
          if(typeof item=="string"){
            inventory.push(item)
          }else{
            logger.warning("Non-string inventory entry")
          }
        });
    }
    var restResult = new RestResult("info","","","")
    extraVars = JSON.stringify(extraVars);
    if(!playbook){
      // wrong implementation -> send 400 error
      if(res)
        res.json(new RestResult("error","no ansiblePlaybook","","ansiblePlaybook is a required field"));
      if(next)next("no playbook")
      reject("no playbook")
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
           if(next)
             next("error " + err.toString(),null)
           reject(err.toString())
        }else{
           restResult.message = "succesfully launched playbook " + playbook
           restResult.data.output = out
           if(next)
             next(null,out)

        }
        // send response
        if(res)
          res.json(restResult);
      },()=>{
        resolve(true)
      },(err)=>{
        reject(err)
      })
    }
  })
}
exports.launch = async function(req, res) {
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        // wrong implementation -> send 400 error
        res.json(new RestResult("error","no data was sent","",""));
    }else{
        // get the form data
        var form = req.body.formName;
        var playbook = req.body.ansiblePlaybook;
        var inventory = req.body.ansibleInventory
        var check = req.body.ansibleCheck || req.body.ansibleExtraVars?.__check__;
        var diff = req.body.ansibleDiff || req.body.ansibleExtraVars?.__diff__;
        var tags = req.body.ansibleTags;
        var extraVars = req.body.ansibleExtraVars
        var creds = req.body.credentials
        var user = req.user.user
        exports.do(form,playbook,inventory,check,diff,tags,user,creds,extraVars,res)
          .catch((e)=>{
            logger.error(e)
            //res.json(new RestResult("error",e,"",""));
          })
    }
};
