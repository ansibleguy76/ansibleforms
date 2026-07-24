'use strict';
import Ldap from '../../models/ldap.model.js';
import RestResultv2 from '../../models/restResult.model.v2.js';
import logger from "../../lib/logger.js";
import i18n from '../../lib/i18n.js';

const find = async function(req, res) {
  try {
    const ldap = await Ldap.find();
    // Mask LDAP bind password before returning to API
    if (ldap && ldap.bind_user_pw) {
      ldap.bind_user_pw = '**********';
    }
    res.status(200).json(RestResultv2.single(ldap));
  } catch (err) {
    logger.error("Error finding LDAP: ", err);
    res.status(500).json(RestResultv2.error(i18n.t(req, 'resources.failedFindLdap'), err.toString()));
  }
};

const check = async function(req, res) {
  if (req.body.constructor === Object && Object.keys(req.body).length === 0) {
    res.status(409).json(RestResultv2.error(i18n.t(req, 'errors.noDataSent')));
    return false;
  }
  try {
    // If password is masked, fetch the real one from database for testing
    let ldapConfig = req.body;
    if (ldapConfig.bind_user_pw === '**********') {
      const existingLdap = await Ldap.find();
      ldapConfig.bind_user_pw = existingLdap.bind_user_pw;
    }
    const result = await Ldap.check(new Ldap(ldapConfig));
    res.status(200).json(RestResultv2.single(result));
  } catch (err) {
    logger.error("Error checking LDAP connection: ", err);
    res.status(500).json(RestResultv2.error(i18n.t(req, 'resources.ldapCheckFailed'), err.toString()));
  }
};

const update = async function(req, res) {
  if (req.body.constructor === Object && Object.keys(req.body).length === 0) {
    res.status(409).json(RestResultv2.error(i18n.t(req, 'errors.noDataSent')));
    return false;
  }
  try {
    const existingLdap = await Ldap.find();
    // an ldap config coming from the config seed is read only for the API
    if (existingLdap?.managed) {
      return res.status(403).json(RestResultv2.error(i18n.t(req, 'resources.failedUpdateLdap'), 'The ldap configuration is managed by the config seed and is read only'));
    }
    // If password is masked, preserve the existing password
    if (req.body.bind_user_pw === '**********') {
      req.body.bind_user_pw = existingLdap.bind_user_pw;
    }
    await Ldap.update(new Ldap(req.body));
    res.status(200).json(RestResultv2.single({ message: i18n.t(req, 'resources.ldapUpdated') }));
  } catch (err) {
    logger.error("Error updating LDAP: ", err);
    res.status(500).json(RestResultv2.error(i18n.t(req, 'resources.failedUpdateLdap'), err.toString()));
  }
};

export default {
  find,
  check,
  update
};