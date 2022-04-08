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
        port: creds.port,
        options: {
            trustServerCertificate: true
        }
    };
    return config
  })
  .then((config)=>{
    client.connect(config, function(err,conn){
      if(err){
        throw `[${connection_name}] connection error ${err.toString()}`
      }
      conn.query(query, (err, result) => {
        // close connection immediately
        logger.debug(`[${connection_name}] closing connection`)
        conn.close()
        if(err){
          throw `[${connection_name}] query error ${err.toString()}`
        }
        return result.recordset
      })
    })
  })
};

module.exports = Mssql
