'use strict';
import Settings from '../../models/settings.model.js';
import RestResult from '../../models/restResult.model.v2.js';
import logger from '../../lib/logger.js';
import Helpers from '../../lib/common.js';


const find = async function(req, res) {
    try {
      const settings = await Settings.find();
      // Mask mail password before returning to API
      if (settings && settings.mail_password) {
        settings.mail_password = '**********';
      }
      res.json(RestResult.single(settings));
    } catch(err) {
      res.status(500).json(RestResult.error("Failed to find settings", Helpers.getError(err)));
    }
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
    res.json(RestResult.single({ message: `Mail sent with id ${messageid}` }));
  } catch(err) {
    res.status(500).json(RestResult.error("Mail check failed", Helpers.getError(err)));
  }
};

const update = async function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).json(RestResult.error('Please provide all required fields'));
    }else{
        try {
          // If password is masked, preserve the existing password
          if (req.body.mail_password === '**********') {
            const existingSettings = await Settings.find();
            req.body.mail_password = existingSettings.mail_password;
          }
          await Settings.update(new Settings(req.body));
          res.json(RestResult.single(null));
        } catch(err) {
          res.status(500).json(RestResult.error("Failed to update settings", Helpers.getError(err)));
        }
    }
};

const importConfig = async function(req, res) {
    try {
      const message = await Settings.importConfig();
      res.json(RestResult.single({ message }));
    } catch(err) {
      res.status(500).json(RestResult.error("Failed to import config", Helpers.getError(err)));
    }
};

export default {
    find,
    mailcheck,
    update,
    importConfig
};