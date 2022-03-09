'use strict';
const Ssh = require('../models/ssh.model');
var RestResult = require('../models/restResult.model');
const logger=require("../lib/logger");

exports.find = function(req, res) {
    Ssh.find(function(err, sshkey) {
        if (err){
          res.json(new RestResult("error","Failed to find ssh key",null,err))
        }else{
          res.json(new RestResult("success","Ssh key found",sshkey,""));
        }
    });
};
exports.update = function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Ssh.update(new Ssh(req.body), function(err, ssh) {
            if (err){
                res.json(new RestResult("error","Failed to update ssh key",null,err))
            }else{
                res.json(new RestResult("success","Ssh key updated",null,""));
            }
        });
    }
};
