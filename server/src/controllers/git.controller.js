'use strict';
const Git = require('../models/git.model');
var RestResult = require('../models/restResult.model');
const logger=require("../lib/logger");

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
