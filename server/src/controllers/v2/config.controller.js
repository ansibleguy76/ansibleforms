'use strict';
import Form from "../../models/form.model.js";
import Lock from "../../models/lock.model.js";
import Help from "../../models/help.model.js";
import path from "path";
import logger from "../../lib/logger.js";
import helpers from "../../lib/common.js";
import RestResult from "../../models/restResult.model.v2.js";
import os from "os";

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const findList = async function(req,res){
  try{
    var userRoles = req?.user?.user?.roles || []
    logger.info("Getting forms list for roles " + userRoles.join(","))
    var formConfig = await Form.load(userRoles)
    // filter forms based on user roles, only return the forms, only return the properties
    // icon, image, name, description, tileClass
    // remove roles and remove constants
    delete formConfig.roles
    delete formConfig.constants
    // this is sufficient for frontend to display the forms
    res.json(RestResult.single(formConfig))
  }catch(err){
    res.status(500).json(RestResult.error("Failed to get forms list", helpers.getError(err)))
  }
}
const findOne = async function(req,res){
  try{
    var userRoles = req?.user?.user?.roles || []
    var formName = req.query.name
    if(!formName){
      return res.status(400).json(RestResult.error("Form name not provided"))
    }
    logger.info("Getting form config for " + formName)
    var formConfig = await Form.load(userRoles,formName)
    delete formConfig.roles
    delete formConfig.categories
    res.json(RestResult.single(formConfig))

  }catch(err){
    res.status(500).json(RestResult.error("Failed to get form config", helpers.getError(err)))
  }
}
const findAll = async function(req,res){
  try{
    var user = req?.user?.user || {}
    if(!user.roles.includes("admin") && !user.options?.showDesigner){
      return res.status(403).json(RestResult.error("Only admins or designers can access the full forms configuration"))
    }
    var forms = await Form.load(undefined,undefined,true) // true means load all forms, not just the ones for the user
    res.json(RestResult.single(forms))
  }catch(err){
    res.status(500).json(RestResult.error("Failed to get forms configuration", helpers.getError(err)))
  }
}

const backups = function(req,res){
  try{
    var backups = Form.backups()
    res.json(RestResult.single(backups))
  }catch(err){
    res.status(500).json(RestResult.error("Failed to get backups", helpers.getError(err)))
  }
}
const env = async function(req,res){
  try{
    // get help
    var help = await Help.get()
    // only get the environment variables
    var envSection = help.filter(x => x.name=='Environment Variables')[0]
    if(!envSection){
      logger.error("Could not find 'Environment Variables' section in help.yaml")
      return res.status(500).json(RestResult.error("Failed to get environment variables", "Environment Variables section not found in help.yaml"))
    }
    help = envSection.items
    // cleanup a bit (hide passwords and secrets and set default values)
    var env = help.map(x => {
      var item={}
      item.name = x.name
      if(process.env[x.name]){
        item.set=true
        item.value=process.env[x.name]
      }else{
        item.set=false
        item.value=x.default
        if(item.name=='HOME_PATH'){
          item.value=os.homedir()
        }        
        if(item.value && item.value.toString().includes('PERSISTENT')){
          item.value=item.value?.replace("%PERSISTENT_FOLDER%",path.resolve(__dirname + "/../../persistent"))
        }        
      }
      if(x.name.includes('PASSWORD') || x.name.includes('SECRET')){
        item.value="*** NOT REVEALED ***"
      }      
      return item
    });
    res.json(RestResult.single(env))
  }catch(err){
    res.status(500).json(RestResult.error("Failed to get environment variables", helpers.getError(err)))
  }
}
const restore = async function(req,res){
  var lock=undefined
  var user=req.user.user
  try{
    lock = await Lock.status(user)
    if(lock.free){
      lock.set(user).catch(()=>{}) // set lock and fail silent
    }
  }catch(err){
    logger.error("Failed to get lock : ",err)
    return res.status(500).json(RestResult.error("Failed to restore forms", helpers.getError(err,"Failed to get lock : ")))
  }
  if(lock.match || lock.free){
    try{
      var backupName=req.params.backupName
      var backupBeforeRestore=(req.query.backupBeforeRestore=="true")?true:false
      if(!backupName){
        return res.status(400).json(RestResult.error("Failed to restore, no backup name provided"))
      }
      var restore = Form.restore(backupName,backupBeforeRestore)
      if(restore) {
        res.json(RestResult.single(null));
      }else{
        res.status(500).json(RestResult.error(`Failed to restore '${req.params.backupName}'`))
      }
    }catch(err){
      res.status(500).json(RestResult.error("Failed to restore forms", helpers.getError(err)))
    }
  }else{
    res.status(423).json(RestResult.error("Designer is locked", "Designer is locked by "+lock.lock.username))
  }
}
const save = async function(req,res){
  var lock=undefined
  var user=req.user.user
  try{
    lock = await Lock.status(user)
    if(lock.free){
      try{
        await Lock.set(user)
      }catch(err){
        // fail silent
      }
    }
  }catch(err){
    logger.error("Failed to get lock : ",err)
    return res.status(500).json(RestResult.error("Failed to save forms", helpers.getError(err,"Failed to get lock")))
  }
  if(lock.match || lock.free){
    const newConfig = new Form(req.body);
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        return res.status(400).json(RestResult.error('Please provide all required fields'));
    }
    try{
      var forms = Form.save(newConfig)
      if(forms) {
        res.json(RestResult.single(null));
      }else{
        res.status(500).json(RestResult.error("Failed to save forms"))
      }
    }catch(err){
      res.status(500).json(RestResult.error("Failed to save forms", helpers.getError(err)))
    }
  }else{
    res.status(423).json(RestResult.error("Designer is locked", "Designer is locked by "+lock.lock.username))
  }

}
const validate = function(req,res){
  const newConfig = new Form(req.body);
  //handles null error
  if(req.body.constructor === Object && Object.keys(req.body).length === 0){
      return res.status(400).json(RestResult.error('Please provide all required fields'));
  }
  try{
    // convert to object
    var formsConfig = Form.parse(newConfig)
    // validate against json schema
    formsConfig = Form.validate(formsConfig)
    if(formsConfig) {
      res.json(RestResult.single(null));
    }else{
      res.status(500).json(RestResult.error("Failed to validate new forms config"))
    }
  }catch(err){
    res.status(500).json(RestResult.error("Failed to validate new forms config", helpers.getError(err)))
  }
}

export default {
  findList,
  findOne,
  findAll,
  backups,
  env,
  restore,
  save,
  validate
};