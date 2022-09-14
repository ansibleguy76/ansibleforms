//- MYSQL Module
const logger = require('./logger');
const client = require('mysql');
const Credential = require('../models/credential.model')

MySql = {}

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
        if(config.secure){
          config.ssl={
            sslmode:"required",
            rejectUnauthorized:false
          }
        }else{
          config.ssl={
            sslmode:"none"
          }
        }
        // get connection
        conn = client.createConnection(config)
      }catch(err){
        reject(`[${connection_name}] connection error : ${err.toString()}`)
      }
      // get data
      conn.query(query,function(err,result){
        // logger.debug(`[${connection_name}] closing connection`)
        conn.end()
        if(err){
          reject(`[${connection_name}] query error : ${err.toString()}`)
        }else{
          // logger.debug("["+connection_name+"] query result 1 : " + JSON.stringify(result))
          resolve(result)
        }
      })
    })

  })
};
module.exports = MySql
