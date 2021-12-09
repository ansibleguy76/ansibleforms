'use strict';
const logger=require("../lib/logger");
const mysql=require("./db.model")
const Helpers=require("../lib/common")
const YAML=require("yaml")
const {encrypt,decrypt} = require("../lib/crypto")

//ldap object create
var Ldap=function(ldap){
    this.server = ldap.server;
    this.port = ldap.port;
    this.ignore_certs = (ldap.ignore_certs)?1:0;
    this.enable_tls = (ldap.enable_tls)?1:0;
    this.cert = ldap.cert;
    this.ca_bundle = ldap.ca_bundle;
    this.bind_user_dn = ldap.bind_user_dn;
    this.bind_user_pw = encrypt(ldap.bind_user_pw);
    this.search_base = ldap.search_base;
    this.username_attribute = ldap.username_attribute;
    this.enable = (ldap.enable)?1:0;
};
Ldap.update = function (record, result) {
    logger.debug(`Updating ldap ${record.name}`)
    mysql.query("UPDATE AnsibleForms.`ldap` set ?", record, function (err, res) {
        if(err) {
            result(err, null);
        }
        else{
            result(null, res);
        }
    });
};
Ldap.find = function (result) {
    var query = "SELECT * FROM AnsibleForms.`ldap` limit 1;"
    try{
      mysql.query(query, function (err, res) {
          if(err) {
              result(err, null);
          }
          else{
            if(res.length>0){
              try{
                res[0].bind_user_pw=decrypt(res[0].bind_user_pw)
              }catch(e){
                logger.error("Couldn't decrypt ldap binding password, did the secretkey change ?")
                res[0].bind_user_pw=""
              }
              result(null, res[0]);
            }else{
              logger.error("No ldap record in the database, something is wrong")
            }

          }
      });
    }catch(err){
      result(err, null);
    }
};
Ldap.check = function(ldapConfig,result){
  const { authenticate } = require('ldap-authentication')
  const process =require('process');

  async function auth() {
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
      adminPassword: decrypt(ldapConfig.bind_user_pw),
      userPassword: "dummypassword_for_check",
      userSearchBase: ldapConfig.search_base,
      usernameAttribute: ldapConfig.username_attribute,
      username: "dummyuser_for_check",
      // starttls: false
    }
    // ldap-authentication has bad cert check, so we check first !!
    if(ldapConfig.enable_tls && !(ldapConfig.ignore_certs==1)){
      if(!Helpers.checkCertificate(ldapConfig.cert)){
        badCertificates=true
      }
      if(!Helpers.checkCertificate(ldapConfig.ca_bundle)){
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
      logger.debug("use tls : " + (ldapConfig.enable_tls==1))
      logger.debug("reject invalid certificates : " + !(ldapConfig.ignore_certs==1))
    }

    if(badCertificates){
      result("Certificate is not valid",null)
    }else{
      logger.info("Certificates are valid")
      try{
        logger.silly(options)
        var user = await authenticate(options)
        result(null,user)
      }catch(err){
          var em =""
          if(err.message){
            em = err.message
          }else{
            try{ em = YAML.stringify(err)}catch(e){em = err}
          }
          if(err.admin){
            if(err.admin.code){
              em = err
              if(err.admin.code=="UNABLE_TO_VERIFY_LEAF_SIGNATURE"){
                em = "Unable to verify the certificate"
              }else if(err.admin.code==49){
                em = "Wrong binding credentials"
              }else if(err.admin.code="ENOTFOUND"){
                em = "Bad server or port (connection failed)"
              }
            }
          }
          logger.info("Checking ldap connection result : " + em)
          result(em,null)
      }
    }
  }
  auth()
}

module.exports= Ldap;
