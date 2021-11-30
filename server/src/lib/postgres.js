//- MYSQL Module
const logger = require('./logger');
const {Client} = require('pg');
const Credential = require('../models/credential.model')

Postgres = {}

Postgres.query=async function(connection_name,query,callback){
  // does the pool exist already, if not let's add it
  logger.debug("["+connection_name+"] running query : " + query)
  var config=undefined
  try{
    config = await Credential.findByName(connection_name)
  }catch(e){
    callback(null,null)
  }
  if(config){
    var client = new Client(config)
    try{
      await client.connect()
    }catch(err){
      callback(err,null)
      return;
    }
    try{
      client.query(query,function(err,result){
        logger.silly("["+connection_name+"] Closing connection")
        client.end()
        if(err){
          callback(err,null)
        }else{
          logger.silly("["+connection_name+"] query result : " + JSON.stringify(result))
          callback(null,result.rows)
        }
      })
    }catch(err){
      logger.error("["+connection_name+"] " + err)
      callback(null,null)
    }

  }else{
    logger.error("["+connection_name+"] Empty config for mysql connection")
    callback(null,null)
  }
};
module.exports = Postgres
