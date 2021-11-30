//- MYSQL Module
const logger = require('./logger');
const client = require('mssql');
const Credential = require('../models/credential.model')

Sql = {}

Sql.query=async function(connection_name,query,callback){
  // does the pool exist already, if not let's add it
  logger.debug("["+connection_name+"] running query : " + query)
  var creds=undefined
  try{
    creds = await Credential.findByName(connection_name)
  }catch(e){
    callback(null,null)
  }
  if(creds){
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
        callback(err,null)
      }else{
        try{
          conn.query(query, (err, result) => {
            conn.close()
            logger.silly("["+connection_name+"] Closing connection")
            if(err){
              logger.silly("["+connection_name+"] query error : " + err)
              callback(err,null)
            }else{
              logger.silly("["+connection_name+"] query result : " + JSON.stringify(result))
              callback(null,result.recordset)
            }
          })
        }catch(err){
          conn.close()
          logger.silly("["+connection_name+"] Closing connection")
          callback(err,null)
        }

      }
    })

  }else{
    logger.error("["+connection_name+"] Empty config for sql connection")
    callback(null,null)
  }
};

module.exports = Sql
