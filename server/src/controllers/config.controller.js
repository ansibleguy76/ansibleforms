'use strict';
const Form=require("../models/form.model")
const Lock=require("../models/lock.model")
const Help=require("../models/help.model")
const path=require("path")
const logger=require("../lib/logger")
const helpers=require("../lib/common")
const YAML=require("yaml")
var RestResult = require('../models/restResult.model');
const {inspect} = require("node:util")
exports.findAll = async function(req,res){
  try{
    var forms = await Form.load()
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
exports.env = function(req,res){
  Help.get()
  .then((help)=>{
    // logger.debug(inspect(help))
    var help = help.filter(x => x.name=='Environment Variables')[0].items
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
  })
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
    res.json(new RestResult("error","Failed to restore forms",null,"Designer is locked by "+lock.username))
  }
}
exports.save = async function(req,res){
  var lock=undefined
  var user=req.user.user
  try{
    lock = await Lock.status(user)
    if(lock.free){
      lock.set(user).catch(()=>{}) // set lock and fail silent
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
    res.json(new RestResult("error","Failed to save forms",null,"Designer is locked by "+lock.username))
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
