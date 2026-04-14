'use strict';
import Ldap from '../../models/ldap.model.js';
import RestResultv2 from '../../models/restResult.model.v2.js';
import logger from "../../lib/logger.js";

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
    res.status(500).json(RestResultv2.error("Failed to find ldap", err.toString()));
  }
};

const check = async function(req, res) {
  if (req.body.constructor === Object && Object.keys(req.body).length === 0) {
    res.status(409).json(RestResultv2.error("No data was sent"));
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
    res.status(500).json(RestResultv2.error("Ldap check failed", err.toString()));
  }
};

const update = async function(req, res) {
  if (req.body.constructor === Object && Object.keys(req.body).length === 0) {
    res.status(409).json(RestResultv2.error("No data was sent"));
    return false;
  }
  try {
    // If password is masked, preserve the existing password
    if (req.body.bind_user_pw === '**********') {
      const existingLdap = await Ldap.find();
      req.body.bind_user_pw = existingLdap.bind_user_pw;
    }
    await Ldap.update(new Ldap(req.body));
    res.status(200).json(RestResultv2.single({ message: "Ldap updated" }));
  } catch (err) {
    logger.error("Error updating LDAP: ", err);
    res.status(500).json(RestResultv2.error("Failed to update ldap", err.toString()));
  }
};

export default {
  find,
  check,
  update
};