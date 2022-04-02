'use strict';
const Ldap = require('../models/ldap.model');
var RestResult = require('../models/restResult.model');
const logger = require('../lib/logger');

exports.find = function(req, res) {
  Ldap.find()
  .then((ldap)=>{ res.json(new RestResult("success","Ldap found",ldap,"")); })
  .catch((err) => { res.json(new RestResult("error","Failed to find ldap",null,err)) })
};
exports.check = function(req, res) {
  Ldap.check(new Ldap(req.body))
  .then(()=>{ res.json(new RestResult("success","Ldap connection ok")) })
  .catch((err) => { res.json(new RestResult("error","Ldap check failed",null,err)) })
};
exports.update = function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Ldap.update(new Ldap(req.body))
          .then(()=>{ res.json(new RestResult("success","Ldap updated",null,"")); })
          .catch((err) => { res.json(new RestResult("error","Failed to update ldap",null,err)) })
    }
};
