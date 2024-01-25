'use strict';
const crypto = require("../lib/crypto")
const logger=require("../lib/logger");
const authConfig = require('../../config/auth.config')
const appConfig = require('../../config/app.config')
const ldapAuthentication = require('../lib/ldap-authentication').authenticate
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
User.create = function (record) {
  return crypto.hashPassword(record.password)
    .then((hash)=>{
      record.password = hash
      logger.info(`Creating user ${record.username}`)
      return mysql.do("INSERT INTO AnsibleForms.`users` set ?", record)
    })
    .then((res)=>{
      return res.insertId
    })
};
User.update = function (record,id) {
  if(id==1 && record.group_id!=undefined && record.group_id!=1){
    return Promise.reject("You cannot change the 'admin' user out of the 'admins' group.")
  }
  if(record.password){
    logger.info(`Updating user with password ${(record.username)?record.username:id}`)
    return crypto.hashPassword(record.password)
      .then((hash)=>{
        record.password = hash
        return mysql.do("UPDATE AnsibleForms.`users` set ? WHERE id=?", [record,id])
      })
  }else{
    logger.info(`Updating user ${(record.username)?record.username:id}`)
    return mysql.do("UPDATE AnsibleForms.`users` set ? WHERE id=?", [record,id])
  }

};
User.delete = function(id){
    if(id==1){
      return Promise.reject("You cannot delete user 'admin'")
    }else{
      logger.info(`Deleting user ${id}`)
      return mysql.do("DELETE FROM AnsibleForms.`users` WHERE id = ? AND username<>'admin'", [id])
    }
};
User.findAll = function () {
    logger.info("Finding all users")
    return mysql.do("SELECT * FROM AnsibleForms.`users`;")
};
User.findById = function (id) {
    logger.info(`Finding user ${id}`)
    return mysql.do("SELECT * FROM AnsibleForms.`users` WHERE id=?;",id)
};
User.findByUsername = function (username) {
    logger.info(`Finding user ${username}`)
    return mysql.do("SELECT * FROM AnsibleForms.`users` WHERE username=?;",username)
};
User.authenticate = function (username,password) {
    logger.info(`Checking password for user ${username}`)
    var query = "SELECT users.id,`username`,`password`,GROUP_CONCAT(groups.name) `groups` FROM AnsibleForms.`users`,AnsibleForms.`groups` WHERE `users`.group_id=`groups`.id AND username=?;"
    return mysql.do(query,username)
      .then((res)=>{
        if(res.length > 0 && res[0].password){
          return crypto.checkPassword(password,res[0].password,res[0])
        }else{
          throw `User ${username} not found`
        }
      })
};
User.storeToken = function (username,username_type,refresh_token) {
    var record = {}
    record.username = username
    record.username_type= username_type
    record.refresh_token = refresh_token
    logger.info(`Adding token for ${record.username} (${record.username_type})`)
    return mysql.do("INSERT INTO AnsibleForms.`tokens` set ?", record)
};
User.deleteToken = function (username,username_type,refresh_token) {
    logger.info(`Deleting token for user ${username} (${username_type}) - ${refresh_token}`)
    User.cleanupTokens()
    return mysql.do("DELETE FROM AnsibleForms.`tokens` WHERE username=? AND username_type=? AND refresh_token=?",[username,username_type,refresh_token])
};
User.cleanupTokens = function() {
    logger.info(`Deleting tokens older than a month`)
    mysql.do("DELETE FROM AnsibleForms.`tokens` WHERE timestamp < NOW() - INTERVAL 30 DAY")
      .then(()=>{logger.notice("Cleanup tokens finished")})
      .catch((err)=>{logger.error("Cleanup tokens failed. "+err)})
};
User.checkToken = function (username,username_type,refresh_token) {
  logger.info(`Checking token for user ${username} (${username_type})`)
  return mysql.do("SELECT refresh_token FROM AnsibleForms.`tokens` WHERE username=? AND username_type=? AND refresh_token=? LIMIT 1",[username,username_type,refresh_token])
    .then((res)=>{
      if(res.length >0){
        return "Refresh token is OK"
      }else{
        throw `User ${username} (${username_type}) not found`
      }
    })
};
User.getRoles = function(groups,user){
  var roles = ["public"]
  var forms=undefined
  var full_username = `${user.type}/${user.username}`
  return Form.load()
  .then((forms)=>{
    // derive roles from forms
    groups.forEach(function(group){
      // add all the roles that match the group
      forms.roles.forEach(function(role){
        if(role.groups && role.groups.includes(group)){
          roles.push(role.name)
        }
      })
    })

    // add all the roles that match the user
    forms.roles.forEach(function(role){
      if(role.users && role.users.includes(full_username)){
        roles.push(role.name)
      }
    })

    return roles
  })
  .catch((e)=>{
    // return temp role if needed
    logger.error(e)
    if(groups.includes('local/admins')){
      roles.push("admin")
    }
    return roles
  })

}
User.getGroups = function(user,groupObj,ldapConfig={}){
  var group=""
  var groups = []

  // ldap type
  if(user.type=="ldap" && ldapConfig.groups_attribute){
    if(groupObj[ldapConfig.groups_attribute]){
      // get the memberOf field, force to array
      var ldapgroups = [].concat(groupObj[ldapConfig.groups_attribute])
      //logger.debug(`LDAP Groups = ${ldapgroups}`)
      // loop ldap groups
      ldapgroups.forEach(function(v,i,a){
        // grab groupname part
        // logger.debug(JSON.stringify(v))
        var groupObject = v["objectName"] || v // https://github.com/ansibleguy76/ansibleforms/issues/119 first try objectName and then fall back.  Different flavours of ldap servers return different group objects.  Until someone else hit's another flavour, these are the ones we implement.
        var groupMatch=groupObject.match("^[cCnN]{2}=([^,]*)")
        if(groupMatch.length>0){
          // prefix with ldap
          group="ldap/" + groupMatch[1]
          // add all the roles that match the group
          groups.push(group)
        }
      })
    }
    return groups
  }else if(user.type="local"){
    var localgroups = groupObj.split(",")
    localgroups.forEach(function(v,i,a){
      group='local/' + v
      // add all the roles that match the group
      groups.push(group)
    })
    return groups
  }else{
    return groups
  }
}
User.checkLdap = function(username,password){

  return Ldap.find()
    .then((ldapConfig)=>{
      if(ldapConfig.enable==1){
        return ldapConfig
      }else {
        throw "No ldap configured or not enabled"
      }
    })
    .then(async (ldapConfig)=>{
      // auth with admin
      var badCertificates=false
      let options = {
        ldapOpts: {
          url: ((ldapConfig.enable_tls==1)?"ldaps":"ldap") + "://" + ldapConfig.server + ":" + ldapConfig.port,
          tlsOptions: {}
        },
        adminDn: ldapConfig.bind_user_dn,
        adminPassword: ldapConfig.bind_user_pw,
        userPassword: password,
        userSearchBase: ldapConfig.search_base,
        usernameAttribute: ldapConfig.username_attribute,
        username: username,
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
        throw "Certificate is not valid"
      }else{
        logger.info(`Checking ldap for user ${username}`)
        // logger.debug(JSON.stringify(options))
        return ldapAuthentication(options)
      }
    })
    .catch((err)=>{
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
      throw ("Ldap : " + em)
    })
}


module.exports= User;
