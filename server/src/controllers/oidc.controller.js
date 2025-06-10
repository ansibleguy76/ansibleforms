'use strict';
import OIDC from '../models/oidc.model.js';
import oidcConfig from '../auth/auth_oidc.js';
import RestResult from '../models/restResult.model.js';

const find = function(req, res) {
  OIDC.find()
  .then((oidc)=>{ res.json(new RestResult("success","OIDC found",oidc,"")); })
  .catch((err) => { res.json(new RestResult("error","Failed to find OIDC",null,err.toString())) })
};
const check = function(req, res) {
  OIDC.check(new OIDC(req.body))
  .then(()=>{ res.json(new RestResult("success","OIDC connection ok", null, "")) })
  .catch((err) => { res.json(new RestResult("error","OIDC check failed",null,err.toString())) })
};
const update = function(req, res) {
  if(req.body.constructor === Object && Object.keys(req.body).length === 0){
    res.status(400).send({ error:true, message: 'Please provide all required fields' });
  }else{
    OIDC.update(new OIDC(req.body))
    .then(()=>{
      oidcConfig.initialize()
      res.json(new RestResult("success","OIDC updated",null,""));
    })
    .catch((err) => { res.json(new RestResult("error","Failed to update OIDC",null,err.toString())) })
  }
};

export default {
  find,
  check,
  update
};