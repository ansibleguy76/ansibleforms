//- MYSQL Module
const logger = require('../lib/logger');
const dbConfig = require('../../config/db.config')
const client = require('mysql');

dbConfig.multipleStatements=true

MySql = {}

MySql.do=function(query,vars){
  return new Promise(async (resolve,reject) => {
    logger.info("[ansibleforms] running query : " + query)
    var conn
    try{
      var conn = client.createConnection(dbConfig)
    }catch(err){
      logger.error("[ansibleforms] Connection error : " + err)
      reject(err)
      return;
    }
    try{
      conn.query(query,vars,function(err,result){
        // logger.debug("[ansibleforms] Closing connection")
        conn.end()
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
      conn.end()
      logger.error("[ansibleforms] " + err)
      reject(err)
    }
  })
};
// MySql.query=function(query,vars,callback){
//   logger.info("[ansibleforms] running query : " + query)
//   var conn
//   try{
//     var conn = client.createConnection(dbConfig)
//   }catch(err){
//     logger.error("[ansibleforms] Connection error : " + err)
//     callback(null,null)
//     return;
//   }
//   try{
//     conn.query(query,vars,function(err,result){
//       // logger.debug("[ansibleforms] Closing connection")
//       conn.end()
//       if(err){
//         logger.error("[ansibleforms] Query error : " + err)
//         callback(err,null)
//       }else{
//         logger.debug("[ansibleforms] query result : " + JSON.stringify(result))
//         callback(null,result)
//       }
//     })
//   }catch(err){
//     // logger.debug("[ansibleforms] Closing connection")
//     conn.end()
//     logger.error("[ansibleforms] " + err)
//     callback(null,null)
//   }
//
// };


module.exports = MySql
