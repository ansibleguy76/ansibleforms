//- MYSQL Module
const logger = require('./logger');
const client = require('mysql2');
const Credential = require('../models/credential.model')
const util = require('util')

MySql = {}

MySql.clean=function(config){
  delete config.name
  delete config.db_type
  delete config.db_name
  delete config.secure
  delete config.is_database
  return config
}

MySql.query=function(connection_name,query){
  // get credentials
  return Credential.findByName(connection_name)
  .then((config)=>{
    logger.debug(`[${connection_name}] query : ${query}`)
    return new Promise((resolve,reject)=>{
      var conn
      try{
        logger.debug(`[${connection_name}] connection found : ${config.name}`)
        config.multipleStatements=true
        // remove database if not defined
        if(config.db_name){
          config.database = config.db_name
        }
        if(config.secure){
          config.ssl={
            sslmode:"required",
            rejectUnauthorized:false
          }
        }else{
          config.ssl={
            sslmode:"none",
            rejectUnauthorized:false
          }
        }
        // get connection
        config=MySql.clean(config) // remove unsupported properties
        // logger.notice(util.inspect(config))
        conn = client.createConnection(config)

        // get data
        conn.query(query,function(err,result){
          // logger.debug(`[${connection_name}] closing connection`)
          if(err){
            reject(`[${connection_name}] query error : ${err.toString()}`)
          }else{
            conn.end()
            // logger.debug("["+connection_name+"] query result 1 : " + JSON.stringify(result))
            resolve(result)
          }

        })
      }catch(err){
        reject(`[${connection_name}] connection error : ${err.toString()}`)
      }

    })

  })
};
module.exports = MySql
