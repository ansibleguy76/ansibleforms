//- MYSQL Module
const logger = require('../lib/logger');
const dbConfig = require('../../config/db.config')
const mysql = require('mysql');

dbConfig.connectionLimit=10
dbConfig.multipleStatements=true
logger.info("Creating mysql connection pool")
var pool  = mysql.createPool(dbConfig);
function keepAlive(){
  pool.getConnection(function(err, connection){
    logger.silly("db ping... keep alive")
    if(err) { return; }
    connection.ping();
  });
}
setInterval(keepAlive, 30000);
module.exports = pool
