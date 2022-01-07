'use strict';
const Schema = require('../models/schema.model');
const User = require('../models/user.model');
var RestResult = require('../models/restResult.model');

exports.hasSchema = function(req, res) {
    Schema.hasSchema(function(err, schema) {
        if (err){
            res.json(new RestResult("error",err,null,null))
        }else{
            res.json(new RestResult(schema.status,schema.message,schema.data.success,schema.data.failed));
        }
    });
};
exports.create = function(req, res) {
    Schema.create(function(err, result) {
        if (err){
            res.json(new RestResult("error",err,null,null))
        }else{
            res.json(new RestResult("success",result,null,""));
        }
    });
};
