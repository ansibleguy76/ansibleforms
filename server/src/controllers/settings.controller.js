'use strict';
import Settings from '../models/settings.model.js';
import RestResult from '../models/restResult.model.js';
import logger from '../lib/logger.js';
import Helpers from '../lib/common.js';


const find = function(req, res) {
    Settings.find()
      .then((settings)=>{res.json(new RestResult("success","Settings found",settings,""))})
      .catch((err)=>{res.json(new RestResult("error","Failed to find settings",null,Helpers.getError(err)))})
};
const mailcheck = function(req, res) {
  Settings.mailcheck(new Settings(req.body),req.body.to)
    .then((messageid)=>{res.json(new RestResult("success",`Mail sent with id ${messageid}`))})
    .catch((err)=>{res.json(new RestResult("error","Mail check failed",null,Helpers.getError(err)))})
};
const update = function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        Settings.update(new Settings(req.body))
          .then(()=>{res.json(new RestResult("success","Settings updated",null,""))})
          .catch((err)=>{res.json(new RestResult("error","Failed to update settings",null,Helpers.getError(err)))})
    }
};
const importFormsFileFromYaml = function(req, res) {
    Settings.importFormsFileFromYaml()
      .then((message)=>{res.json(new RestResult("success",message,null,""))})
      .catch((err)=>{res.json(new RestResult("error","Failed to import config",null,Helpers.getError(err)))})
}

export default {
    find,
    mailcheck,
    update,
    importFormsFileFromYaml
};