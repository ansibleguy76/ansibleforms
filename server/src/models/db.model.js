//- MYSQL Module
const logger = require('../lib/logger');
const dbConfig = require('../../config/db.config')
const client = require('mysql');

dbConfig.multipleStatements=true

MySql = {}

MySql.query=async function(query,vars,callback){
  // does the pool exist already, if not let's add it
  logger.debug("[ansibleforms] running query : " + query)
  var conn
  try{
    var conn = client.createConnection(dbConfig)
  }catch(err){
    logger.error("[ansibleforms] Connection error : " + err)
    callback(null,null)
    return;
  }
  try{
    conn.query(query,vars,function(err,result){
      // logger.silly("[ansibleforms] Closing connection")
      conn.end()
      if(err){
        logger.error("[ansibleforms] Query error : " + err)
        callback(err,null)
      }else{
        logger.silly("[ansibleforms] query result : " + JSON.stringify(result))
        callback(null,result)
      }
    })
  }catch(err){
    // logger.silly("[ansibleforms] Closing connection")
    conn.end()
    logger.error("[ansibleforms] " + err)
    callback(null,null)
  }

};
module.exports = MySql
