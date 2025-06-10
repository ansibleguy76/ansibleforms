'use strict';
import RestResult from '../models/restResult.model.js';
import Lock from '../models/lock.model.js';
import yaml from 'yaml';
import Helpers from './../lib/common.js';
// import { inspect } from "util";

const status = function(req, res) {
    Lock.status(req.user.user)
      .then((status)=>{ res.json(new RestResult("success","lock status found",status,"")) })
      .catch((err)=>{ res.json(new RestResult("error","failed to find lock",null,Helpers.getError(err))) })
};
const set = function(req, res) {
    const user = req.user.user
    // console.log(inspect(user))
    Lock.set(user)
      .then((lock)=>{ res.json(new RestResult("success","lock added",null,"")) })
      .catch((err)=>{ res.json(new RestResult("error","failed to create lock",null,Helpers.getError(err))) })
};
const deleteLock = function(req, res) {
    const user = req.user.user
    Lock.delete(user)
      .then(()=>{res.json(new RestResult("success","lock deleted",null,"")) })
      .catch((err)=>{res.json(new RestResult("error","failed to delete lock",null,Helpers.getError(err)))})
};

export default {
  status,
  set,
  "delete": deleteLock
}