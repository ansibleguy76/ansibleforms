'use strict';
import Settings from '../../models/settings.model.js';
import RestResult from '../../models/restResult.model.js';
import logger from '../../lib/logger.js';
import Helpers from '../../lib/common.js';


const find = function(req, res) {
    Settings.find()
      .then((settings)=>{
        // Mask mail password before returning to API
        if (settings && settings.mail_password) {
          settings.mail_password = '**********';
        }
        res.json(new RestResult("success","Settings found",settings,""))
      })
      .catch((err)=>{res.json(new RestResult("error","Failed to find settings",null,Helpers.getError(err)))})
};
const mailcheck = async function(req, res) {
  try {
    // If password is masked, fetch the real one from database for testing
    let settingsConfig = req.body;
    if (settingsConfig.mail_password === '**********') {
      const existingSettings = await Settings.find();
      settingsConfig.mail_password = existingSettings.mail_password;
    }
    const messageid = await Settings.mailcheck(new Settings(settingsConfig), req.body.to);
    res.json(new RestResult("success",`Mail sent with id ${messageid}`))
  } catch(err) {
    res.json(new RestResult("error","Mail check failed",null,Helpers.getError(err)))
  }
};
const update = async function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).send({ error:true, message: 'Please provide all required fields' });
    }else{
        try {
          // If password is masked, preserve the existing password
          if (req.body.mail_password === '**********') {
            const existingSettings = await Settings.find();
            req.body.mail_password = existingSettings.mail_password;
          }
          await Settings.update(new Settings(req.body));
          res.json(new RestResult("success","Settings updated",null,""));
        } catch(err) {
          res.json(new RestResult("error","Failed to update settings",null,Helpers.getError(err)));
        }
    }
};
const importConfig = function(req, res) {
    Settings.importConfig()
      .then((message)=>{res.json(new RestResult("success",message,null,""))})
      .catch((err)=>{res.json(new RestResult("error","Failed to import config",null,Helpers.getError(err)))})
};

export default {
    find,
    mailcheck,
    update,
    importConfig
};