'use strict';
const bcrypt = require('bcrypt');
const logger=require("../lib/logger");
const authConfig = require('../../config/auth.config')
const appConfig = require('../../config/app.config')
const Ldap = require('./ldap.model')
const Form = require('./form.model')
const YAML = require('yaml')
const mysql = require('./db.model')

//user object create
var User=function(user){
    if(user.username!=undefined){
      this.username = user.username;
    }
    if(user.password!=undefined){
      this.password = user.password;
    }
    if(user.group_id!=undefined){
      this.group_id = user.group_id;
    }

};
User.create = function (record, result) {
    bcrypt.hash(record.password, 10,function(err,hash){
      if(err){
        logger.error("error creating hash : " + err)
        result(err,null)
      }else{
        record.password = hash
        logger.debug(`Creating user ${record.username}`)
        mysql.query("INSERT INTO AnsibleForms.`users` set ?", record, function (err, res) {
            if(err) {
                result(err, null);
            }
            else{
                result(null, res.insertId);
            }
        });
      }
    });
};
User.update = function (record,id, result) {
    if(id==1 && record.group_id!=undefined && record.group_id!=1){
      result("You cannot change the 'admin' user out of the 'admins' group.",null)
    }else{
      bcrypt.hash(record.password, 10,function(err,hash){
        if(err){
          logger.error("error creating hash : " + err)
          result(err,null)
        }else{
          record.password = hash
          logger.debug(`Updating user ${(record.username)?record.username:id}`)
          mysql.query("UPDATE AnsibleForms.`users` set ? WHERE id=?", [record,id], function (err, res) {
              if(err) {
                  //lib/logger.error(err)
                  result(err, null);
              }
              else{
                  result(null, res);
              }
          });
        }
      });
    }

};
User.delete = function(id, result){
    if(id==1){
      result("You cannot delete user 'admin'",null)
    }else{
      logger.debug(`Deleting user ${id}`)
      mysql.query("DELETE FROM AnsibleForms.`users` WHERE id = ? AND username<>'admin'", [id], function (err, res) {
          if(err) {
              logger.error(err)
              result(err, null);
          }
          else{
              result(null, res);
          }
      });
    }

};
User.findAll = function (result) {
    logger.debug("Finding all users")
    var query = "SELECT * FROM AnsibleForms.`users` limit 20;"
    try{
      mysql.query(query,null, function (err, res) {
          if(err) {
              result(err, null);
          }
          else{
              result(null, res);
          }
      });
    }catch(err){
      result(err, null);
    }
};
User.findById = function (id,result) {
    logger.debug(`Finding user ${id}`)
    try{
      mysql.query("SELECT * FROM AnsibleForms.`users` WHERE id=?;",id, function (err, res) {
          if(err) {
              result(err, null);
          }
          else{
              result(null, res);
          }
      });
    }catch(err){
      result(err, null);
    }
};
User.findByUsername = function (username,result) {
    logger.debug(`Finding user ${username}`)
    try{
      mysql.query("SELECT * FROM AnsibleForms.`users` WHERE username=?;",username, function (err, res) {
          if(err) {
              result(err, null);
          }
          else{
              result(null, res);
          }
      });
    }catch(err){
      result(err, null);
    }
};
User.authenticate = function (username,password,result) {
    logger.debug(`Checking password for user ${username}`)
    var query = "SELECT users.id,`username`,`password`,GROUP_CONCAT(groups.name) `groups` FROM AnsibleForms.`users`,AnsibleForms.`groups` WHERE `users`.group_id=`groups`.id AND username=?;"
    try{
      mysql.query(query,username, function (err, res) {
          if(err) {
              logger.error("Error querying user : " + err)
              result(err, null);
          }
          else{
              if(res.length > 0 && res[0].password){
                bcrypt.compare(password,res[0].password,function(err,isSame){
                  if(err){
                    logger.error("Error comparing passwords : " + err)
                    result(err,null)
                  }else{
                    logger.debug(`match = ${isSame}`)
                    result(null, {isValid:isSame,user:res[0]});
                  }
                });
              }else{
                result(`User ${username} not found`,null);
              }

          }
      });
    }catch(err){
        result("Failed to connect to the AnsibleForms database", null);
    }

};
User.storeToken = function (username,username_type,refresh_token,result) {
    var record = {}
    record.username = username
    record.username_type= username_type
    record.refresh_token = refresh_token
    logger.debug(`Adding token for ${record.username} (${record.username_type})`)
    try{
      mysql.query("INSERT INTO AnsibleForms.`tokens` set ?", record,  function (err, res) {
          if(err) {
              result(err, null);
          }
          else{
              result(null, "Token saved");
          }
      });
    }catch(err){
      result("Failed to insert token in database",null)
    }
};
User.deleteToken = function (username,username_type,refresh_token,result) {
    logger.debug(`Deleting token for user ${username} (${username_type}) - ${refresh_token}`)
    try{
      User.cleanupTokens()
      mysql.query("DELETE FROM AnsibleForms.`tokens` WHERE username=? AND username_type=? AND refresh_token=?",[username,username_type,refresh_token], function (err, res) {
          if(err) {
              result(err, null);
          }else{
            result(null,"Token removed")
          }
      });
    }catch(err){
        result("Failed to connect to the AnsibleForms database. " + err, null);
    }
};
User.cleanupTokens = function() {
    logger.debug(`Deleting tokens older than a month`)
    try{
      mysql.query("DELETE FROM AnsibleForms.`tokens` WHERE timestamp < NOW() - INTERVAL 30 DAY",null, function (err, res) {
          if(err) {
            logger.error("Cleanup tokens failed")
          }else{
            logger.info("Cleanup tokens finished")
          }
      });
    }catch(err){
        logger.error("Failed to connect to the AnsibleForms database. " + err, null);
    }
};
User.checkToken = function (username,username_type,refresh_token,result) {
    logger.debug(`Checking token for user ${username} (${username_type})`)
    try{
      mysql.query("SELECT refresh_token FROM AnsibleForms.`tokens` WHERE username=? AND username_type=? AND refresh_token=? LIMIT 1",[username,username_type,refresh_token], function (err, res) {
          if(err) {
              result("Failed to connect to the AnsibleForms database : " + err, null);
          }
          else{
              if(res.length >0){
                result(null,"Refresh token is OK");
              }else{
                result(`User ${username} (${username_type}) not found`,null);
              }
          }
      });
    }catch(err){
        result("Failed to connect to the AnsibleForms database. " + err, null);
    }
};
User.getRoles = function(user,groupObj){
  var roles = ["public"]
  var groupMatch=""
  var group=""
  var groups = []
  var forms=undefined
  try{
    forms = Form.load()
  }catch(e){
    logger.error(e)
  }
  // ldap type
  if(user.type=="ldap"){
    if(groupObj.memberOf){
      // get the memberOf field, force to array
      groups = [].concat(groupObj.memberOf)
      // loop ldap groups
      groups.forEach(function(v,i,a){
        // grab groupname part
        var groupMatch=v.match("^[cCnN]{2}=([^,]*)")
        if(groupMatch.length>0){
          // prefix with ldap
          group="ldap/" + groupMatch[1]
          // add all the roles that match the group
          forms.roles.forEach(function(v,i,a){
            if(v.groups.includes(group)){
              roles.push(v.name)
            }
          })
        }
      })
    }
    return roles
  }else if(user.type="local"){
    groups = groupObj.split(",")
    groups.forEach(function(v,i,a){
      group='local/' + v
      // add all the roles that match the group
      forms.roles.forEach(function(v,i,a){
        if(v.groups.includes(group)){
          roles.push(v.name)
        }
      })
    })
    return roles
  }else{
    return roles
  }
}
User.checkLdap = function(username,password,result){
  const { authenticate } = require('ldap-authentication')
  async function auth(ldapConfig) {
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
      adminPassword: ldapConfig.bind_user_pw,
      userPassword: password,
      userSearchBase: ldapConfig.search_base,
      usernameAttribute: ldapConfig.username_attribute,
      username: username,
      // starttls: false
    }
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
      logger.debug("use tls : " + (ldapConfig.enable_tls==1))
      logger.debug("reject invalid certificates : " + !(ldapConfig.ignore_certs==1))
    }

    if(badCertificates){
      result("Certificate is not valid",null)
    }else{
      try{
        logger.debug(`Checking ldap for user ${username}`)
        logger.silly(options)
        var user = await authenticate(options)
        result(null,user)
      }catch(err){
          var em =""
          if(err.message){
            em=err.message
          }else{
            try{em = YAML.stringify(err)}catch(e){em = err}
          }


          if(err.admin){
            if(err.admin.code){
              em = err.admin.code
              if(err.admin.code=="UNABLE_TO_VERIFY_LEAF_SIGNATURE"){
                em = "Unable to verify the certificate"
              }
              if(err.admin.code==49){
                em = "Wrong binding credentials"
              }
            }
          }
          logger.error("Error connecting to ldap : " + em)
          result("Ldap : " + em,null)
      }
    }
  }
  Ldap.find(function(err,res){
    if(res){
      if(res.enable==1){
        auth(res)
      }else{
        logger.debug("Ldap is disabled")
      }
    }else{
      logger.debug("No ldap configured or not enabled")
    }
  })
}


module.exports= User;
