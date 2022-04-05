'use strict';
const Awx = require('../models/awx.model');
var RestResult = require('../models/restResult.model');
var Credential = require('../models/credential.model');
const logger=require("../lib/logger");
exports.check = function(req, res) {
  Awx.check(new Awx(req.body))
  .then((awx)=>{ res.json(new RestResult("success",awx)) })
  .catch((err)=>{ res.json(new RestResult("error",err.toString())) })
};
exports.find = function(req, res) {
  Awx.find()
  .then((awx)=>{ res.json(new RestResult("success","Awx found",awx,"")); })
  .catch((err)=>{ res.json(new RestResult("error","Failed to find awx",null,err)) })
};
exports.update = function(req, res) {
  if(req.body.constructor === Object && Object.keys(req.body).length === 0){
    res.status(400).send({ error:true, message: 'Please provide all required fields' });
  }else{
    Awx.update(new Awx(req.body))
    .then(()=>{ res.json(new RestResult("success","Awx updated",null,"")); })
    .catch((err)=>{ res.json(new RestResult("error","Failed to update awx",null,err)) })
  }
};
