'use strict';
const Form=require("../models/form.model")
const Lock=require("../models/lock.model")
const Help=require("../models/help.model")
const path=require("path")
const logger=require("../lib/logger")
const helpers=require("../lib/common")
const YAML=require("yaml")
var RestResult = require('../models/restResult.model');
exports.findList = async function(req,res){
  try{
    logger.info("Getting forms list")
    var userRoles = req?.user?.user?.roles || []
    var formConfig = await Form.load(userRoles)
    // filter forms based on user roles, only return the forms, only return the properties
    // icon, image, name, description, tileClass
    // remove roles and remove constants
    delete formConfig.roles
    delete formConfig.constants
    // this is sufficient for frontend to display the forms
    res.json(formConfig)
  }catch(err){
    // console.log(err)
    res.json({error:helpers.getError(err)})
  }
}
exports.findOne = async function(req,res){
  try{
    var userRoles = req?.user?.user?.roles || []
    var formName = req.query.name
    if(!formName){
      res.json({error:"Form name not provided"})
      return
    }
    logger.info("Getting form config for " + formName)
    var formConfig = await Form.load(userRoles,formName)
    delete formConfig.roles
    delete formConfig.categories
    res.json(formConfig)

  }catch(err){
    // console.log(err)
    res.json({error:helpers.getError(err)})
  }
}
exports.findAll = async function(req,res){
  try{
    var user = req?.user?.user || {}
    if(!user.roles.includes("admin") && !user.options?.showDesigner){
      res.json({error:"Only admins or designers can access the full forms configuration"})
      return
    }
    var forms = await Form.load(undefined,undefined,true) // true means load all forms, not just the ones for the user
    res.json(forms)
  }catch(err){
    // console.log(err)
    res.json({error:helpers.getError(err)})
  }
}

exports.backups = function(req,res){
  try{
    var backups = Form.backups()
    res.json(backups)
  }catch(err){
    res.json({error:helpers.getError(err)})
  }
}
exports.env = async function(req,res){
  try{
    // get help
    var help = await Help.get()
    // only get the environment variables
    help = help.filter(x => x.name=='Environment Variables')[0].items
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
          item.value=require('os').homedir()
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
    // logger.debug(inspect(env))
    res.json(new RestResult("success","Environment variables found",env,""))
  }catch(err){
    res.json(new RestResult("error","Failed to get environment variables",null,helpers.getError(err)))
  }
}
exports.restore = async function(req,res){
  var lock=undefined
  var user=req.user.user
  try{
    lock = await Lock.status(user)
    if(lock.free){
      lock.set(user).catch(()=>{}) // set lock and fail silent
    }
  }catch(err){
    logger.error("Failed to get lock : ",err)
    res.json(new RestResult("error","Failed to restore forms",null,helpers.getError(err,"Failed to get lock : ")))
    return true
  }
  if(lock.match || lock.free){
    try{
      var backupName=req.params.backupName
      var backupBeforeRestore=(req.query.backupBeforeRestore=="true")?true:false
      if(backupName){
        var restore = Form.restore(backupName,backupBeforeRestore)
        if(restore) {
          res.json(new RestResult("success","Backup is restored",null,""));
        }else{
          res.json(new RestResult("error",`Failed to restore '${req.params.backupName}'`,null,"Failed to restore forms"))
        }
      }else{
        res.json(new RestResult("error",`Failed to restore, no backup name provided`,null,"Failed to restore forms"))
      }
    }catch(err){
      res.json(new RestResult("error","Failed to restore forms",null,helpers.getError(err)))
    }
  }else{
    res.json(new RestResult("error","Failed to restore forms",null,"Designer is locked by "+lock.lock.username))
  }
}
exports.save = async function(req,res){
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
    res.json(new RestResult("error","Failed to save forms",null,helpers.getError(err,"Failed to get lock")))
    return true
  }
  if(lock.match || lock.free){
    const newConfig = new Form(req.body);
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
      try{
        var forms = Form.save(newConfig)
        if(forms) {
          res.json(new RestResult("success","Config saved",null,""));
        }else{
          res.json(new RestResult("error","Failed to save forms",null,"Failed to save forms"))
        }
      }catch(err){
        res.json(new RestResult("error","Failed to save forms",null,helpers.getError(err)))
      }
    }
  }else{
    res.json(new RestResult("error","Failed to save forms",null,"Designer is locked by "+lock.lock.username))
  }

}
exports.validate = function(req,res){
  const newConfig = new Form(req.body);
  //handles null error
  if(req.body.constructor === Object && Object.keys(req.body).length === 0){
      res.status(400).send({ error:true, message: 'Please provide all required fields' });
  }else{
    try{
      // convert to object
      var formsConfig = Form.parse(newConfig)
      // validate against json schema
      formsConfig = Form.validate(formsConfig)
      if(formsConfig) {
        res.json(new RestResult("success","Config is valid",null,""));
      }else{
        res.json(new RestResult("error","Failed to validate new forms config",null,"Failed to validate new forms config"))
      }
    }catch(err){
      res.json(new RestResult("error","Failed to validate new forms config",null,helpers.getError(err)))
    }
  }
}