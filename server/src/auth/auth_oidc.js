const passport = require('passport');
const Settings = require('../models/settings.model')
const OIDC = require('../models/oidc.model.js')
const logger=require("../lib/logger");
const openidClient = require('openid-client');
const appConfig = require("../../config/app.config");

var authClient;

exports.initialize = async () =>{
  
  logger.debug("Initializing OIDC strategy")
  passport.serializeUser(function(user, done) {
    done(null, user);
  });

  passport.deserializeUser(function(user, done) {
    done(null, user);
  });

  var oidcConfig
  var oidc
  var oidcEnabled = false
  var settings = {}
  var url
  try{
    oidc = await OIDC.isEnabled()
    oidcEnabled = !!oidc.enable
    if(!oidcEnabled){
      logger.info("OIDC is not enabled")
    }else{
      oidcConfig = await OIDC.find()
      settings = await Settings.find()
      url = settings.url?.replace(/\/$/g,'')
      if(!url){
        logger.error("AnsibleForms Url is not set")
      }
    }

  }catch(err){
    logger.error("Failed to getting OIDC Config or settings. ",err)
    return false
  }
  try{
    logger.debug("Removing the strategy OIDC")
    passport.unuse('oidc')
    authClient = undefined
    if(!oidcEnabled){
      return true
    }
  }catch(err){
    logger.error("Failed to remove strategy. ", err)
  }  
  if(!oidcEnabled || !url){
    logger.error("Could not enable OIDC strategy, no config or url")
    return false
  }
  try{
    logger.debug("Fetching OIDC Issuer")
    const oidcIssuer = await openidClient.Issuer.discover(oidcConfig.issuer)
    authClient = new oidcIssuer.Client({
      clientID: oidcConfig.client_id,
      clientSecret: oidcConfig.secret_id,
      redirect_uris: [`${url}${appConfig.baseUrl}api/v1/auth/oidc/callback`],
      post_logout_redirect_uris: [`${url}${appConfig.baseUrl}api/v1/auth/oidc/logout`],
      response_types: ['code'],
    });
    logger.debug("Adding the strategy OIDC")
    passport.use(
      'oidc',
      new openidClient.Strategy({oidcClient},
        // mandatory verify passport method
        async function (tokenSet, userinfo, done) {
          done(null, tokenSet.claims())
        }
      )
    );    

    logger.info("OIDC strategy initialized")
    return true

  }catch(err){
    logger.error("Failed to initialize OIDC strategy. ",err)
    return false
  }
  
}

exports.logout = async (req, res) => {
  if (typeof authClient !== 'undefined' && authClient !== null) {
    res.redirect(authClient.endSessionUrl());
  }
}
