'use strict';
// require axios for rest
const https=require('https')
const axios = require('axios');
const logger=require("../lib/logger");
const mysql=require("./db.model")
const {encrypt,decrypt} = require("../lib/crypto")
const NodeCache = require("node-cache")
const appConfig = require("../../config/app.config")

// we store the awx config for 1 hour (no need to go to database each time)
const cache = new NodeCache({
    stdTTL: 3600,
    checkperiod: (3600 * 0.5)
});
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
})
function getHttpsAgent(awxConfig){
  // logger.debug("config : " + awxConfig)
  return new https.Agent({
    rejectUnauthorized: !awxConfig.ignore_certs,
    ca: awxConfig.ca_bundle
  })
}

// constructor for awx config
var Awx=function(awx){
    this.uri = awx.uri;
    this.use_credentials = (awx.use_credentials)?1:0;
    this.username = awx.username;
    // in case someone passes password through the api
    this.password = encrypt(awx.password);
    this.token = encrypt(awx.token);
    this.ignore_certs = (awx.ignore_certs)?1:0;
    this.ca_bundle = awx.ca_bundle;
};

// get the awx config from cache or database (=wrapper function)
Awx.getConfig = async function(){
  var awxConfig=cache.get("awxConfig")
  if(awxConfig==undefined){
    awxConfig = await Awx.find()
    cache.set("awxConfig",awxConfig)
    return awxConfig
  }else{
    logger.debug("Getting awxConfig from cache")
    return awxConfig
  }
};
Awx.update = async function (record) {
  logger.info(`Updating awx`)
  await mysql.do("UPDATE AnsibleForms.`awx` set ?", record)
  cache.del("awxConfig")
  return record
};
Awx.find = async function() {
  const result = await mysql.do("SELECT * FROM AnsibleForms.`awx` limit 1;")
  if(result.length>0){
    try{
      result[0].token=decrypt(result[0].token)
    }catch(e){
      // logger.error("Couldn't decrypt awx token, did the secretkey change ?")
      result[0].token=""
    }
    try{
      result[0].password=decrypt(result[0].password)
    }catch(e){
      // logger.error("Couldn't decrypt awx token, did the secretkey change ?")
      result[0].password=""
    }        
    return result[0]
  }else{
    logger.error("No awx record in the database, something is wrong")
    throw "No awx record in the database, something is wrong"
  }
}
Awx.getAuthorization= function(awxConfig,encrypted=false){
  var axiosConfig = {}
  if(awxConfig.use_credentials){
    // logger.debug('Using credentials and basic authentication')
    var upw = `${awxConfig.username}:${(encrypted)?decrypt(awxConfig.password):awxConfig.password}`
    axiosConfig = {
      headers: {
        Authorization:`Basic ${Buffer.from(upw).toString('base64')}`
      },
      httpsAgent: getHttpsAgent(awxConfig)
    }
  }else{
    // logger.debug('Using token')
    axiosConfig = {
      headers: {
        Authorization:`Bearer ${(encrypted)?decrypt(awxConfig.token):awxConfig.token}`
      },
      httpsAgent: getHttpsAgent(awxConfig)
    }    
  }
  return axiosConfig
}

Awx.check = async function (awxConfig) {
  // this awxConfig comes from the client, not from the database
  // add the api prefix to the uri 
  awxConfig.uri = `${awxConfig.uri}${appConfig.awxApiPrefix}`
  logger.info(`Checking AWX connection at ${awxConfig.uri}`)
  const axiosConfig = Awx.getAuthorization(awxConfig,true)
  try{
    const axiosresult = await axios.get(awxConfig.uri + "/job_templates/",axiosConfig)
    if(axiosresult?.data?.results){
      return "Awx Connection is OK"
    }else{
      throw new Error("Awx Connection failed")
    }
  }catch(e){
    logger.error("Error while checking AWX connection",e)
    throw e
  }
}

module.exports= Awx;
