'use strict';
const Settings = require('../models/settings.model');
var RestResult = require('../models/restResult.model');
const logger = require('../lib/logger');
const Helpers = require('../lib/common');


exports.find = function(req, res) {
    Settings.find()
      .then((settings)=>{res.json(new RestResult("success","Settings found",settings,""))})
      .catch((err)=>{res.json(new RestResult("error","Failed to find settings",null,Helpers.getError(err)))})
};
exports.mailcheck = function(req, res) {
  Settings.mailcheck(new Settings(req.body),req.body.to)
    .then((messageid)=>{res.json(new RestResult("success",`Mail sent with id ${messageid}`))})
    .catch((err)=>{res.json(new RestResult("error","Mail check failed",null,Helpers.getError(err)))})
};
exports.update = function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Settings.update(new Settings(req.body))
          .then(()=>{res.json(new RestResult("success","Settings updated",null,""))})
          .catch((err)=>{res.json(new RestResult("error","Failed to update settings",null,Helpers.getError(err)))})
    }
};
exports.importFormsFileFromYaml = function(req, res) {
    Settings.importFormsFileFromYaml()
      .then(()=>{res.json(new RestResult("success","Forms imported",null,""))})
      .catch((err)=>{res.json(new RestResult("error","Failed to import forms.yaml",null,Helpers.getError(err)))})
}