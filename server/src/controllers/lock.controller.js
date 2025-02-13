'use strict';
var RestResult = require('../models/restResult.model');
const Lock = require('../models/lock.model');
const YAML = require('yaml')
// const inspect = require("util").inspect
const Helpers = require("./../lib/common")

exports.status = function(req, res) {
    Lock.status(req.user.user)
      .then((status)=>{ res.json(new RestResult("success","lock status found",status,"")) })
      .catch((err)=>{ res.json(new RestResult("error","failed to find lock",null,Helpers.getError(err))) })
};
exports.set = function(req, res) {
    const user = req.user.user
    // console.log(inspect(user))
    Lock.set(user)
      .then((lock)=>{ res.json(new RestResult("success","lock added",null,"")) })
      .catch((err)=>{ res.json(new RestResult("error","failed to create lock",null,Helpers.getError(err))) })
};
exports.delete = function(req, res) {
    const user = req.user.user
    Lock.delete(user)
      .then(()=>{res.json(new RestResult("success","lock deleted",null,"")) })
      .catch((err)=>{res.json(new RestResult("error","failed to delete lock",null,Helpers.getError(err)))})
};
