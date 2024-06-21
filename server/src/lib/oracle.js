//- MYSQL Module
const logger = require('./logger');
const Oracledb = require('oracledb');
const Credential = require('../models/credential.model')

Oracle = {}

// rewritten with await 5.0.3
Oracle.query = async function (connection_name, query) {
  var creds = await Credential.findByName(connection_name)
  var connection
  var config = {
      user: creds.user,
      password: creds.password,
      connectionString: (creds.db_name)?`${creds.host}:${creds.port}/${creds.db_name}`:`${creds.host}:${creds.port}`
  };

  try{
    connection = await Oracledb.getConnection(config)
  }catch(err){
    logger.error(`[${connection_name}] connection error`,err)
    throw err
  }
  try{
    const result = await connection.execute(query)
    return result?.rows
  }catch(err){
    logger.error(`[${connection_name}] query error`,err)
    throw err
  }finally{
    try{
      await connection.close()
    }catch(e){
      logger.error(`[${connection_name}] connection error`,e)
      throw e
    }
  }
}

module.exports = Oracle
