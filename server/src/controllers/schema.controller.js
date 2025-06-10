'use strict';
import Schema from '../models/schema.model.js';
import RestResult from '../models/restResult.model.js';
import helpers from '../lib/common.js';

const hasSchema = function(req, res) {

    Schema.hasSchema()
      .then((result)=>{ res.json(new RestResult("success","schema and tables are ok",result.data?.success,result.data?.failed)) })
      .catch((err)=>{ 
        var result = err.result // we check if the error has a result
        if(!result?.data){
          res.json(new RestResult("error","FATAL ERROR",[],[result.message])) 
        }else{
          res.json(new RestResult("error","schema and tables are not ok",result.data?.success,result.data?.failed)) 
        }
      })

};
const create = function(req, res) {
    Schema.create()
      .then((result)=>{ res.json(new RestResult("success",result,null,"")) })
      .catch((err)=>{
        res.json(new RestResult("error",helpers.getError(err),null,null))
      })
};

export default {
  hasSchema,
  create
};
