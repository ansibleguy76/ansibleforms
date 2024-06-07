'use strict';
const OIDC = require('../models/oidc.model.js');
const oidcConfig = require('../auth/auth_oidc');
const RestResult = require('../models/restResult.model');

exports.find = function(req, res) {
  OIDC.find()
  .then((oidc)=>{ res.json(new RestResult("success","OIDC found",oidc,"")); })
  .catch((err) => { res.json(new RestResult("error","Failed to find OIDC",null,err.toString())) })
};
exports.check = function(req, res) {
  OIDC.check(new OIDC(req.body))
  .then(()=>{ res.json(new RestResult("success","OIDC connection ok", null, "")) })
  .catch((err) => { res.json(new RestResult("error","OIDC check failed",null,err.toString())) })
};
exports.update = function(req, res) {
  if(req.body.constructor === Object && Object.keys(req.body).length === 0){
    res.status(400).send({ error:true, message: 'Please provide all required fields' });
  }else{
    OIDC.update(new OIDC(req.body))
    .then(()=>{
      oidcConfig.initialize()
      res.json(new RestResult("success","OIDC updated",null,""));
    })
    .catch((err) => { res.json(new RestResult("error","Failed to update OIDC",null,err.toString())) })
  }
};
