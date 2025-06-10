//- MYSQL Module
import logger from '../lib/logger.js';
import dbConfig from '../../config/db.config.js';
import client from 'mysql2/promise';
import appConfig from '../../config/app.config.js';

dbConfig.multipleStatements=true
delete dbConfig.name // remove unsupported property
delete dbConfig.is_database // remove unsupported property

const MySql = {}

// rewritten with await 5.0.3
MySql.do = async function (query, vars, silent = false) {
  if (!silent && appConfig.enableDbQueryLogging) {
    logger.info('[ansibleforms] running query : ' + query)
  }
  var conn
  try {
    conn = await client.createConnection(dbConfig)
  } catch (err) {
    logger.error('[ansibleforms] Connection error : ' + err)
    throw err
  }
  try {
    const [result] = await conn.query(query, vars)
    if (!silent && appConfig.enableDbQueryLogging) {
      logger.debug('[ansibleforms] query result : ' + JSON.stringify(result))
    }
    return result
  } catch (err) {
    logger.error('[ansibleforms] Query error : ' + err)
    throw err
  } finally {
    try {
      await conn.end()
    } catch (e) {
      logger.error('[ansibleforms] ' + e)
    }
  }
}


export default MySql;
