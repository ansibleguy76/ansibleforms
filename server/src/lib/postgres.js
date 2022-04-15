//- MYSQL Module
const logger = require('./logger');
const {Client} = require('pg');
const Credential = require('../models/credential.model')

Postgres = {}

Postgres.query=function(connection_name,query){

  return Credential.findByName(connection_name)
  .then((config)=>{
    return new Promise((resolve,reject)=>{
      var client
      try{
        client = new Client(config)
        client.connect()
      }catch(err){
        reject(`[${connection_name}] connection error ${err.toString()}`)
      }
      client.query(query,function(err,result){
        logger.debug("["+connection_name+"] Closing connection")
        client.end()
        if(err){
          reject(`[${connection_name}] query error ${err.toString()}`)
        }
        resolve(result?.rows)
      })
    })

  })
};
module.exports = Postgres
