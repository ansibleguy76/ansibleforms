'use strict';
import Query from '../models/query.model.js';
import RestResult from '../models/restResult.model.js';
import logger from '../lib/logger.js';

const findAll = function(req, res) {
  //handles null error
  if(req.body.constructor === Object && Object.keys(req.body).length === 0){
      res.status(400).json(new RestResult("error","no data was sent","",""));
  }else{
      if(req.body.config){
        var config = req.body.config
        var noLog = (req.query.noLog == "true")
        Query.findAll(req.body.query,config,noLog)
        .then((resultset)=>{
          res.json(new RestResult("success","query ran successfully",resultset,""));
        })
        .catch((err)=>{
          res.json(new RestResult("success","failed run query",null,err.toString()))
        })
      }else{
        logger.error("database config is missing, provide 'dbConfig' parameter with type query")
        res.status(400).json(new RestResult("error","missing dbConfig",null,""));
      }
  }
};

export default {
  findAll
};
