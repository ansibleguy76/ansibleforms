//- MYSQL Module — shared connection pool
//
// All queries go through a single shared mysql2 connection pool (no more
// per-request createConnection/end cycles). Public API:
//   mysql.do(query, vars)  - run a query on a pool connection
//   mysql.end()            - close the pool (graceful shutdown)
//
// NOTE: multipleStatements is left enabled because schema bootstrap may run
// multi-statement DDL via mysql.do at startup. All runtime queries use
// parameterized `?` placeholders, so this does not introduce SQL injection
// risk in normal operation. Be careful when adding any code that concatenates
// user input into a query string.
import logger from '../lib/logger.js';
import dbConfig from '../../config/db.config.js';
import client from 'mysql2/promise';
import appConfig from '../../config/app.config.js';

const poolConfig = { ...dbConfig };
delete poolConfig.name;           // unsupported property
delete poolConfig.is_database;    // unsupported property
poolConfig.multipleStatements = true;
poolConfig.connectionLimit = parseInt(process.env.DB_POOL_SIZE || '20', 10);
poolConfig.waitForConnections = true;
poolConfig.queueLimit = 0;        // queue indefinitely (surfaces as latency, not errors)
poolConfig.enableKeepAlive = true;
poolConfig.keepAliveInitialDelay = 10000;

const pool = client.createPool(poolConfig);

pool.on('connection', (conn) => {
  logger.debug(`[ansibleforms] new pool connection (threadId ${conn.threadId})`);
});

const MySql = {};

/**
 * Run a query using a pool connection. Connection is auto-released.
 */
MySql.do = async function (query, vars, silent = false) {
  if (!silent && appConfig.enableDbQueryLogging) {
    logger.info('[ansibleforms] running query : ' + query);
  }
  try {
    const [result] = await pool.query(query, vars);
    if (!silent && appConfig.enableDbQueryLogging) {
      logger.debug('[ansibleforms] query result : ' + JSON.stringify(result));
    }
    return result;
  } catch (err) {
    logger.error('[ansibleforms] Query error : ' + err);
    throw err;
  }
};

/**
 * Close the pool (graceful shutdown).
 */
MySql.end = async function () {
  try {
    await pool.end();
  } catch (err) {
    logger.error('[ansibleforms] Pool end error : ' + err);
  }
};

MySql.pool = pool;

export default MySql;
