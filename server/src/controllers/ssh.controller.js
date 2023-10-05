'use strict';
const Ssh = require('../models/ssh.model');
var RestResult = require('../models/restResult.model');
const logger=require("../lib/logger");

exports.find = function(req, res) {
    Ssh.find()
      .then((sshkey)=>{res.json(new RestResult("success","Ssh key found",sshkey,""))})
      .catch((err)=>{res.json(new RestResult("error","Failed to find ssh key",null,err.toString()))})
};
exports.update = function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Ssh.update(new Ssh(req.body))
          .then((ssh)=>{res.json(new RestResult("success","Ssh key updated",null,""))})
          .catch((err)=>{res.json(new RestResult("error","Failed to update ssh key",null,err.toString()))})
    }
};
