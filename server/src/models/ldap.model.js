'use strict';
import logger from "../lib/logger.js";
import mysql from "./db.model.js";
import helpers from "../lib/common.js";
import yaml from "yaml";
import crypto from "../lib/crypto.js";
import { authenticate } from 'ldap-authentication';

//ldap object create
var Ldap=function(ldap){
    this.server = ldap.server;
    this.port = ldap.port;
    this.ignore_certs = (ldap.ignore_certs)?1:0;
    this.enable_tls = (ldap.enable_tls)?1:0;
    this.cert = ldap.cert;
    this.ca_bundle = ldap.ca_bundle;
    this.bind_user_dn = ldap.bind_user_dn;
    this.bind_user_pw = crypto.encrypt(ldap.bind_user_pw);
    this.search_base = ldap.search_base;
    this.username_attribute = ldap.username_attribute;
    this.groups_attribute = ldap.groups_attribute;
    this.enable = (ldap.enable)?1:0;
    this.is_advanced = (ldap.is_advanced)?1:0;
    this.groups_search_base = (ldap.is_advanced)?ldap.groups_search_base:""
    this.group_class = (ldap.is_advanced)?ldap.group_class:""
    this.group_member_attribute = (ldap.is_advanced)?ldap.group_member_attribute:""
    this.group_member_user_attribute = (ldap.is_advanced)?ldap.group_member_user_attribute:""
    this.mail_attribute = ldap.mail_attribute
};
Ldap.update = function (record) {
  logger.info(`Updating ldap ${record.server}`)
  return mysql.do("UPDATE AnsibleForms.`ldap` set ?", record)
};
Ldap.find = async function() {
  const res = await mysql.do("SELECT * FROM AnsibleForms.`ldap` limit 1;");
  if (res.length > 0) {
    try {
      res[0].bind_user_pw = crypto.decrypt(res[0].bind_user_pw);
    } catch (e) {
      logger.error("Couldn't decrypt ldap binding password, did the secretkey change ?");
      res[0].bind_user_pw = "";
    }
    return res[0];
  } else {
    logger.error("No ldap record in the database, something is wrong");
    throw "No ldap record in the database, something is wrong";
  }
}
Ldap.check = async function(ldapConfig){
    
    // auth with admin
    var badCertificates=false
    let options = {
      ldapOpts: {
        url: ((ldapConfig.enable_tls==1)?"ldaps":"ldap") + "://" + ldapConfig.server + ":" + ldapConfig.port,
        tlsOptions: {
          // cert: cert,
          // requestCert: tls,
          // rejectUnauthorized: rejectUnauthorized,
          // ca: ca
        }
      },
      adminDn: ldapConfig.bind_user_dn,
      adminPassword: crypto.decrypt(ldapConfig.bind_user_pw),
      userPassword: "dummypassword_for_check",
      userSearchBase: ldapConfig.search_base,
      usernameAttribute: ldapConfig.username_attribute,
      username: "dummyuser_for_check",
      // starttls: false
    }
    // new in v4.0.20, add advanced ldap properties
    if(ldapConfig.is_advanced){
      if(ldapConfig.groups_search_base){ options.groupsSearchBase = ldapConfig.groups_search_base }
      if(ldapConfig.group_class){ options.groupClass = ldapConfig.group_class }
      if(ldapConfig.group_member_attribute){ options.groupMemberAttribute = ldapConfig.group_member_attribute }
      if(ldapConfig.group_member_user_attribute){ options.groupMemberUserAttribute = ldapConfig.group_member_user_attribute }
    }
    // console.log(options)
    // ldap-authentication has bad cert check, so we check first !!
    if(ldapConfig.enable_tls && !(ldapConfig.ignore_certs==1)){
      if(!helpers.checkCertificate(ldapConfig.cert)){
        badCertificates=true
      }
      if(!helpers.checkCertificate(ldapConfig.ca_bundle)){
        badCertificates=true
      }
    }else{
      ldapConfig.cert=""
      ldapConfig.ca_bundle=""
    }
    // enable tls/ldaps
    if(ldapConfig.enable_tls==1){
      options.ldapOpts.tlsOptions.requestCert = (ldapConfig.enable_tls==1)
      if(ldapConfig.cert!=""){
        options.ldapOpts.tlsOptions.cert = ldapConfig.cert
      }
      if(ldapConfig.ca_bundle!=""){
        options.ldapOpts.tlsOptions.ca = ldapConfig.ldapTlsCa
      }
      options.ldapOpts.tlsOptions.rejectUnauthorized = !(ldapConfig.ignore_certs==1)
      logger.info("use tls : " + (ldapConfig.enable_tls==1))
      logger.info("reject invalid certificates : " + !(ldapConfig.ignore_certs==1))
    }

    if(badCertificates){
      throw new Error("Certificate is not valid")
    }else{
      logger.notice("Certificates are valid")
      try{
        // logger.debug(JSON.stringify(options))
        logger.notice("Authenticating")
        var user = await authenticate(options)
        return user
      }catch(err){
        var em =""
        if(err.message){
          em = err.message
        }else{
          try{ em = yaml.stringify(err)}catch(e){em = err}
        }
        if(err.admin){
          if(err.admin.lde_message){
            try{ em = yaml.stringify(err.admin.lde_message)}catch(e){em = err}
          }
          else if(err.admin.code){
            try{ em = yaml.stringify(err.admin)}catch(e){em = err}
            if(err.admin.code=="UNABLE_TO_VERIFY_LEAF_SIGNATURE"){
              em = "Unable to verify the certificate"
            }else if(err.admin.code==49){
              em = "Wrong binding credentials"
            }else if(err.admin.code=="ENOTFOUND"){
              em = "Bad server or port (connection failed)"
            }
          }
        }
        
        if(em.includes("user not found")){
          logger.notice("Checking ldap connection ok")
          return
        }else{
          logger.notice("Checking ldap connection result : " + em)
          throw new Error(em)
        }
      }
    }
}

export default  Ldap;
