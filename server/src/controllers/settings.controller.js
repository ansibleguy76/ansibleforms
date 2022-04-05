'use strict';
const Settings = require('../models/settings.model');
var RestResult = require('../models/restResult.model');
const logger = require('../lib/logger');

exports.find = function(req, res) {
    Settings.find()
      .then((settings)=>{res.json(new RestResult("success","Settings found",settings,""))})
      .catch((err)=>{res.json(new RestResult("error","Failed to find settings",null,err))})
};
exports.mailcheck = function(req, res) {
  Settings.mailcheck(new Settings(req.body),req.body.to)
    .then((messageid)=>{res.json(new RestResult("success",`Mail sent with id ${message}`))})
    .catch((err)=>{res.json(new RestResult("error","Mail check failed",null,err.message))})
};
exports.update = function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Settings.update(new Settings(req.body))
          .then(()=>{res.json(new RestResult("success","Settings updated",null,""))})
          .catch((err)=>{res.json(new RestResult("error","Failed to update settings",null,err))})
    }
};
