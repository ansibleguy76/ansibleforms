'use strict';
var RestResult = require('../models/restResult.model');
const Help = require('../models/help.model');
const inspect = require("util").inspect


exports.get = function(req, res) {
    Help.get()
      .then((help)=>{ res.json(new RestResult("success","help found",help,"")) })
      .catch((err)=>{ res.json(new RestResult("error","failed to find help",null,err.toString())) })
};
