'use strict';
// require axios for rest
const https=require('https')
const axios = require('axios');
const cheerio = require('cheerio');
const logger=require("../lib/logger");
const mysql=require("./db.model")
const Helpers=require("../lib/common")
const YAML=require("yaml")
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
  // logger.silly("config : " + awxConfig)
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
        logger.silly("Cached awxConfig from database")
        result(null,res)
      }
    })
  }else{
    // logger.silly("Getting awxConfig from cache")
    result(null,awxConfig)
  }
};
//awx object create (it's an update; during schema creation we add a record)
Awx.update = function (record, result) {
    logger.debug(`Updating awx ${record.name}`)
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
// abort awx job template
Awx.abortJob = function (id, result) {

  Awx.getConfig(function(err,awxConfig){

    if(err){
      logger.error(err)
      result(`failed to get AWX configuration`)
    }else{

      var message=""
      logger.debug(`aborting awx job ${id}`)
      const axiosConfig = {
        headers: {
          Authorization:"Bearer " + awxConfig.token
        },
        httpsAgent: getHttpsAgent(awxConfig)
      }
      // we first need to check if we CAN cancel
      axios.get(awxConfig.uri + "/api/v2/jobs/" + id + "/cancel/",axiosConfig)
        .then((axiosresult)=>{
          var job = axiosresult.data
          if(job && job.can_cancel){
              logger.debug(`can cancel job id = ${id}`)
              axios.post(awxConfig.uri + "/api/v2/jobs/" + id + "/cancel/",{},axiosConfig)
                .then((axiosresult)=>{
                  job = axiosresult.data
                  result(job,null)
                })
                .catch(function (error) {
                  logger.error(error.message)
                  result(`failed to abort awx job ${id}`)
                })
          }else{
              message=`cannot cancel job id ${id}`
              logger.error(message)
              result(message,null)
          }
        })
        .catch(function (error) {
          logger.error(error.message)
          result(`failed to abort awx job ${id}`)
        })
    }
  })
};
// launch awx job template
Awx.launch = function (template,inventory,tags,check,diff,extraVars, result) {

  Awx.getConfig(function(err,awxConfig){

    if(err){
      logger.error(err)
      result(`failed to get AWX configuration`)
    }else{
      // prep the post data
      var postdata = {
        extra_vars:extraVars,
        job_tags:tags
      }
      // inventory needs to be looked up first
      if(inventory){
        postdata.inventory=inventory.id
      }
      if(check){
        postdata.job_type="check"
      }else{
        postdata.job_type="run"
      }
      if(diff){
        postdata.diff_mode=true
      }else{
        postdata.diff_mode=false
      }
      if(tags){
        postdata.job_tags=tags
      }
      var message=""
      logger.debug(`launching job template ${template.name}`)
      // post
      if(template.related===undefined){
        message=`Failed to launch, no launch attribute found for template ${template.name}`
        logger.error(message)
        result(message)
      }else{
        // prepare axiosConfig
        const axiosConfig = {
          headers: {
            Authorization:"Bearer " + awxConfig.token
          },
          httpsAgent: getHttpsAgent(awxConfig)
        }
        logger.silly("Lauching awx with data : " + JSON.stringify(postdata))
        axios.post(awxConfig.uri + template.related.launch,postdata,axiosConfig)
          .then((axiosresult)=>{
            var job = axiosresult.data
            if(job){
              logger.debug(`success, job id = ${job.id}`)
              result(null,job)
            }else{
              message=`could not launch job template ${template.name}`
              logger.error(message)
              result(message,null)
            }
          })
          .catch(function (error) {
            var message=`failed to launch ${template.name}`
            if(error.response){
                logger.error(error.response.data)
                message+="\r\n" + YAML.stringify(error.response.data)
            }else{
                logger.error(error)
            }
            result(message)
          })
      }
    }
  })
};

// find a job by id
Awx.findJobById = function (id, result) {
  Awx.getConfig(function(err,awxConfig){
    if(err){
      logger.error(err)
      result(`failed to get AWX configuration`)
    }else{
      var message=""
      logger.debug(`searching for job with id ${id}`)
      // prepare axiosConfig
      const axiosConfig = {
        headers: {
          Authorization:"Bearer " + awxConfig.token
        },
        httpsAgent: getHttpsAgent(awxConfig)
      }
      axios.get(awxConfig.uri + "/api/v2/jobs/" + id + "/",axiosConfig)
        .then((axiosresult)=>{
          var job = axiosresult.data;
          if(job){
            result(null,job)
          }else{
            message=`could not find job with id ${id}`
            logger.error(message)
            result(message,null)
          }
        })
        .catch(function (error) {
          logger.error(error.message)
          result(error,null)
        })
    }
  })

};

// get the job output
Awx.findJobStdout = function (job, result) {
  Awx.getConfig(function(err,awxConfig){

    if(err){
      logger.error(err)
      result(`failed to get AWX configuration`)
    }else{
      var message=""
      if(job.related===undefined){
        result(null,"")
      }else{
        // prepare axiosConfig
        const axiosConfig = {
          headers: {
            Authorization:"Bearer " + awxConfig.token
          },
          httpsAgent: getHttpsAgent(awxConfig)
        }
        axios.get(awxConfig.uri + job.related.stdout + "?format=html",axiosConfig)
          .then((axiosresult)=>{
            var jobstdout = axiosresult.data;
            const $ = cheerio.load(jobstdout)
            if(jobstdout){
              result(null,$('pre').html())
            }else{
              message=`could not find job output for job id ${job.id}`
              logger.error(message)
              result(message,"")
            }
          })
          .catch(function (error) {
            logger.error(error.message)
            result(error.message,"")
          })
      }
    }
  })
};
// check connection
Awx.check = function (awxConfig,result) {

  logger.debug(`Checking AWX connection`)
  // prepare axiosConfig
  logger.debug(awxConfig)
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
// find a jobtemplate by name
Awx.findJobTemplateByName = function (name,result) {
  Awx.getConfig(function(err,awxConfig){
    // logger.silly(awxConfig)
    if(err){
      logger.error(err)
      result(`failed to get AWX configuration`)
    }else{
      var message=""
      logger.debug(`searching job template ${name}`)
      // prepare axiosConfig
      const axiosConfig = {
        headers: {
          Authorization:"Bearer " + awxConfig.token
        },
        httpsAgent: getHttpsAgent(awxConfig)
      }
      axios.get(awxConfig.uri + "/api/v2/job_templates/?name=" + encodeURI(name),axiosConfig)
        .then((axiosresult)=>{
          var job_template = axiosresult.data.results.find(function(jt, index) {
            if(jt.name == name)
              return true;
          });
          if(job_template){
            result(null,job_template)
          }else{
            message=`could not find job template ${name}`
            logger.error(message)
            result(message,null)
          }
        })
        .catch(function (error) {
          logger.error(error.message)
          result(error.message,null)
        })
    }
  })

};
// find a jobtemplate by name
Awx.findInventoryByName = function (name,result) {
  Awx.getConfig(function(err,awxConfig){

    if(err){
      logger.error(err)
      result(`failed to get AWX configuration`)
    }else{
      var message=""
      logger.debug(`searching inventory ${name}`)
      // prepare axiosConfig
      const httpsAgent = new https.Agent({
        rejectUnauthorized: false
      })
      const axiosConfig = {
        headers: {
          Authorization:"Bearer " + awxConfig.token
        },
        httpsAgent:httpsAgent
      }
      axios.get(awxConfig.uri + "/api/v2/inventories/?name=" + encodeURI(name),axiosConfig)
        .then((axiosresult)=>{
          var inventory = axiosresult.data.results.find(function(jt, index) {
            if(jt.name == name)
              return true;
          });
          if(inventory){
            result(null,inventory)
          }else{
            message=`could not find inventory ${name}`
            logger.error(message)
            result(message,null)
          }
        })
        .catch(function (error) {
          logger.error(error.message)
          result(error.message,null)
        })
    }
  })

};
module.exports= Awx;
