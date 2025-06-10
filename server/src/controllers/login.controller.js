'use strict';
import User from "../models/user.model.js";
import AzureAd from "../models/azureAd.model.js";
import OIDC from "../models/oidc.model.js";
import passport from 'passport';
import jwt from 'jsonwebtoken';
import authConfig from '../../config/auth.config.js';
import logger from "../lib/logger.js";
import helpers from '../lib/common.js';
import RestResult from "../models/restResult.model.js";
import auth_oidc from "../auth/auth_oidc.js";

function hasValidLoginOption(user) {
  if(user.options.enableLogin === false) {
    logger.warning(`Login is disabled for user '${user.username}' in the configuration (enableLogin option is set to false), please check your settings`)
    return false;
  } 
  return true;
}

function userToJwt(user,expiryDays){

  // is something like
  // {"username":"administrator","type":"local","roles":["public","admin"]}

  var tokenExpiresIn

  if(expiryDays && (user?.options["extendedTokenExpiration"] ?? false) && !isNaN(expiryDays)){  
    tokenExpiresIn = `${expiryDays}D`
    logger.info("Extended token expiration requested for " + user.username)
  }else{
    tokenExpiresIn = authConfig.jwtExpiration
  }

  // we create 2 jwt tokens (accesstoken and refresh token)
  const token = jwt.sign({user,access:true}, authConfig.secret,{ expiresIn: tokenExpiresIn, issuer: authConfig.jwtIssuer});
  const refreshtoken = jwt.sign({user,refresh:true}, authConfig.secret,{ expiresIn: authConfig.jwtRefreshExpiration, issuer: authConfig.jwtIssuer});
  logger.debug(JSON.stringify(user))
  // we store the tokens in the database, to later verify a refresh token action
  logger.info("Storing refreshtoken in database for user " + user.username)
  User.storeToken(user.username,user.type,refreshtoken,function(err,result){
    if(err){
      logger.error("Failed to store token. ",err)
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
const settings = async function(req,res){
  AzureAd.isEnabled()
  .then((azure)=> {
    var settings={}
    // console.log(inspect(azure))
    settings.azureAdEnabled=azure.enable
    settings.azureGroupfilter=azure.groupfilter
    settings.azureGraphUrl=authConfig.azureGraphUrl

    OIDC.isEnabled().then((oidc) => {
      settings.oidcEnabled=oidc.enabled
      settings.oidcIssuer=oidc.issuer
      settings.oidcGroupfilter=oidc.groupfilter
      res.json(new RestResult("success","",settings,""))
    })
  })
  .catch((err)=>{res.json(new RestResult("error","failed to get app settings",null,helpers.getError(err)))})
}
// basic authentication with local users
const basic = async function(req, res,next) {
    
    // as login, we authenticate against our passport basic (username and password are extracted by passport)
    // in auth.js the user is searched locally and eventually returns either an error or the user
    passport.authenticate(
      'basic',
      async (err, user) => {
        try {
          // if we have an error; we return it
          var e=helpers.getError(err)
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
                logger.error(helpers.getError(error))
                //return next(error);
              }
              if(!hasValidLoginOption(user)){
                return res.status(401).json({ error: "Not authenticated, login is not enabled for this user." });
              }        
              // send the tokens to the requester
              return res.json(userToJwt(user,req.query.expiryDays));
            }
          );
        } catch (error) {
          logger.error(helpers.getError(error))
          //return next(error);
        }
      }
    )(req, res, next);
};

// basic authentication with LDAP users
const basic_ldap = async function(req, res,next) {
  // as login, we authenticate against our passport basic (username and password are extracted by passport)
  // in auth.js the user is searched in ldap and eventually returns either an error or the user
  passport.authenticate(
    'ldap',
    async (err, user) => {
      try {
        // if we have an error; we return it
        var e=helpers.getError(err)
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
              logger.error(helpers.getError(error))
              return next(error);
            }
          
            if(!hasValidLoginOption(user)){
              return res.status(401).json({ error: "Not authenticated, login is not enabled for this user." });
            }
            // send the tokens to the requester
            return res.json(userToJwt(user,req.query.expiryDays));
          }
        );
      } catch (error) {
        logger.error(helpers.getError(error))
        return next(error);
      }
    }
  )(req, res, next);
};

/**
 * perform logout actions
 */
const logout = async function(req, res, next){
  req.logout((err) => {
    if (err) {
      logger.error(helpers.getError(error))
      return next(err)
    }
    res.json(new RestResult("success","",{logoutUrl: auth_oidc.getLogoutUrl()},""))
  });
};

// catches middleware error (non implemented strategy for example)
const errorHandler = async function(err,req, res,next) {
  res.redirect(`/#/login?error=${err}`)
};

/**
 * generate the callback options for login via identity provider oauth2
 * 
 * Some information about how the identity provide mechanism works:
 * 
 * 1. The user clicks on the identity provider login button
 * 2. A browser storage authIssuer key is set with the identity provider name (azuread, oidc, ...)
 * 3. The user is redirected to the ansibleforms backend server identity provider api https://ansibleformsurl/auth/azureadoauth2 or https://ansibleformsurl/auth/oidc, ...
 * 4. The backend uses passport to authenticate the user with the identity provider and redirects the user away to the identity provider (microsft, google, ...)
 * 5. The identity provider authenticates the user and redirects the user back to the callback url https://ansibleformsurl/auth/azureadoauth2/callback or https://ansibleformsurl/auth/oidc/callback
 * 6. The backend server receives the callback and uses passport to verify the returned payload.  it passes the payload to an authCallback function
 * 7. The authCallback function redirects the user back to the frontend with a token (#/login?token=) azuread already passed a token, oidc has a raw payload and we create a manual token.
 * 8. The frontend uses the oauth2 token to grab more group information and filter the group information with a filter defined in the database with the identity provider
 * 9. The frontend redirects the user to the backend /auth/azureadaoath/login endpoint with the token and the group information
 * 10. The backend grabs more information from payload if needed (username,...) and assembles a user-object, the roles and options are added
 * 11. The backend converts the user object to json and signs it as a jwt token an returns it in the response
 * 12. The frontend grabs the token and stores it in the local storage, ready for jwt-bearer authentication
 * 
 */
const authCallback = function(req, res, next, type) {
  return async (err, payload) => {
    // we assume the payload is a jwt token, with azuread this is the case
    var token = payload
    // in case of oidc, the payload is not a token, but a raw object
    // we need to create a token from it, we use the type 'oidc' as the secret
    if(type=="oidc"){
      token = jwt.sign(payload, type);
    }
    try {
      // if we have an error; we return it
      if (err) {
        logger.error(helpers.getError(err))
        return next(err)
      }else{
        res.redirect(`/#/login?token=${token}`)
      }

    } catch (err) {
      logger.error(helpers.getError(err))
      return next(err)
    }
  }
};

const extractAzureUser = async function(payload, groups) {
  return {
    username: payload.upn,
    id: payload.oid,
    groups: groups.map(g => `azuread/${g}`) // groups are prefixed with azuread/ to avoid conflicts with oidc groups etc
  }
};

const extractOidcUser = async function(payload, groups) {
  return {
    username: payload.preferred_username,
    groups: groups.map(g => `oidc/${g}`) // groups are prefixed with oidc/ to avoid conflicts with azuread groups etc
  }
};

// this redirects to Azure AD login but with the proper application client id & secret
const azureadoauth2 = async function(req, res,next) {
  logger.debug("Redirect to azure")
  // redirect to azure
  passport.authenticate('azure_ad_oauth2')(req,res,next)
};

// callback with the Azure AD access token
const azureadoauth2callback = async function(req, res,next) {
  passport.authenticate('azure_ad_oauth2', authCallback(req, res, next,"azuread"))(req, res, next)
};
// callback with the Azure AD user info (including groups)
const azureadoauth2login = async function(req, res,next) {
  try {
    var payload = jwt.decode(req.body.token, '', true)
    const user = await extractAzureUser(payload, req.body.groups)
    user.type = "azuread"
    const ro = await User.getRolesAndOptions(user.groups,user)
    user.roles = ro.roles
    user.options = ro.options  
    if(!hasValidLoginOption(user)){
      return res.status(401).json({ error: "Not authenticated, login is not enabled for this user." });
    }     
    // return token
    res.json(userToJwt(user))

  } catch(err){
    logger.error(helpers.getError(err))
    next(err)
  }
};

// this redirects to OIDC Provider login but with the proper application client id & secret
const oidc = async function(req, res,next) {
  logger.debug("Redirect to Open ID Issuer")
  // redirect to Open ID Connect Provider
  passport.authenticate('oidc')(req,res,next)
};

// callback with the OIDC access token
const oidcCallback = async function(req, res,next) {
  passport.authenticate('oidc', authCallback(req, res, next, 'oidc'))(req, res, next)
};
// callback with the OIDC user info (including groups)
const oidcLogin = async function(req, res, next) {
  try {
    var payload = jwt.verify(req.body.token, 'oidc'); // verify, with secret "oidc"
    const user = await extractOidcUser(payload, req.body.groups)
    user.type = "oidc"
    const ro = await User.getRolesAndOptions(user.groups,user)
    user.roles = ro.roles
    user.options = ro.options  
    if(!hasValidLoginOption(user)){
      return res.status(401).json({ error: "Not authenticated, login is not enabled for this user." });
    }     
    // return token
    res.json(userToJwt(user))

  } catch(err){
    logger.error(helpers.getError(err))
    next(err)
  }
};

export default {
  basic,
  basic_ldap,
  logout,
  errorHandler,
  settings,
  azureadoauth2,
  azureadoauth2callback,
  azureadoauth2login,
  oidc,
  oidcCallback,
  oidcLogin
}