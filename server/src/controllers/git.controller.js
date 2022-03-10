'use strict';
const Git = require('../models/git.model');
var RestResult = require('../models/restResult.model');
const logger=require("../lib/logger");

exports.do = function(form,repo,extraVars,user,res,next){
  return new Promise((resolve,reject) => {
    var restResult = new RestResult("info","","","")
    if(!repo){
      // wrong implementation -> send 400 error
      if(res)
        res.json(new RestResult("error","no repo","","repo is a required field"));
      if(next)
        next("no repo",null)
      reject("no repo")
    }else{
      extraVars = JSON.stringify(extraVars);
      logger.notice("Pushing to repo : " + JSON.stringify(repo))
      logger.debug("extravars : " + extraVars)
      Git.push(form,repo,extraVars,user,function(err,out){
        if(err){
           restResult.status = "error"
           restResult.message = "error occured while pushing to git " + repo.file
           restResult.data.error = err.toString()
           if(next)
             next("error " + err.toString(),null)
           reject(err.toString())
        }else{
           restResult.message = "succesfully launched"
           restResult.data.output = out
           if(next)
             next(null,out)
        }
        // send response
        if(res)
          res.json(restResult);
      },()=>{
        resolve(true)
      },(err)=>{
        reject(err)
      })
    }
  })
}
exports.push = async function(req, res) {
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        // wrong implementation -> send 400 error
        res.json(new RestResult("error","no data was sent","",""));
    }else{
        // get the form data
        var form = req.body.formName;
        var repo = req.body.gitRepo;
        var extraVars = req.body.gitExtraVars;
        var user = req.user.user
        exports.do(form,repo,extraVars,user,res)
          .catch((e)=>{
            logger.error(e)
            //res.json(new RestResult("error",e,"",""));
          })
    }
};
exports.pull = async function(req, res) {
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        // wrong implementation -> send 400 error
        res.json(new RestResult("error","no data was sent","",""));
    }else{
        // get the form data
        var restResult = new RestResult("info","","","")
        var repo = req.body.gitRepo;

        if(!repo){
          // wrong implementation -> send 400 error
          res.json(new RestResult("error","no repo","","repo is a required field"));
        }else{
          logger.notice("Pulling repo : " + JSON.stringify(repo))
          Git.pull(repo,function(err,out){
            if(err){
               restResult.status = "error"
               restResult.message = "error occured while pulling from git " + repo.file
               restResult.data.error = err.toString()
            }else{
               restResult.message = "succesfully pulled"
               restResult.data.output = out

            }
            // send response
            res.json(restResult);
          })
        }

    }
};
