'use strict';
import Query from '../../models/query.model.js';
import RestResult from '../../models/restResult.model.v2.js';
import logger from '../../lib/logger.js';

const findAll = async function(req, res) {
  //handles null error
  if(req.body.constructor === Object && Object.keys(req.body).length === 0){
      res.status(400).json(RestResult.error("no data was sent"));
  }else{
      if(req.body.config){
        var config = req.body.config
        var noLog = (req.query.noLog == "true")
        var jq = req.body.jq || ""
        try {
          const resultset = await Query.findAll(req.body.query,jq,config,noLog)
          res.json(RestResult.single(resultset));
        } catch(err) {
          logger.error("Query failed: " + err.toString())
          res.status(500).json(RestResult.error(err.toString()))
        }
      }else{
        logger.error("database config is missing, provide 'dbConfig' parameter with type query")
        res.status(400).json(RestResult.error("missing dbConfig"));
      }
  }
};

export default {
  findAll
};
