//- MYSQL Module
const logger = require('./logger');
const {Client} = require('pg');
const Credential = require('../models/credential.model')

Postgres = {}

Postgres.query=async function(connection_name,query,callback){
  var config=undefined
  try{
    config = await Credential.findByName(connection_name)
  }catch(e){
    callback(null,null)
    return;
  }

  var client = new Client(config)
  try{
    await client.connect()
  }catch(err){
    logger.error("["+connection_name+"] Connection error : " + err)
    callback(null,null)
    return;
  }
  try{
    client.query(query,function(err,result){
      logger.silly("["+connection_name+"] Closing connection")
      client.end()
      if(err){
        logger.error("["+connection_name+"] Query error : " + err)
        callback(null,null)
      }else{
        // logger.silly("["+connection_name+"] query result : " + JSON.stringify(result))
        callback(null,result.rows)
      }
    })
  }catch(err){
    client.end()
    logger.silly("["+connection_name+"] Closing connection")
    logger.error("["+connection_name+"] " + err)
    callback(null,null)
  }

};
module.exports = Postgres
