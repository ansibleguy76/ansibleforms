'use strict';
const Settings = require('../models/settings.model');
var RestResult = require('../models/restResult.model');
const logger = require('../lib/logger');

exports.find = function(req, res) {
    Settings.find(function(err, settings) {
        if (err){
          res.json(new RestResult("error","Failed to find settings",null,err))
        }else{
          res.json(new RestResult("success","Settings found",settings,""));
        }
    });
};
exports.mailcheck = function(req, res) {
  Settings.mailcheck(new Settings(req.body),req.body.to,function(err, settings) {
    // as a check we search a dummy user; if we get a user not found error, we know the connection worked
    if(settings){
      res.json(new RestResult("success",settings))
    }else{
      logger.info(err)
      res.json(new RestResult("error","Mail check failed",null,err.message))
    }
  });
};
exports.update = function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Settings.update(new Settings(req.body), function(err, settings) {
            if (err){
                res.json(new RestResult("error","Failed to update settings",null,err))
            }else{
                res.json(new RestResult("success","Settings updated",null,""));
            }
        });
    }
};
