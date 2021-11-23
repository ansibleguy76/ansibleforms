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
exports.save = function(req,res){
  const newConfig = new Form(req.body);
  //handles null error
  if(req.body.constructor === Object && Object.keys(req.body).length === 0){
      res.status(400).send({ error:true, message: 'Please provide all required fields' });
  }else{
    try{
      var forms = Form.save(newConfig)
      if(forms) {
        res.json(new RestResult("success","forms saved",null,""));
      }else{
        res.json(new RestResult("error","failed to save forms",null,"Failed to save forms"))
      }
    }catch(err){
      res.json(new RestResult("error","failed to save forms",null,err))
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
        res.json(new RestResult("success","new forms config is valid",null,""));
      }else{
        res.json(new RestResult("error","failed to validate new forms config",null,"Failed to validate new forms config"))
      }
    }catch(err){
      res.json(new RestResult("error","failed to validate new forms config",null,err))
    }
  }
}
