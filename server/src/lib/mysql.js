//- MYSQL Module
const logger = require('./logger');
const client = require('mysql2/promise');
const Credential = require('../models/credential.model')
const util = require('util')

MySql = {}

MySql.clean=function(config){
  delete config.name
  delete config.db_type
  delete config.db_name
  delete config.secure
  delete config.is_database
  return config
}

// rewrite with await 5.0.3

MySql.query = async function (connection_name, query) {
  // get credentials
  var config = await Credential.findByName(connection_name)
  logger.debug(`[${connection_name}] query : ${query}`)
  var conn
  try{
    conn = await client.createConnection(MySql.clean(config))
    var result
    try{
      [result] = await conn.query(query)
      return result
    }catch(err){
      logger.error(`[${connection_name}] query error : ${err.toString()}`)
      throw err
    }
  }catch(err){
    logger.error(`[${connection_name}] connection error : ${err.toString()}`)
    throw err
  }finally{
    try{
      await conn.end()
    }catch(e){
      logger.error(`[${connection_name}] ${e}`)
      throw e
    }
  }
}
module.exports = MySql
