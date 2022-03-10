//- MYSQL Module
const logger = require('./logger');
const client = require('mysql');
const Credential = require('../models/credential.model')

MySql = {}

MySql.query=async function(connection_name,query,callback){
  // does the pool exist already, if not let's add it
  var config=undefined
  try{
    config = await Credential.findByName(connection_name)
  }catch(e){
    callback(null,null)
    return;
  }

  config.multipleStatements=true
  var conn
  try{
    var conn = client.createConnection(config)
  }catch(err){
    logger.error("["+connection_name+"] Connection error : " + err)
    callback(null,null)
    return;
  }
  try{
    conn.query(query,function(err,result){
      logger.debug("["+connection_name+"] Closing connection")
      conn.end()
      if(err){
        logger.error("["+connection_name+"] Query error : " + err)
        callback(err,null)
      }else{
        // logger.debug("["+connection_name+"] query result : " + JSON.stringify(result))
        callback(null,result)
      }
    })
  }catch(err){
    logger.debug("["+connection_name+"] Closing connection")
    conn.end()
    logger.error("["+connection_name+"] " + err)
    callback(null,null)
  }

};
module.exports = MySql
