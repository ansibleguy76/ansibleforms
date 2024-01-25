const passport = require('passport');
const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const authConfig = require('../../config/auth.config.js')
const appConfig = require('../../config/app.config')
const Settings = require('../models/settings.model')
const AzureAd = require('../models/azureAd.model.js')
const logger=require("../lib/logger");
const axios=require("axios")
const {inspect} = require("node:util")
const azureAdOAuth2Strategy = require('@outlinewiki/passport-azure-ad-oauth2');

exports.initialize = async () =>{
  
  logger.debug("Initializing Azure AD strategy")
  passport.serializeUser(function(user, done) {
    done(null, user);
  });

  passport.deserializeUser(function(user, done) {
    done(null, user);
  });

  var azureConfig
  var azure
  var azureEnabled = false
  var settings = {}
  var url
  try{
    azure = await AzureAd.isEnabled()
    azureEnabled = !!azure.enable
    if(!azureEnabled){
      logger.info("Azure AD is not enabled")
    }else{
      azureConfig = await AzureAd.find()
      settings = await Settings.find()
      url = settings.url?.replace(/\/$/g,'')
      if(!url){
        logger.error("AnsibleForms Url is not set")
      }
    }

  }catch(err){
    logger.error("Failed to getting azureConfig or settings. ",err)
    return false
  }
  try{
    logger.debug("Removing the strategy azure ad")
    passport.unuse('azure_ad_oauth2')
    if(!azureEnabled){
      return true
    }
  }catch(err){
    logger.error("Failed to remove strategy. ", err)
  }  
  if(!azureConfig || !url){
    logger.error("Could not enable Azure strategy, no config or url")
    return false
  }
  try{
    logger.debug("Adding the strategy azure ad")
    passport.use(
      'azure_ad_oauth2', 
      new azureAdOAuth2Strategy(
        {
          clientID: azureConfig.client_id,
          clientSecret: azureConfig.secret_id,
          callbackURL: `${url}${appConfig.baseUrl}api/v1/auth/azureadoauth2/callback`,
          resource: '00000003-0000-0000-c000-000000000000' // required, or it will not work
        },
        // mandatory verify passport method
        async function (accessToken, refresh_token, params, profile, done) {
          done(null,accessToken)    
        }
      )
    );    

    logger.info("Azure AD strategy initialized")
    return true

  }catch(err){
    logger.error("Failed to initialize Azure AD strategy. ",err)
    return false
  }
  
}