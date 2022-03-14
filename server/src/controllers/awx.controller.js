'use strict';
const Awx = require('../models/awx.model');
var RestResult = require('../models/restResult.model');
var Credential = require('../models/credential.model');
const logger=require("../lib/logger");
exports.check = function(req, res) {
  Awx.check(new Awx(req.body),function(err, awx) {
    if(err){
      res.json(new RestResult("error",err))
    }else{
      res.json(new RestResult("success",awx))
    }
  });

};
exports.find = function(req, res) {
    Awx.find(function(err, awx) {
        if (err){
          res.json(new RestResult("error","Failed to find awx",null,err))
        }else{
          res.json(new RestResult("success","Awx found",awx,""));
        }
    });
};
exports.update = function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Awx.update(new Awx(req.body), function(err, awx) {
            if (err){
                res.json(new RestResult("error","Failed to update awx",null,err))
            }else{
                res.json(new RestResult("success","Awx updated",null,""));
            }
        });
    }
};
