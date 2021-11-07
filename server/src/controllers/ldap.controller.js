'use strict';
const Ldap = require('../models/ldap.model');
var RestResult = require('../models/restResult.model');
const logger = require('../lib/logger');

exports.find = function(req, res) {
    Ldap.find(function(err, ldap) {
        if (err){
          res.json(new RestResult("error","Failed to find ldap",null,err))
        }else{
          res.json(new RestResult("success","Ldap found",ldap,""));
        }
    });
};
exports.check = function(req, res) {
  Ldap.check(new Ldap(req.body),function(err, ldap) {
    logger.debug(err)
    if(err.includes("LdapAuthenticationError")){
      res.json(new RestResult("success","Ldap connection ok"))
    }else{
      res.json(new RestResult("error","Ldap check failed",null,err))
    }
  });

};
exports.update = function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Ldap.update(new Ldap(req.body), function(err, ldap) {
            if (err){
                res.json(new RestResult("error","Failed to update ldap",null,err))
            }else{
                res.json(new RestResult("success","Ldap updated",null,""));
            }
        });
    }
};
