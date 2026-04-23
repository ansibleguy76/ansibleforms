"use strict";
import crypto from "../lib/crypto.js";
import logger from "../lib/logger.js";
import { authenticate as ldapAuthentication } from "ldap-authentication";
import Ldap from "./ldap.model.js";
import Form from "./form.model.js";
import yaml from "yaml";
import mysql from "./db.model.js";
import helpers from "../lib/common.js";
import Token from "./token.model.js";
import CrudModel from './crud.model.js';

class User extends CrudModel {
  static modelName = 'users';

  // Override create to hash password
  static async create(data) {
    logger.info(`Creating user ${data.username}`);
    // Hash password before storing
    const hash = await crypto.hashPassword(data.password);
    data.password = hash;
    return super.create(this.modelName, data);
  }

  // Override update to conditionally hash password
  static async update(data, id) {
    logger.info(`Updating user ${data.username ? data.username : id}`);
    // Remove empty fields
    helpers.removeEmptyFields(data);
    
    // Hash password if provided
    if (data.password) {
      logger.info(`Updating user with password ${data.username ? data.username : id}`);
      const hash = await crypto.hashPassword(data.password);
      data.password = hash;
    }
    
    return super.update(this.modelName, data, id);
  }

  // Override delete to cleanup tokens
  static async delete(id) {
    logger.info(`Deleting user ${id}`);
    // Get user to find username (will throw NotFoundError if not exists)
    const user = await super.findById(this.modelName, id);
    // Delete all tokens for this user
    await Token.deleteAllForUser(user.username);
    return super.delete(this.modelName, id);
  }

  static async findAll() {
    return super.findAll(this.modelName);
  }

  static async findById(id) {
    return super.findById(this.modelName, id);
  }

  static async findByUsername(username) {
    // username is the natural key
    return super.findByName(this.modelName, username);
  }

  // Additional methods (not CRUD operations)

  static authenticate(username, password) {
    logger.info(`Checking password for user ${username}`);
    var query = "SELECT users.*,GROUP_CONCAT(groups.name) `groups` FROM AnsibleForms.`users`,AnsibleForms.`groups` WHERE `users`.group_id=`groups`.id AND username=?;";
    return mysql.do(query, username).then((res) => {
      if (res.length > 0 && res[0].password) {
        return crypto.checkPassword(password, res[0].password, res[0]);
      } else {
        throw `User ${username} not found`;
      }
    });
  }

  static async getRolesAndOptions(groups, user) {
  var result = {};
  var roles = [];
  var options = {};
  var full_username = `${user.type}/${user.username}`;

  const addRoleAndOptions = function (role) {
    if (!roles.includes(role.name)) {
      roles.push(role.name);
    }
    if (role.options) {
      for (const [key, value] of Object.entries(role.options)) {
        logger.debug(`Adding option ${key} = ${value}`);
        if (options[key] === undefined) {
          options[key] = value;
        } else {
          options[key] = options[key] && value;
        }
      }
    }
  }

  logger.debug(`Getting roles and options for ${full_username}`);

  try {
    const baseConfig = await Form.load(null, null, null, true);
    // derive roles from forms
    baseConfig.roles.forEach(function (role) {

      // if we match the user, we add the role
      if(role.users && role.users.includes(full_username)){
        addRoleAndOptions(role);
      }

      // if the role matches one of the user's groups, we add the role
      groups.forEach(function (group) {
        if ((role.groups && role.groups.includes(group))) {
          addRoleAndOptions(role);
        }
      });
    });

    logger.debug(`Adding public role to ${full_username}`);
    roles.push("public");
    // if the public role has any option set, we add it to the options, we don't overwrite
    baseConfig.roles.forEach(function (role) {
      if (role.name == "public" && role.options) {
        for (const [key, value] of Object.entries(role.options)) {
          if (options[key] === undefined) {
            logger.debug(`Adding public option ${key} = ${value}`);
            options[key] = value;
          }
        }
      }
    });

    result.roles = roles;
    result.options = options;

    // Apply defaults for undefined options
    const isAdmin = roles.includes("admin");
    if (options.allowVerboseMode === undefined) options.allowVerboseMode = true;
    if (options.showSettings === undefined) options.showSettings = isAdmin;
    if (options.showDesigner === undefined) options.showDesigner = isAdmin;
    if (options.showLogs === undefined) options.showLogs = isAdmin;
    if (options.allowBackupOps === undefined) options.allowBackupOps = isAdmin;
    if (options.showJobs === undefined) options.showJobs = true;
    if (options.showDebugButtons === undefined) options.showDebugButtons = true;
    if (options.showExtravars === undefined) options.showExtravars = true;
    if (options.showExtraVars === undefined) options.showExtraVars = true;
    if (options.showArtifacts === undefined) options.showArtifacts = true;
    if (options.allowJobRelaunch === undefined) options.allowJobRelaunch = isAdmin;
    if (options.showAllJobLogs === undefined) options.showAllJobLogs = isAdmin;
    if (options.allowScheduledJobs === undefined) options.allowScheduledJobs = isAdmin;
    if (options.allowStoredJobs === undefined) options.allowStoredJobs = true;
    if (options.allowPlannedJobs === undefined) options.allowPlannedJobs = true;

    return result;
  } catch (e) {
    logger.error(e);
    // return temp role if needed
    if (groups.includes("local/admins")) {
      roles.push("admin");
    }
    return roles;
  }
}

static getGroups(user, groupObj, ldapConfig = {}) {
  var group = "";
  var groups = [];

  // ldap type
  if (user.type == "ldap" && ldapConfig.groups_attribute) {
    if (groupObj[ldapConfig.groups_attribute]) {
      // get the memberOf field, force to array
      var ldapgroups = [].concat(groupObj[ldapConfig.groups_attribute]);
      //logger.debug(`LDAP Groups = ${ldapgroups}`)
      // loop ldap groups
      ldapgroups.forEach(function (v, i, a) {
        // grab groupname part
        // logger.debug(JSON.stringify(v))
        var groupObject = v["objectName"] || v; // https://github.com/ansibleguy76/ansibleforms/issues/119 first try objectName and then fall back.  Different flavours of ldap servers return different group objects.  Until someone else hit's another flavour, these are the ones we implement.
        var groupMatch = groupObject.match("^[cCnN]{2}=([^,]*)");
        if (groupMatch.length > 0) {
          // prefix with ldap
          group = "ldap/" + groupMatch[1];
          // add all the roles that match the group
          groups.push(group);
        }
      });
    }
    return groups;
  } else if (user.type == "local") {
    var localgroups = groupObj.split(",");
    localgroups.forEach(function (v, i, a) {
      group = "local/" + v;
      // add all the roles that match the group
      groups.push(group);
    });
    return groups;
  } else {
    return groups;
  }
}

static checkLdap(username, password) {
  return Ldap.find()
    .then((ldapConfig) => {
      if (ldapConfig.enable == 1) {
        return ldapConfig;
      } else {
        throw "No ldap configured or not enabled";
      }
    })
    .then(async (ldapConfig) => {
      // auth with admin
      var badCertificates = false;
      let options = {
        ldapOpts: {
          url: (ldapConfig.enable_tls == 1 ? "ldaps" : "ldap") + "://" + ldapConfig.server + ":" + ldapConfig.port,
          tlsOptions: {},
        },
        adminDn: ldapConfig.bind_user_dn,
        adminPassword: ldapConfig.bind_user_pw,
        userPassword: password,
        userSearchBase: ldapConfig.search_base,
        usernameAttribute: ldapConfig.username_attribute,
        username: username,
        // starttls: false
      };
      // new in v4.0.20, add advanced ldap properties
      if (ldapConfig.is_advanced) {
        if (ldapConfig.groups_search_base) {
          options.groupsSearchBase = ldapConfig.groups_search_base;
        }
        if (ldapConfig.group_class) {
          options.groupClass = ldapConfig.group_class;
        }
        if (ldapConfig.group_member_attribute) {
          options.groupMemberAttribute = ldapConfig.group_member_attribute;
        }
        if (ldapConfig.group_member_user_attribute) {
          options.groupMemberUserAttribute = ldapConfig.group_member_user_attribute;
        }
      }
      // console.log(options)
      // ldap-authentication has bad cert check, so we check first !!
      if (ldapConfig.enable_tls && !(ldapConfig.ignore_certs == 1)) {
        if (!helpers.checkCertificate(ldapConfig.cert)) {
          badCertificates = true;
        }
        if (!helpers.checkCertificate(ldapConfig.ca_bundle)) {
          badCertificates = true;
        }
      } else {
        ldapConfig.cert = "";
        ldapConfig.ca_bundle = "";
      }
      // enable tls/ldaps
      if (ldapConfig.enable_tls == 1) {
        options.ldapOpts.tlsOptions.requestCert = ldapConfig.enable_tls == 1;
        if (ldapConfig.cert != "") {
          options.ldapOpts.tlsOptions.cert = ldapConfig.cert;
        }
        if (ldapConfig.ca_bundle != "") {
          options.ldapOpts.tlsOptions.ca = ldapConfig.ca_bundle;
        }
        options.ldapOpts.tlsOptions.rejectUnauthorized = !(ldapConfig.ignore_certs == 1);
        logger.info("use tls : " + (ldapConfig.enable_tls == 1));
        logger.info("reject invalid certificates : " + !(ldapConfig.ignore_certs == 1));
      }

      if (badCertificates) {
        throw "Certificate is not valid";
      } else {
        logger.info(`Checking ldap for user ${username}`);
        // logger.debug(JSON.stringify(options))
        return ldapAuthentication(options);
      }
    })
    .catch((err) => {
      var em = "";
      if (err.message) {
        em = err.message;
      } else {
        try {
          em = yaml.stringify(err);
        } catch (e) {
          em = err;
        }
      }

      if (err.admin) {
        if (err.admin.code) {
          em = err.admin.code;
          if (err.admin.code == "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
            em = "Unable to verify the certificate";
          }
          if (err.admin.code == 49) {
            em = "Wrong binding credentials";
          }
        }
      }
      logger.error("Error connecting to ldap : " + em);
      throw "Ldap : " + em;
    });
  }
}

export default User;
