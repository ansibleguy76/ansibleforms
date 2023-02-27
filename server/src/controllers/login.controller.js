'use strict';
const User = require("../models/user.model")
const AzureAd = require("../models/azureAd.model")
const passport = require('passport');
const jwt = require('jsonwebtoken');
var authConfig = require('../../config/auth.config')
const logger=require("../lib/logger");
const {inspect}=require("node:util")
const Helpers=require('../lib/common')
const RestResult = require("../models/restResult.model")

function userToJwt(user){

  // is something like
  // {"username":"administrator","type":"local","roles":["public","admin"]}

  // we create 2 jwt tokens (accesstoken and refresh token)
  const token = jwt.sign({user,access:true}, authConfig.secret,{ expiresIn: authConfig.jwtExpiration});
  const refreshtoken = jwt.sign({user,refresh:true}, authConfig.secret,{ expiresIn: authConfig.jwtRefreshExpiration});
  logger.debug(JSON.stringify(user))
  // we store the tokens in the database, to later verify a refresh token action
  logger.info("Storing refreshtoken in database for user " + user.username)
  User.storeToken(user.username,user.type,refreshtoken,function(err,result){
    if(err){
      logger.error(err)
    }else{
      logger.info(result)
    }
  })
  return {
    token: token,
    refreshtoken: refreshtoken
  }
}
// get login settings
exports.settings = async function(req,res){
  AzureAd.isEnabled()
  .then((azure)=>{
    var settings={}
    // console.log(inspect(azure))
    settings.azureAdEnabled=azure.enable
    settings.azureGraphUrl=authConfig.azureGraphUrl
    res.json(new RestResult("success","",settings,""))
  })
  .catch((err)=>{res.json(new RestResult("error","failed to get app settings",null,Helpers.getError(err)))})
}
// basic authentication with local users
exports.basic = async function(req, res,next) {
    
    // as login, we authenticate against our passport basic (username and password are extracted by passport)
    // in auth.js the user is searched locally and eventually returns either an error or the user
    passport.authenticate(
      'basic',
      async (err, user) => {
        try {
          // if we have an error; we return it
          var e=Helpers.getError(err)
          if (e || !user) {
            // basic authentication returned no result, move to next middleware (ldap)
            if(e.includes('not found')){
              // store error message if ldap is not enabled
              res.locals.basic_authentication_error=e
              return next()
            }
            var error={token:""}
            if(err){
              logger.error(e)
              error.message=e
            }
            
            return res.json(error);
          }
          // we found a user (local or ldap) with correct password; we start the login process (a function attached by passport !)
          // http://www.passportjs.org/docs/login/
          req.login(
            user,
            { session: false },
            async (error) => {
              if (error){
                logger.error(Helpers.getError(error))
                //return next(error);
              }
              // send the tokens to the requester
              return res.json(userToJwt(user));
            }
          );
        } catch (error) {
          logger.error(Helpers.getError(error))
          //return next(error);
        }
      }
    )(req, res, next);
};

// basic authentication with LDAP users
exports.basic_ldap = async function(req, res,next) {
  // as login, we authenticate against our passport basic (username and password are extracted by passport)
  // in auth.js the user is searched in ldap and eventually returns either an error or the user
  passport.authenticate(
    'ldap',
    async (err, user) => {
      try {
        // if we have an error; we return it
        var e=Helpers.getError(err)
        if (e || !user) {
          var error={token:""}
          if(e){
            error.message=e
            if(e.includes("No ldap configured")){
              error.message = res.locals.basic_authentication_error
            }            
          }
          return res.json(error);
        }
        // we found a user (local or ldap) with correct password; we start the login process (a function attached by passport !)
        // http://www.passportjs.org/docs/login/
        req.login(
          user,
          { session: false },
          async (error) => {
            if (error){
              logger.error(Helpers.getError(error))
              return next(error);
            }
            // send the tokens to the requester
            return res.json(userToJwt(user));
          }
        );
      } catch (error) {
        logger.error(Helpers.getError(error))
        return next(error);
      }
    }
  )(req, res, next);
};

// this redirects to Azure AD login but with the proper application client id & secret
exports.azureadoauth2 = async function(req, res,next) {
  logger.debug("Redirect to azure")
  // redirect to azure
  passport.authenticate(
    'azure_ad_oauth2'
  )(req,res,next)
};
// catches middleware error (non implemented strategy for example)
exports.errorHandler = async function(err,req, res,next) {
  res.redirect(`/#/login?error=${err}`)
};

// callback with the Azure AD user info
exports.azureadoauth2callback = async function(req, res,next) {
  logger.debug("Callback")
  passport.authenticate(
    'azure_ad_oauth2', 
    async (err, azuretoken) => {
      try {
        // if we have an error; we return it
        if (err) {
          logger.error(Helpers.getError(err))
          return next(err)
        }else{
          res.redirect(`/#/login?azuretoken=${azuretoken}`)
        }

      } catch (err) {
        logger.error(Helpers.getError(err))
        return next(err)
      }
    }    
  )(req, res, next)
};
// callback with the Azure AD user info
exports.azureadoauth2login = async function(req, res,next) {
  try{
    logger.debug("Login")
    var azuretoken=req.body.azuretoken
    var groups=req.body.groups
    var payload = jwt.decode(azuretoken, '', true);
    const user={}
    user.username = payload.upn
    user.id = payload.oid
    user.type = 'azuread'
    user.groups = groups
    user.roles = User.getRoles(user.groups,user)
    res.json(userToJwt(user))
  }catch(err){
    logger.error(Helpers.getError(err))
    next(err)
  }

};



