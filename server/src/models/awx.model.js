'use strict';
// require axios for rest
const https=require('https')
const axios = require('axios');
const cheerio = require('cheerio');
// require awx config (token and host)
var awxConfig = require('./../../config/awx.config');
const logger=require("../lib/logger");
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
})
axios.defaults.options = httpsAgent
// prepare axiosConfig
const axiosConfig = {
  headers: {
    Authorization:"Bearer " + awxConfig.token
  }
}
//awx object create - not used, but you could create an instance with it
var Awx=function(){

};
// launch awx job template
Awx.launch = function (template,inventory,tags,extraVars, result) {

  // prep the post data
  var postdata = {
    extra_vars:extraVars,
    job_tags:tags
  }
  var message=""
  logger.debug(`launching job template ${template.name}`)
  // post
  if(template.related===undefined){
    message=`Failed to launch, no launch attibute found for template ${template.name}`
    logger.error(message)
    result(message)
  }else{
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
        logger.error(error.message)
        result(`failed to launch ${template.name}`)
      })

    }
};

// find a job by id
Awx.findJobById = function (id, result) {
  var message=""
  logger.debug(`searching for job with id ${id}`)
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
    })
};

// get the job output
Awx.findJobStdout = function (job, result) {
  var message=""
  if(job.related===undefined){
    result(null,"")
  }else{
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

};

// find a jobtemplate by name
Awx.findJobTemplateByName = function (name,result) {
  var message=""
  logger.debug(`searching job template ${name}`)
  axios.get(awxConfig.uri + "/api/v2/job_templates/",axiosConfig)
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
};
module.exports= Awx;
