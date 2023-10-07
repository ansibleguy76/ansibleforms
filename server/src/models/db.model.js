//- MYSQL Module
const logger = require('../lib/logger');
const dbConfig = require('../../config/db.config')
const client = require('mysql2');

// mysql2 has a bug that can throw an uncaught exception if the mysql server crashes (not enough mem for example)
process.on('uncaughtException', function(err) {
  // handle the error safely
  logger.error("An uncaught exception happened in db.model.js. ",err)
})

dbConfig.multipleStatements=true
delete dbConfig.name // remove unsupported property
MySql = {}

MySql.do=function(query,vars){
  return new Promise((resolve,reject) => {
    logger.info("[ansibleforms] running query : " + query)
    var conn
    try{
      var conn = client.createConnection(dbConfig)
    }catch(err){
      logger.error("[ansibleforms] Connection error : " + err)
      reject(err)
    }
    try{
      conn.query(query,vars,function(err,result){
        // logger.debug("[ansibleforms] Closing connection")
        try{
          conn.end()
        }catch(e){}
        if(err){
          logger.error("[ansibleforms] Query error : " + err)
          reject(err)
        }else{
          logger.debug("[ansibleforms] query result : " + JSON.stringify(result))
          resolve(result)
        }
      })
    }catch(err){
      // logger.debug("[ansibleforms] Closing connection")
      try{
        conn.end()
      }catch(e){}
      logger.error("[ansibleforms] " + err)
      reject(err)
    }
  })
};


module.exports = MySql
