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
          .then((result)=>{res.json(new RestResult("success","successfully executed expression " + expression,result)) })
          .catch((err)=>{ logger.error("Uncaught expection in expression, should not be possible");res.json(new RestResult("error","uncaught error")) })
    }
};
