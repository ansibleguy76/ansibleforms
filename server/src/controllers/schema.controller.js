'use strict';
const Schema = require('../models/schema.model');
var RestResult = require('../models/restResult.model');

exports.hasSchema = function(req, res) {
    Schema.hasSchema()
      .then((result)=>{ res.json(new RestResult("success","schema and tables are ok",result.data?.success,result.data?.failed)) })
      .catch((result)=>{ res.json(new RestResult("error","schema and tables are not ok",result.data?.success,result.data?.failed)) })
};
exports.create = function(req, res) {
    Schema.create()
      .then((result)=>{res.json(new RestResult("success",result,null,""))})
      .catch((err)=>{res.json(new RestResult("error",err,null,null))})
};
