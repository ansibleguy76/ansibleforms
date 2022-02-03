'use strict';
const Form=require("../models/form.model")
var RestResult = require('../models/restResult.model');

exports.findAll = function(req,res){
  try{
    var forms = Form.load()
    res.json(forms)
  }catch(error){
    res.json({error:error})
  }
}

exports.backups = function(req,res){
  try{
    var backups = Form.backups()
    res.json(backups)
  }catch(error){
    res.json({error:error})
  }
}
exports.restore = function(req,res){
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
      res.json(new RestResult("error","Failed to restore forms",null,err))
    }
}
exports.save = function(req,res){
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
      res.json(new RestResult("error","Failed to save forms",null,err))
    }
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
      res.json(new RestResult("error","Failed to validate new forms config",null,err))
    }
  }
}
