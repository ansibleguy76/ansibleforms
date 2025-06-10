'use strict';
import Awx from '../models/awx.model.js';
import RestResult from '../models/restResult.model.js';

const check = function(req, res) {
  Awx.check(new Awx(req.body))
  .then((awx)=>{ res.json(new RestResult("success",awx)) })
  .catch((err)=>{ res.json(new RestResult("error",err.toString())) })
};
const find = function(req, res) {
  Awx.find()
  .then((awx)=>{ res.json(new RestResult("success","Awx found",awx,"")); })
  .catch((err)=>{ res.json(new RestResult("error","Failed to find awx",null,err.toString())) })
};
const update = function(req, res) {
  if(req.body.constructor === Object && Object.keys(req.body).length === 0){
    res.status(400).send({ error:true, message: 'Please provide all required fields' });
  }else{
    Awx.update(new Awx(req.body))
    .then(()=>{ res.json(new RestResult("success","Awx updated",null,"")); })
    .catch((err)=>{ res.json(new RestResult("error","Failed to update awx",null,err.toString())) })
  }
};

export default {
  check,
  find,
  update
};