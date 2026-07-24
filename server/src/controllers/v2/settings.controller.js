'use strict';
import Settings from '../../models/settings.model.js';
import RestResult from '../../models/restResult.model.v2.js';
import logger from '../../lib/logger.js';
import Helpers from '../../lib/common.js';
import i18n from '../../lib/i18n.js';


const find = async function(req, res) {
    try {
      const settings = await Settings.find();
      // Mask mail password before returning to API
      if (settings && settings.mail_password) {
        settings.mail_password = '**********';
      }
      res.json(RestResult.single(settings));
    } catch(err) {
      res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedFindSettings'), Helpers.getError(err)));
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
    res.json(RestResult.single({ message: i18n.t(req, 'resources.mailSent', { id: messageid }) }));
  } catch(err) {
    res.status(500).json(RestResult.error(i18n.t(req, 'resources.mailCheckFailed'), Helpers.getError(err)));
  }
};

const update = async function(req, res) {
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).json(RestResult.error(i18n.t(req, 'errors.requiredFields')));
    }else{
        try {
          const currentSettings = await Settings.find();
          // settings coming from the config seed are read only for the API
          if (currentSettings?.managed) {
            return res.status(403).json(RestResult.error(i18n.t(req, 'resources.failedUpdateSettings'), 'Settings are managed by the config seed and are read only'));
          }
          // If password is masked, preserve the existing password
          if (req.body.mail_password === '**********') {
            req.body.mail_password = currentSettings.mail_password;
          }
          await Settings.update(new Settings(req.body));
          res.json(RestResult.single(null));
        } catch(err) {
          res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedUpdateSettings'), Helpers.getError(err)));
        }
    }
};

const importConfig = async function(req, res) {
    try {
      const message = await Settings.importConfig();
      res.json(RestResult.single({ message }));
    } catch(err) {
      res.status(500).json(RestResult.error(i18n.t(req, 'resources.failedImportConfig'), Helpers.getError(err)));
    }
};

export default {
    find,
    mailcheck,
    update,
    importConfig
};