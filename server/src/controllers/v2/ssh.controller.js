'use strict';
import Ssh from '../../models/ssh.model.js';
import RestResult from '../../models/restResult.model.v2.js';
import logger from '../../lib/logger.js';

const find = async function(req, res) {
    try {
      const sshkey = await Ssh.find();
      res.json(RestResult.single(sshkey));
    } catch(err) {
      res.status(500).json(RestResult.error("Failed to find ssh key", err.toString()));
    }
};

const update = async function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).json(RestResult.error('Please provide all required fields'));
    }else{
        try {
          await Ssh.update(new Ssh(req.body));
          res.json(RestResult.single(null));
        } catch(err) {
          res.status(500).json(RestResult.error("Failed to update ssh key", err.toString()));
        }
    }
};

export default {
    find,
    update
};