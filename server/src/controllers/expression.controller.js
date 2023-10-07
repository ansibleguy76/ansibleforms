'use strict';
const Expression = require('../models/expression.model');
var RestResult = require('../models/restResult.model');
const logger=require("../lib/logger")

exports.execute = function(req, res) {
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).json(RestResult("error","no data was sent","",""));
    }else{
        // get the form data
        var expression = req.body.expression;
        var noLog = (req.query.noLog == "true");

        Expression.execute(expression,noLog)
          .then((result)=>{
            if(!noLog){
              try{
                logger.debug(`expression result : ${JSON.stringify(result)}`)
              }catch(e){
                //
              }
            }
            res.json(new RestResult("success","successfully executed expression " + expression,result))
          })
          .catch((err)=>{
            logger.error(`Error in expression : ${err}`)
            res.json(new RestResult("success","failed to execute expression " + expression,undefined,err.toString()))
          })
    }
};
