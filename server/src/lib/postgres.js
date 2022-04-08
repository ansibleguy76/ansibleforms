//- MYSQL Module
const logger = require('./logger');
const {Client} = require('pg');
const Credential = require('../models/credential.model')

Postgres = {}

Postgres.query=function(connection_name,query){

  return Credential.findByName(connection_name)
  .then((config)=>{
    return new Client(config)
  })
  .then((client)=>{
    return client.connect()
  })
  .then((client)=>{
    client.query(query,function(err,result){
      logger.debug("["+connection_name+"] Closing connection")
      client.end()
      if(err){
        throw `[${connection_name}] query error ${err.toString()}`
      }
      return result.rows
    })
  })
};
module.exports = Postgres
