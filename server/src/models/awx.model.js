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
Awx.getConfig = function(result){
  var awxConfig=cache.get("awxConfig")
  if(awxConfig==undefined){
    Awx.find(function(err,res){
      if(err){
        logger.error(err)
        result(`failed to get AWX configuration`,null)
      }else{
        cache.set("awxConfig",res)
        logger.debug("Cached awxConfig from database")
        result(null,res)
      }
    })
  }else{
    // logger.debug("Getting awxConfig from cache")
    result(null,awxConfig)
  }
};
//awx object create (it's an update; during schema creation we add a record)
Awx.update = function (record, result) {
    logger.info(`Updating awx ${record.name}`)
    mysql.query("UPDATE AnsibleForms.`awx` set ?", record, function (err, res) {
        if(err) {
            result(err, null);
        }
        else{
            cache.del("awxConfig")
            result(null, res);
        }
    });
};
// get awx config from database
Awx.find = function (result) {
    var query = "SELECT * FROM AnsibleForms.`awx` limit 1;"
    try{
      mysql.query(query, function (err, res) {
          if(err) {
              result(err, null);
          }
          else{
            if(res.length>0){
              try{
                res[0].token=decrypt(res[0].token)
              }catch(e){
                logger.error("Couldn't decrypt awx token, did the secretkey change ?")
                res[0].token=""
              }
              result(null, res[0]);
            }else{
              logger.error("No awx record in the database, something is wrong")
            }

          }
      });
    }catch(err){
      logger.error("error querying awx config")
      result(err, null);
    }
};
// check connection
Awx.check = function (awxConfig,result) {

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
        result(null,"Awx Connection is OK")
      }
    })
    .catch(function (error) {
      logger.error(error.message)
      result(error.message,null)
    })

};
module.exports= Awx;
