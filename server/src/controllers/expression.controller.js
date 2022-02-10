'use strict';
const Expression = require('../models/expression.model');
var RestResult = require('../models/restResult.model');

exports.execute = function(req, res) {
    //handles null error
    if(req.body.constructor === Object && Object.keys(req.body).length === 0){
        res.status(400).json(RestResult("error","no data was sent","",""));
    }else{
        // get the form data
        var expression = req.body.expression;
        var noLog = (req.query.noLog == "true");
        var restResult = new RestResult("success","")

        Expression.execute(expression,noLog, function(err, result) {
            if (err){
              restResult.status = "error"
              restResult.message = "failed to execute expression " + expression
              restResult.data.error = err
              // send response
              res.json(restResult)
            }else{
              restResult.message = "successfully executed expression " + expression
              restResult.data.output = result
              res.json(restResult)
            }
        })

    }
};
