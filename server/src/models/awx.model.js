'use strict';
// require axios for rest
const https=require('https')
const axios = require('axios');
const cheerio = require('cheerio');
const logger=require("../lib/logger");
const mysql=require("./db.model")
const Job=require("./job.model")
const moment=require("moment")
const Helpers=require("../lib/common")
const Exec=require("../lib/exec")
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
// abort awx job template
Awx.abortJob = function (id, next) {

  Awx.getConfig(function(err,awxConfig){

    if(err){
      logger.error(err)
      next(`failed to get AWX configuration`)
    }else{

      var message=""
      logger.info(`aborting awx job ${id}`)
      const axiosConfig = {
        headers: {
          Authorization:"Bearer " + awxConfig.token
        },
        httpsAgent: getHttpsAgent(awxConfig)
      }
      // we first need to check if we CAN cancel
      axios.get(awxConfig.uri + "/api/v2/jobs/" + id + "/cancel/",axiosConfig)
        .then((axiosnext)=>{
          var job = axiosnext.data
          if(job && job.can_cancel){
              logger.info(`can cancel job id = ${id}`)
              axios.post(awxConfig.uri + "/api/v2/jobs/" + id + "/cancel/",{},axiosConfig)
                .then((axiosnext)=>{
                  job = axiosnext.data
                  next(job)
                })
                .catch(function (error) {
                  logger.error(error.message)
                  next(`failed to abort awx job ${id}`)
                })
          }else{
              message=`cannot cancel job id ${id}`
              logger.error(message)
              next(message)
          }
        })
        .catch(function (error) {
          logger.error(error.message)
          next(`failed to abort awx job ${id}`)
        })
    }
  })
};
// launch awx job template
Awx.launch = function (form,template,inventory,tags,check,diff,extraVars,user, result,success,failed) {

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
      logger.info(`launching job template ${template.name}`)
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
        logger.debug("Lauching awx with data : " + JSON.stringify(postdata))
        // create a new job in the database
        Job.create(new Job({form:form,target:template.name,user:user.username,user_type:user.type,status:"running",job_type:"awx",extravars:extraVars}),function(error,jobid){
          var counter=0
          if(error){
            logger.error(error)
            result(error,null)
            if(failed)failed(error)
          }else{
            // job created - return directly to client (the rest is in background)
            result(null,{id:jobid})
            logger.debug(`Job id ${jobid} is created`)
            // launch awx job
            axios.post(awxConfig.uri + template.related.launch,postdata,axiosConfig)
              .then((axiosresult)=>{
                // get awx job (= remote job !!)
                var job = axiosresult.data
                if(job){
                  logger.info(`awx job id = ${job.id}`)
                  // log launch
                  Exec.printCommand(`Launched template ${template.name} with jobid ${job.id}`,"stdout",jobid,counter,(jobid,counter)=>{
                    // track the job in the background
                    Awx.trackJob(job,jobid,counter,
                      function(j,jobid,counter){
                        // if success, end with success
                        Exec.endCommand(jobid,counter,"stdout","success",`Successfully completed template ${template.name}`)
                        if(success)success(true)
                      },
                      function(e,jobid,counter){
                        // if error, end with status (aborted or failed)
                        var status="failed"
                        var message=`Template ${template.name} completed with status ${e}`
                        if(e=="canceled"){
                          status="aborted"
                          message=`Template ${template.name} was aborted`
                        }
                        Exec.endCommand(jobid,counter,"stderr",status,message)
                        if(failed)failed(message)
                      })
                  })
                }else{
                  // no awx job, end failed
                  message=`could not launch job template ${template.name}`
                  Exec.endCommand(jobid,counter,"stderr","failed",`Failed to launch template ${template.name}`)
                  if(failed)failed(message)
                  logger.error(message)
                  result(message,null)
                }
              })
              .catch(function (error) {
                var message=`failed to launch ${template.name}`
                if(error.response){
                    logger.error(error.response.data)
                    message+="\r\n" + YAML.stringify(error.response.data)
                    Exec.endCommand(jobid,counter,"stderr","success",`Failed to launch template ${template.name}. ${message}`)
                    if(failed)failed(message)
                }else{
                    logger.error(error)
                    Exec.endCommand(jobid,counter,"stderr","success",`Failed to launch template ${template.name}. ${error}`)
                    if(failed)failed(error)
                }
              })
           }
        })
      }
    }
  })
};
// loop awx job status until finished
Awx.trackJob = function (job,jobid,counter, success,failed,previousoutput) {
  Awx.getConfig(function(err,awxConfig){
    if(err){
      logger.error(err)
      failed(`failed to get AWX configuration`,jobid,counter)
    }else{
      var message=""
      logger.info(`searching for job with id ${job.id}`)
      // prepare axiosConfig
      const axiosConfig = {
        headers: {
          Authorization:"Bearer " + awxConfig.token
        },
        httpsAgent: getHttpsAgent(awxConfig)
      }
      axios.get(awxConfig.uri + job.url,axiosConfig)
        .then((axiosresult)=>{
          var j = axiosresult.data;
          if(j){
            logger.debug(`awx job status : ` + j.status)
            Awx.getJobTextOutput(job,(o)=>{
                var output=o
                // AWX has incremental output, but we always need to substract previous output
                // if previous output is part of this one, substract it (for awx output)
                if(output && previousoutput && output.indexOf(previousoutput)==0){
                  output = output.substring(previousoutput.length)
                }
                Exec.printCommand(output,"stdout",jobid,counter,(jobid,counter)=>{
                  if(j.finished){
                    if(j.status==="successful"){
                      success(j,jobid,counter)
                    }else{
                      failed(j.status,jobid,counter)
                    }
                  }else{
                    // not finished, try again
                    setTimeout(()=>{Awx.trackJob(j,jobid,counter,success,failed,o)},1000)
                  }
                },(jobid,counter)=>{
                   Exec.printCommand("Abort requested","stderr",jobid,counter)
                   Job.update({status:"aborting",end:moment(Date.now()).format('YYYY-MM-DD HH:mm:ss')},jobid,function(error,res){
                     if(error){
                       logger.error(error)
                     }
                   })
                   Awx.abortJob(j.id,(m)=>{
                     Exec.printCommand(m,"stderr",jobid,counter)
                   })
                })
            })
          }else{
            message=`could not find job with id ${job.id}`
            logger.error(message)
            failed(message,jobid,counter)
          }
        })
        .catch(function (error) {
          logger.error(error.message)
          failed(error.message)
        })
    }
  })
};
// Get text outpub
Awx.getJobTextOutput = function (job, result) {
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
        axios.get(awxConfig.uri + job.related.stdout + "?format=txt",axiosConfig)
          .then((axiosresult)=>{
            var jobstdout = axiosresult.data;
            result(jobstdout)
          })
          .catch(function (error) {
            logger.error(error.message)
            result(error.message)
          })
      }
    }
  })
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
// find a jobtemplate by name
Awx.findJobTemplateByName = function (name,result) {
  Awx.getConfig(function(err,awxConfig){
    // logger.debug(awxConfig)
    if(err){
      logger.error(err)
      result(`failed to get AWX configuration`)
    }else{
      var message=""
      logger.info(`searching job template ${name}`)
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
      logger.info(`searching inventory ${name}`)
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
