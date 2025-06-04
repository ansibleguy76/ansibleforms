const passport = require('passport');
const basicStrategy = require('modern-passport-http').BasicStrategy;
const User = require('./../models/user.model');
const authConfig = require('../../config/auth.config.js')
const appConfig = require('../../config/app.config.js')
const logger=require("../lib/logger");
const Helpers = require('../lib/common');
const Ldap = require('../models/ldap.model')


// create username / password login strategy
passport.use(
  'basic',
  new basicStrategy(
    async (username, password, done) => {
      // authentication against database first
      try{
        if(appConfig.enableBypass){
          var user = {}
          user.id = 0
          user.username = 'bypass admin'
          user.type = 'bypass'
          user.groups = []
          user.roles = ['admin']
          logger.warning("Logging in with bypass")
          return done(null,user)
        }
        var result = await User.authenticate(username,password)
        if(!result){
          return done(new Error("Wrong password"))
        }
        var user = {}
        user.username = result.user.username
        if(result.user.email){
          user.email = result.user.email
        }
        user.id = result.user.id
        user.type = 'local'
        user.groups = User.getGroups(user,result.user.groups)
        const ro = await User.getRolesAndOptions(user.groups,user)
        user.roles = ro.roles
        user.options = ro.options        
        return done(null,user)
      }catch(err){
        return done(err)
      }
    }
  )
);

passport.use(
  'ldap',
  new basicStrategy(
    async (username, password, done) => {
      // authentication against database first
      try{
        var ldapConfig = await Ldap.find()
        var result = await User.checkLdap(username,password)
        var user = {}
        user.username = result[ldapConfig.username_attribute]
        user.email = result[ldapConfig.mail_attribute]
        user.type = 'ldap'
        user.groups = User.getGroups(user,result,ldapConfig)
        const ro = await User.getRolesAndOptions(user.groups,user)
        user.roles = ro.roles
        user.options = ro.options
        logger.info("ldap login for " + user.username)
        return done(null,user)
      } catch(err){
        const match = Helpers.getError(err)?.match(authConfig.ldapErrorRegex)
        if(match){
          try{
            var errMessage=authConfig.ldapErrors[match[1]]
            done(new Error(errMessage))
          }catch(e){
            done(new Error("Error " + match[1]))
          }
        }
        done(err)
      }
    }
  )
);
