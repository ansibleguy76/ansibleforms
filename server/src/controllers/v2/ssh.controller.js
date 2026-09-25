'use strict';
import Ssh from '../../models/ssh.model.js';
import RestResult from '../../models/restResult.model.v2.js';
import i18n from '../../lib/i18n.js';

const find = async function(req, res) {
    try {
      const sshkey = await Ssh.find();
      res.json(RestResult.single(sshkey));
    } catch(err) {
      res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedFindSsh'), err.toString()));
    }
};

const update = async function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).json(RestResult.error(i18n.t(req, 'errors.requiredFields')));
    }else{
        try {
          await Ssh.update(new Ssh(req.body));
          res.json(RestResult.single(null));
        } catch(err) {
          res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedUpdateSsh'), err.toString()));
        }
    }
};

export default {
    find,
    update
};