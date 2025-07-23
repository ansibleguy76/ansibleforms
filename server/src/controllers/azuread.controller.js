'use strict';
import AzureAd from '../models/azureAd.model.js';
import azureConfig from '../auth/auth_azuread.js';
import RestResult from '../models/restResult.model.js';

const find = function(req, res) {
  AzureAd.find()
  .then((azuread)=>{ res.json(new RestResult("success","AzureAd found",azuread,"")); })
  .catch((err) => { res.json(new RestResult("error","Failed to find azuread",null,err.toString())) })
};
const check = function(req, res) {
  AzureAd.check(new AzureAd(req.body))
  .then(()=>{ res.json(new RestResult("success","AzureAd connection ok")) })
  .catch((err) => { res.json(new RestResult("error","AzureAd check failed",null,err.toString())) })
};
const update = function(req, res) {
  if(req.body.constructor === Object && Object.keys(req.body).length === 0){
    res.status(400).send({ error:true, message: 'Please provide all required fields' });
  }else{
    AzureAd.update(new AzureAd(req.body))
    .then(()=>{ 
      azureConfig.initialize()
      res.json(new RestResult("success","AzureAd updated",null,"")); 
    })
    .catch((err) => { res.json(new RestResult("error","Failed to update azuread",null,err.toString())) })
  }
};

export default {
  find,
  check,
  update
}
