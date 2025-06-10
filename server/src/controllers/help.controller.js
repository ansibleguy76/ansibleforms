'use strict';
import RestResult from '../models/restResult.model.js';
import Help from '../models/help.model.js';

const get = function(req, res) {
    Help.get()
      .then((help)=>{ res.json(new RestResult("success","help found",help,"")) })
      .catch((err)=>{ res.json(new RestResult("error","failed to find help",null,err.toString())) })
};

export default {
  get
};