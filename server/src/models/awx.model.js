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
  return new Promise((resolve,reject)=>{
    var awxConfig=cache.get("awxConfig")
    if(awxConfig==undefined){
      Awx.find()
        .then((awx)=>{
          cache.set("awxConfig",res)
          logger.debug("Cached awxConfig from database")
          resolve(awx)
        })
        .catch((err)=>{
          logger.error(err)
          reject(`failed to get AWX configuration`)
        })
    }else{
      // logger.debug("Getting awxConfig from cache")
      resolve(awxConfig)
    }
  })
};
//awx object create (it's an update; during schema creation we add a record)
Awx.update = function (record, result) {
  return new Promise((resolve,reject)=>{
    logger.info(`Updating awx ${record.name}`)
    mysql.do("UPDATE AnsibleForms.`awx` set ?", record)
      .then((res)=>{
        cache.del("awxConfig")
        resolve(res)
      })
      .catch((err)=>{ reject(err) })
  })
};
// get awx config from database
Awx.find = function (result) {
  return new Promise((resolve,resject)=>{
    mysql.do("SELECT * FROM AnsibleForms.`awx` limit 1;")
      .then((res)=>{
        if(res.length>0){
          try{
            res[0].token=decrypt(res[0].token)
          }catch(e){
            logger.error("Couldn't decrypt awx token, did the secretkey change ?")
            res[0].token=""
          }
          resolve(res[0])
        }else{
          logger.error("No awx record in the database, something is wrong")
          reject("No awx record in the database, something is wrong")
        }
      })
      .catch((err)=>{
        logger.error("error querying awx config " + err)
        reject(err)
      })
  })
};
// check connection
Awx.check = function (awxConfig) {
  return new Promise((resolve,reject)=>{
    logger.info(`Checking AWX connection`)
    // prepare axiosConfig
    logger.info(awxConfig)
    const axiosConfig = {
      headers: {
        Authorization:"Bearer " + decrypt(awxConfig.token)
      },
      httpsAgent: getHttpsAgent(awxConfig)
    }
    axios.get(awxConfig.uri + "/api/v2/job_templates/",axiosConfig)
      .then((axiosresult)=>{
        if(axiosresult.data.results){
          resolve("Awx Connection is OK")
        }
      })
      .catch(function (error) {
        logger.error(error.message)
        reject(error.message)
      })
  })


};
module.exports= Awx;
