//- MYSQL Module
const logger = require('./logger');
const {Client} = require('pg');
const Credential = require('../models/credential.model')

Postgres = {}

Postgres.query=function(connection_name,query){

  return Credential.findByName(connection_name)
  .then((creds)=>{
    var config = {
        host: creds.host,
        user: creds.user,
        password: creds.password,
        database: creds.db_name||creds.user,
        port: creds.port,
    };
    // console.log(config)
    return config
  })  
  .then((config)=>{
    logger.debug(`[${connection_name}] query : ${query}`)
    return new Promise((resolve,reject)=>{
      var client
      try{
        client = new Client(config)
        return client.connect()
        .then(() => client.query(query))
        .catch((err)=>{ reject(`[${connection_name}] connection error : ${err.toString()}`) })
        .then((result)=>{
            logger.debug("["+connection_name+"] Closing connection")
            client.end()
            resolve(result?.rows)
        }).catch((err)=>{
          reject(`[${connection_name}] query error : ${err.toString()}`)
        })
      }catch(err){
        reject(`[${connection_name}] connection error : ${err.toString()}`)
      }
    })

  })
};
module.exports = Postgres
