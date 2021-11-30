//- MYSQL Module
const logger = require('./logger');
const mysql = require('mysql');
const Credential = require('../models/credential.model')

MySql = {}

MySql.query=async function(connection_name,query,callback){
  // does the pool exist already, if not let's add it
  logger.debug("["+connection_name+"] running query : " + query)
  var config=undefined
  try{
    config = await Credential.findByName(connection_name)
  }catch(e){
    callback(null,null)
  }
  if(config){
    config.multipleStatements=true
    var conn = mysql.createConnection(config)
    try{
      conn.query(query,function(err,result){
        logger.silly("["+connection_name+"] Closing connection")
        if(err){
          callback(err,null)
        }else{
          logger.silly("["+connection_name+"] query result : " + JSON.stringify(result))
          callback(null,result)
        }
      })
    }catch(err){
      logger.silly("["+connection_name+"] Closing connection")
      conn.end()
      logger.error("["+connection_name+"] " + err)
      callback(null,null)
    }

  }else{
    logger.error("["+connection_name+"] Empty config for mysql connection")
    callback(null,null)
  }
};
module.exports = MySql
