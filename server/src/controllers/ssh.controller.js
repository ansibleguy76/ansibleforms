'use strict';
import Ssh from '../models/ssh.model.js';
import RestResult from '../models/restResult.model.js';
import logger from '../lib/logger.js';

const find = function(req, res) {
    Ssh.find()
      .then((sshkey)=>{res.json(new RestResult("success","Ssh key found",sshkey,""))})
      .catch((err)=>{res.json(new RestResult("error","Failed to find ssh key",null,err.toString()))})
};
const update = function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Ssh.update(new Ssh(req.body))
          .then((ssh)=>{res.json(new RestResult("success","Ssh key updated",null,""))})
          .catch((err)=>{res.json(new RestResult("error","Failed to update ssh key",null,err.toString()))})
    }
};

export default {
    find,
    update
};