//- MYSQL Module
const logger = require('./logger');
const client = require('mysql');
const Credential = require('../models/credential.model')

MySql = {}

MySql.do=function(connection_name,query){
  // get credentials
  return Credential.findByName(connection_name)
  .then((config)=>{
    try{
      config.multipleStatements=true
      // get connection
      return client.createConnection(config)
    }catch(err){
      throw `[${connection_name}] connection error ${err.toString()}`
    }
  })
  .then((conn)=>{
    // get data
    conn.query(query,function(err,result){
      logger.debug(`[${connection_name}] closing connection`)
      conn.end()
      if(err){
        throw `[${connection_name}] query error ${err.toString()}`
      }else{
        // logger.debug("["+connection_name+"] query result : " + JSON.stringify(result))
        return result
      }
    })
  })
};
module.exports = MySql
