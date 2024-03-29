//- MYSQL Module
const logger = require('./logger');
const client = require('mssql');
const Credential = require('../models/credential.model')

Mssql = {}

Mssql.query=async function(connection_name,query){
  return Credential.findByName(connection_name)
  .then((creds)=>{
    var config = {
        server: creds.host,
        user: creds.user,
        password: creds.password,
        database: creds.db_name,
        port: creds.port,
        options: {
            trustServerCertificate: true
        }
    };
    if(creds.secure){
      
      config.encrypt=true
    }
    // remove database if needed
    if(!creds.db_name){
      delete config.database
    }
    return config
  })
  .then((config)=>{
    return new Promise((resolve,reject)=>{
      client.connect(config, function(err,conn){
        if(err){
          reject(`[${connection_name}] connection error : ${err.toString()}`)
        }else{
          conn.query(query, (err, result) => {
            // close connection immediately
            logger.debug(`[${connection_name}] closing connection`)
            conn.close()
            if(err){
              reject(`[${connection_name}] query error : ${err.toString()}`)
            }
            resolve(result?.recordset)
          })
        }

      })
    })

  })
};

module.exports = Mssql
