//- MYSQL Module
const logger = require('./logger');
const client = require('mssql');
const Credential = require('../models/credential.model')

Mssql = {}

Mssql.query=async function(connection_name,query,callback){
  // does the pool exist already, if not let's add it
  logger.debug("["+connection_name+"] running query : " + query)
  var creds=undefined
  try{
    creds = await Credential.findByName(connection_name)
  }catch(e){
    callback(null,null)
    return;
  }

  var config = {
      server: creds.host,
      user: creds.user,
      password: creds.password,
      port: creds.port,
      options: {
          trustServerCertificate: true
      }
  };

  client.connect(config, function(err,conn){
    if(err){
      logger.error("["+connection_name+"] connection error : " + err)
      callback(null,null)
    }else{
      try{
        conn.query(query, (err, result) => {
          conn.close()
          logger.silly("["+connection_name+"] Closing connection")
          if(err){
            logger.error("["+connection_name+"] query error : " + err)
            callback(null,null)
          }else{
            logger.silly("["+connection_name+"] query result : " + JSON.stringify(result))
            callback(null,result.recordset)
          }
        })
      }catch(err){
        conn.close()
        logger.silly("["+connection_name+"] Closing connection")
        logger.error("["+connection_name+"] " + err)
        callback(null,null)
      }
    }
  })
};

module.exports = Mssql
