const passport = require('passport');
const basicStrategy = require('modern-passport-http').BasicStrategy;
const User = require('./../models/user.model');
const authConfig = require('../../config/auth.config.js')
const logger=require("../lib/logger");
const Helpers = require('../lib/common');


// create username / password login strategy
passport.use(
  'basic',
  new basicStrategy(
    async (username, password, done) => {
      // authentication against database first
      try{
        var user = await User.authenticate(username,password)
          .then((result)=>{
            var user = {}
            // user found in db
            if(!result.isValid) throw "Wrong password"
            user.username = result.user.username
            user.id = result.user.id
            user.type = 'local'
            user.groups = User.getGroups(user,result.user.groups)
            user.roles = User.getRoles(user.groups,user)
            logger.info("local login is ok => " + user.username)
            return user
          })
        // we have an authenticated user
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
        var user = await User.checkLdap(username,password)
          .then((result)=>{
            var user = {}
            user.username = result.sAMAccountName
            user.type = 'ldap'
            user.groups = User.getGroups(user,result)
            user.roles = User.getRoles(user.groups,user)
            logger.info("ldap login is ok => " + user.username)
            return user
          })
          .catch((err)=>{
            const match = Helpers.getError(err)?.match(authConfig.ldapErrorRegex)
            if(match){
              try{
                var errMessage=authConfig.ldapErrors[match[1]]
              }catch(e){
                throw "Error " + match[1]
              }
              throw errMessage
            }
            throw err
          })
        // we have an authenticated user
        return done(null,user)
      }catch(err){
        return done(err)
      }
    }
  )
);