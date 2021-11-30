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

const cache = new NodeCache({
    stdTTL: 3600,
    checkperiod: (3600 * 0.5)
});

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
})
axios.defaults.options = httpsAgent

var Awx=function(awx){
    this.uri = awx.uri;
    this.token = encrypt(awx.token);
};

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
//awx object create
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
// launch awx job template
Awx.abortJob = function (id, result) {

  Awx.getConfig(function(err,res){

    if(err){
      logger.error(err)
      result(`failed to get AWX configuration`)
    }else{
      // prep the post data
      var postdata = {
      }
      var message=""
      logger.debug(`aborting awx job ${id}`)
      const axiosConfig = {
        headers: {
          Authorization:"Bearer " + res.token
        }
      }
      axios.get(res.uri + "/api/v2/jobs/" + id + "/cancel/",axiosConfig)
        .then((axiosresult)=>{
          var job = axiosresult.data
          if(job && job.can_cancel){
              logger.debug(`can cancel job id = ${id}`)
              axios.post(res.uri + "/api/v2/jobs/" + id + "/cancel/",postdata,axiosConfig)
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
Awx.launch = function (template,inventory,tags,extraVars, result) {

  Awx.getConfig(function(err,res){

    if(err){
      logger.error(err)
      result(`failed to get AWX configuration`)
    }else{
      // prep the post data
      var postdata = {
        extra_vars:extraVars,
        job_tags:tags
      }
      if(inventory){
        postdata.inventory=inventory.id
      }
      var message=""
      logger.debug(`launching job template ${template.name}`)
      // post
      if(template.related===undefined){
        message=`Failed to launch, no launch attibute found for template ${template.name}`
        logger.error(message)
        result(message)
      }else{
        // prepare axiosConfig
        const axiosConfig = {
          headers: {
            Authorization:"Bearer " + res.token
          }
        }
        logger.silly("Lauching awx with data : " + JSON.stringify(postdata))
        axios.post(res.uri + template.related.launch,postdata,axiosConfig)
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
  Awx.getConfig(function(err,res){
    if(err){
      logger.error(err)
      result(`failed to get AWX configuration`)
    }else{
      var message=""
      logger.debug(`searching for job with id ${id}`)
      // prepare axiosConfig
      const axiosConfig = {
        headers: {
          Authorization:"Bearer " + res.token
        }
      }
      axios.get(res.uri + "/api/v2/jobs/" + id + "/",axiosConfig)
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
  Awx.getConfig(function(err,res){

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
            Authorization:"Bearer " + res.token
          }
        }
        axios.get(res.uri + job.related.stdout + "?format=html",axiosConfig)
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
  const axiosConfig = {
    headers: {
      Authorization:"Bearer " + decrypt(awxConfig.token)
    }
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
  Awx.find(function(err,res){

    if(err){
      logger.error(err)
      result(`failed to get AWX configuration`)
    }else{
      var message=""
      logger.debug(`searching job template ${name}`)
      // prepare axiosConfig
      const axiosConfig = {
        headers: {
          Authorization:"Bearer " + res.token
        }
      }
      axios.get(res.uri + "/api/v2/job_templates/?name=" + encodeURI(name),axiosConfig)
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
  Awx.find(function(err,res){

    if(err){
      logger.error(err)
      result(`failed to get AWX configuration`)
    }else{
      var message=""
      logger.debug(`searching inventory ${name}`)
      // prepare axiosConfig
      const axiosConfig = {
        headers: {
          Authorization:"Bearer " + res.token
        }
      }
      axios.get(res.uri + "/api/v2/inventories/?name=" + encodeURI(name),axiosConfig)
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
