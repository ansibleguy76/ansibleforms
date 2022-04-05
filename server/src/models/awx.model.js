'use strict';
// require axios for rest
const https=require('https')
const axios = require('axios');
const logger=require("../lib/logger");
const mysql=require("./db.model")
const {encrypt,decrypt} = require("../lib/crypto")
const NodeCache = require("node-cache")

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
    this.token = encrypt(awx.token);
    this.ignore_certs = (awx.ignore_certs)?1:0;
    this.ca_bundle = awx.ca_bundle;
};

// get the awx config from cache or database (=wrapper function)
Awx.getConfig = function(){
  var awxConfig=cache.get("awxConfig")
  if(awxConfig==undefined){
    return Awx.find()
      .then((awx)=>{
        cache.set("awxConfig",awx)
        logger.debug("Cached awxConfig from database")
        return awx
      })
  }else{
    // logger.debug("Getting awxConfig from cache")
    return Promise.resolve(awxConfig)
  }
};
Awx.update = function (record) {
  logger.info(`Updating awx ${record.name}`)
  return mysql.do("UPDATE AnsibleForms.`awx` set ?", record)
    .then((res)=>{
      cache.del("awxConfig")
      return res
    })
};
Awx.find = function() {
  return mysql.do("SELECT * FROM AnsibleForms.`awx` limit 1;")
    .then((res)=>{
      if(res.length>0){
        try{
          res[0].token=decrypt(res[0].token)
        }catch(e){
          logger.error("Couldn't decrypt awx token, did the secretkey change ?")
          res[0].token=""
        }
        return res[0]
      }else{
        logger.error("No awx record in the database, something is wrong")
        throw "No awx record in the database, something is wrong"
      }
    })

};
Awx.check = function (awxConfig) {
  logger.info(`Checking AWX connection`)
  const axiosConfig = {
    headers: {
      Authorization:"Bearer " + decrypt(awxConfig.token)
    },
    httpsAgent: getHttpsAgent(awxConfig)
  }
  return axios.get(awxConfig.uri + "/api/v2/job_templates/",axiosConfig)
    .then((axiosresult)=>{
      if(axiosresult?.data?.results){
        return "Awx Connection is OK"
      }else{
        throw new Error("Awx Connection failed")
      }
    })
};
module.exports= Awx;
