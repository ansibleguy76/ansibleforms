//- MYSQL Module
const logger = require('./logger');
const {decrypt} = require('./crypto')
const dbConfig = require('../../config/db.config')
const NodeCache = require('node-cache')
const MySql = require('./mysql');
const sql = require('mssql')

// a caching mechanism to cache connection pools
// we will keep a connection pool open for a while
// but not forever.  A new pool will be created if needed.
const msSqlPoolCache = new NodeCache({
    stdTTL: 3600,
    checkperiod: (3600 * 0.5)
});

// close the pool on expire
msSqlPoolCache.on( "expired", function( name, pool ){
    logger.silly("["+name+"] connectionpool is expired, closing pool")
    pool.close()
});

function getPool(name,callback){
  var pool
  // get pool from cache
  pool = msSqlPoolCache.get(name)
  // not in cache ?
  if(pool==undefined){
    logger.debug("["+name+"] pool not connected yet, getting credentials")
    MySql.getCredential(name,function(err,creds){
      var config={}
      var pool
      if(err){
        callback(err,null)
      }else{
        var config = {
            server: creds.host,
            user: creds.user,
            password: creds.password,
            port: creds.port,
            options: {
                trustServerCertificate: true
            }
        };
        logger.silly("["+name+"] connecting")
        pool = new sql.ConnectionPool(config)
        pool.connect((err)=>{
          // save to cache
          if(err){
            logger.error("["+name+"] failed to connect to pool")
            callback(err,null)
          }else{
            logger.debug("["+name+"] connected and caching pool")
            msSqlPoolCache.set(name,pool)
            callback(null,pool)
          }

        })

      }
    })
  }else{
    logger.silly("["+name+"] getting pool from cache")
    callback(null,pool)
  }
}

var Sql=function(){

}

Sql.query=function(connection_name,query,callback){
  // get connection config
  getPool(connection_name,function(err,pool){
    // query
    logger.silly("["+connection_name+"] run query : " + query)
    var request
    try{
      // logger.silly("["+connection_name+"] getting request")
      request = new sql.Request(pool)
    }catch(err){
      logger.error("["+ connection_name +"] error getting request : " + err)
      logger.info("["+connection_name+"] Removing connection from cache after fail")
      msSqlPoolCache.del(connection_name)
      callback(err,null)
    }
    if(request){
      try{
        // logger.silly("["+connection_name+"] run query : " + query)
        request.query(query, (err, result) => {
          // logger.silly("["+connection_name+"] query finished")
          if(err){
            logger.error("["+ connection_name +"] error running query : " + err)
            callback(err,null)
          }else{
            logger.silly("["+ connection_name +"] query result : " + JSON.stringify(result.recordset))
            callback(null,result.recordset)
          }
        })
      }catch(err){
        logger.error("["+ connection_name +"] error running query : " + err)
        callback(err,null)
      }
    }

  })
}

module.exports = Sql
