'use strict';
const bcrypt = require('bcrypt');
const logger=require("../lib/logger");
const authConfig = require('../../config/auth.config.js')
const helpers = require('../lib/common.js')



//user object create
var User=function(user){
    this.username = user.username;
    this.password = user.password;
    this.group_id = user.group_id;
};
User.create = function (record,config, result) {
    var dbConn = require('./../../config/db.mysql.config')(config);
    bcrypt.hash(record.password, 10,function(err,hash){
      if(err){
        logger.error("error creating hash : " + err)
        result(err,null)
      }else{
        record.password = hash
        logger.debug(`Creating user ${record.username}`)
        dbConn.query("INSERT INTO authentication.`users` set ?", record, function (err, res) {
            if(err) {
                logger.error(err)
                result(err, null);
            }
            else{
                result(null, res.insertId);
            }
        });
      }
    });
};
User.update = function (record,id,config, result) {
    var dbConn = require('./../../config/db.mysql.config')(config);
    if(id==1 && record.group_id!=1){
      result("You cannot change the 'admin' user out of the 'admins' group.",null)
    }else{
      bcrypt.hash(record.password, 10,function(err,hash){
        if(err){
          logger.error("error creating hash : " + err)
          result(err,null)
        }else{
          record.password = hash
          logger.debug(`Updating user ${record.username}`)
          dbConn.query("UPDATE authentication.`users` set ? WHERE id=?", [record,id], function (err, res) {
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
User.delete = function(id,config, result){
    var dbConn = require('./../../config/db.mysql.config')(config);
    if(id==1){
      result("You cannot delete user 'admin'",null)
    }else{
      logger.debug(`Deleting user ${id}`)
      dbConn.query("DELETE FROM authentication.`users` WHERE id = ? AND username<>'admin'", [id], function (err, res) {
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
User.findAll = function (config,result) {
    var dbConn = require('./../../config/db.mysql.config')(config);
    logger.debug("Finding all users")
    var query = "SELECT * FROM authentication.`users` limit 20;"
    try{
      dbConn.query(query, function (err, res) {
          if(err) {
              logger.error(err)
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
User.findById = function (id,config,result) {
    var dbConn = require('./../../config/db.mysql.config')(config);
    logger.debug(`Finding user ${id}`)
    var query = "SELECT * FROM authentication.`users` WHERE id=?;"
    try{
      dbConn.query(query,id, function (err, res) {
          if(err) {
              logger.error(err)
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
User.authenticate = function (username,password,config,result) {
    var dbConn = require('./../../config/db.mysql.config')(config);
    logger.debug(`Checking password for user ${username}`)
    var query = "SELECT `username`,`password`,GROUP_CONCAT(groups.name) `groups` FROM authentication.`users`,authentication.`groups` WHERE `users`.group_id=`groups`.id AND username=?;"
    logger.debug(query)
    try{
      dbConn.query(query,username, function (err, res) {
          if(err) {
              logger.error(err)
              result(err, null);
          }
          else{
              if(res.length > 0){
                bcrypt.compare(password,res[0].password,function(err,isSame){
                  if(err){
                    result(err,null)
                  }else{
                    logger.debug(`match = ${isSame}`)
                    result(null, {isValid:isSame,user:res[0]});
                  }
                });
              }else{
                result(null,null);
              }

          }
      });
    }catch(err){
        result(err, null);
    }

};
User.getRoles = function(user,groupObj){
  var roles = ["public"]
  var groupMatch=""
  var group=""
  var groups = []
  logger.debug("loading forms file")
  helpers.nocache(process.env.FORMS_PATH)
  var forms = require(process.env.FORMS_PATH)
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

  async function auth() {
    // auth with admin
    let options = {
      ldapOpts: {
        url: authConfig.ldapServer,
        // tlsOptions: { rejectUnauthorized: false }
      },
      adminDn: authConfig.ldapBindUserDn,
      adminPassword: authConfig.ldapBindUserPassword,
      userPassword: password,
      userSearchBase: authConfig.ldapSearchBase,
      usernameAttribute: authConfig.ldapUsernameAttribute,
      username: username,
      // starttls: false
    }

    try{
      logger.debug(`Checking ldap for user ${username}`)
      var user = await authenticate(options)
      result(null,user)
    }catch(err){
        logger.error(err.message)
        result(err.message,null)
    }

  }
  auth()

}


module.exports= User;
